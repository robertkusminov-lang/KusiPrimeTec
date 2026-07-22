-- Customer access requires one active object, one customer and one auth identity.

drop policy if exists objects_customer_read_own on public.objects;
create policy objects_customer_read_own on public.objects
  for select to authenticated
  using (
    is_active = true
    and customer_id is not null
    and requester_user_id = auth.uid()
    and exists (
      select 1
      from public.customers c
      where c.id = objects.customer_id
        and c.auth_user_id = auth.uid()
    )
  );

drop policy if exists tickets_customer_read_own on public.tickets;
create policy tickets_customer_read_own on public.tickets
  for select to authenticated
  using (
    customer_id is not null
    and object_id is not null
    and (requester_user_id is null or requester_user_id = auth.uid())
    and exists (
      select 1
      from public.objects o
      join public.customers c on c.id = o.customer_id
      where o.id = tickets.object_id
        and o.is_active = true
        and o.customer_id = tickets.customer_id
        and o.requester_user_id = auth.uid()
        and c.auth_user_id = auth.uid()
    )
  );

drop policy if exists object_notes_customer_read_own on public.object_notes;
create policy object_notes_customer_read_own on public.object_notes
  for select to authenticated
  using (
    exists (
      select 1
      from public.objects o
      join public.customers c on c.id = o.customer_id
      where o.id = object_notes.object_id
        and o.is_active = true
        and o.requester_user_id = auth.uid()
        and c.auth_user_id = auth.uid()
    )
  );

-- Child records remain admin-only through their existing policies. Customer report
-- delivery is performed by customer-reports after the same active-object check.
do $$
begin
  if to_regclass('public.ticket_attachments') is not null then
    execute 'drop policy if exists ticket_attachments_customer_read_own on public.ticket_attachments';
  end if;
  if to_regclass('public.ticket_documents') is not null then
    execute 'drop policy if exists ticket_documents_customer_read_own on public.ticket_documents';
  end if;
  if to_regclass('public.reports') is not null then
    execute 'drop policy if exists reports_customer_read_own on public.reports';
  end if;
end
$$;

create or replace function public.enforce_ticket_object_customer_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  object_customer_id uuid;
  object_requester_user_id uuid;
  object_is_active boolean;
  customer_auth_user_id uuid;
begin
  if new.object_id is null then
    return new;
  end if;

  select o.customer_id, o.requester_user_id, o.is_active
    into object_customer_id, object_requester_user_id, object_is_active
  from public.objects o
  where o.id = new.object_id;

  if not found then
    raise exception using errcode = '23503', message = 'Ticket object_id references an unknown object.';
  end if;
  if object_is_active is distinct from true then
    raise exception using errcode = '23514', message = 'Tickets cannot be assigned to inactive objects.';
  end if;
  if new.customer_id is null or object_customer_id is null or new.customer_id is distinct from object_customer_id then
    raise exception using errcode = '23514', message = 'Ticket and object customer_id must match.';
  end if;

  select c.auth_user_id
    into customer_auth_user_id
  from public.customers c
  where c.id = new.customer_id;

  if object_requester_user_id is distinct from customer_auth_user_id then
    raise exception using errcode = '23514', message = 'Object requester does not match the ticket customer.';
  end if;
  if new.requester_user_id is not null
    and new.requester_user_id is distinct from customer_auth_user_id then
    raise exception using errcode = '23514', message = 'Ticket requester does not match the ticket customer.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tickets_object_customer_consistency on public.tickets;
create trigger trg_tickets_object_customer_consistency
before insert or update of object_id, customer_id, requester_user_id on public.tickets
for each row execute function public.enforce_ticket_object_customer_consistency();
