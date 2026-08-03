begin;

-- Prevent caller-controlled schemas from changing function resolution.
alter function public.set_updated_at() set search_path = '';
alter function public.touch_updated_at() set search_path = '';
alter function public.next_ticket_number() set search_path = '';
alter function public.is_allowed_admin() set search_path = '';
alter function public.set_ticket_number() set search_path = '';
alter function public.is_admin() set search_path = '';
alter function public.next_document_number(text) set search_path = '';
alter function public.sync_ticket_consent_fields() set search_path = '';
alter function public.next_objectbetreuung_inquiry_number() set search_path = '';
alter function public.is_admin_email() set search_path = '';

-- Trigger functions are never intended to be called through the Data API.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.set_ticket_number() from public, anon, authenticated;
revoke execute on function public.sync_ticket_consent_fields() from public, anon, authenticated;
revoke execute on function public.enforce_ticket_object_customer_consistency() from public, anon, authenticated;

-- Number generators and admin predicates may be used by authenticated admin flows,
-- but must not be callable by anonymous visitors.
revoke execute on function public.next_ticket_number() from public, anon;
revoke execute on function public.next_document_number(text) from public, anon;
revoke execute on function public.next_objectbetreuung_inquiry_number() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_allowed_admin() from public, anon;
revoke execute on function public.is_admin_email() from public, anon;
grant execute on function public.next_ticket_number() to authenticated, service_role;
grant execute on function public.next_document_number(text) to authenticated, service_role;
grant execute on function public.next_objectbetreuung_inquiry_number() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_allowed_admin() to authenticated, service_role;
grant execute on function public.is_admin_email() to authenticated, service_role;

-- Remove the legacy bootstrap policy that allowed every authenticated account to
-- add itself to the admin allow-list.
drop policy if exists "Enable insert for authenticated users only" on public.allowed_admins;

-- Admin identity tables: self-read remains possible, all writes require an
-- already active administrator.
drop policy if exists admin_users_admin_all on public.admin_users;
drop policy if exists admin_users_self_read on public.admin_users;
create policy admin_users_select_authorized
  on public.admin_users for select to authenticated
  using (
    (select public.is_admin_email())
    or email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  );
create policy admin_users_insert_admin
  on public.admin_users for insert to authenticated
  with check ((select public.is_admin_email()));
create policy admin_users_update_admin
  on public.admin_users for update to authenticated
  using ((select public.is_admin_email()))
  with check ((select public.is_admin_email()));
create policy admin_users_delete_admin
  on public.admin_users for delete to authenticated
  using ((select public.is_admin_email()));

drop policy if exists allowed_admins_admin_all on public.allowed_admins;
drop policy if exists allowed_admins_self_read on public.allowed_admins;
create policy allowed_admins_select_authorized
  on public.allowed_admins for select to authenticated
  using (
    (select public.is_admin_email())
    or email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  );
create policy allowed_admins_insert_admin
  on public.allowed_admins for insert to authenticated
  with check ((select public.is_admin_email()));
create policy allowed_admins_update_admin
  on public.allowed_admins for update to authenticated
  using ((select public.is_admin_email()))
  with check ((select public.is_admin_email()));
create policy allowed_admins_delete_admin
  on public.allowed_admins for delete to authenticated
  using ((select public.is_admin_email()));

-- Consolidate overlapping customer policies without changing legitimate self
-- access. Wrapping auth calls in SELECT lets Postgres evaluate them once.
drop policy if exists admin_all_customers on public.customers;
drop policy if exists customer_select_own_customer on public.customers;
drop policy if exists customer_update_own_customer on public.customers;
drop policy if exists customers_admin_all on public.customers;
drop policy if exists customers_self_claim_update on public.customers;
drop policy if exists customers_self_insert on public.customers;
drop policy if exists customers_self_read on public.customers;
drop policy if exists customers_self_read_by_email_claim on public.customers;

create policy customers_select_authorized
  on public.customers for select to authenticated
  using (
    (select public.is_admin_email())
    or auth_user_id = (select auth.uid())
    or (
      auth_user_id is null
      and lower(btrim(coalesce(email, ''))) =
        lower(btrim(coalesce((select auth.jwt()) ->> 'email', '')))
    )
  );
create policy customers_insert_authorized
  on public.customers for insert to authenticated
  with check (
    (select public.is_admin_email())
    or auth_user_id = (select auth.uid())
  );
create policy customers_update_authorized
  on public.customers for update to authenticated
  using (
    (select public.is_admin_email())
    or auth_user_id = (select auth.uid())
    or (
      auth_user_id is null
      and lower(btrim(coalesce(email, ''))) =
        lower(btrim(coalesce((select auth.jwt()) ->> 'email', '')))
    )
  )
  with check (
    (select public.is_admin_email())
    or auth_user_id = (select auth.uid())
  );
create policy customers_delete_admin
  on public.customers for delete to authenticated
  using ((select public.is_admin_email()));

-- The older customer_select_own_tickets policy bypassed the stricter object and
-- requester checks. Replace all overlapping policies with one rule per command.
drop policy if exists admin_all_tickets on public.tickets;
drop policy if exists customer_select_own_tickets on public.tickets;
drop policy if exists tickets_admin_all on public.tickets;
drop policy if exists tickets_customer_read_own on public.tickets;
drop policy if exists tickets_public_insert_inbox on public.tickets;
revoke all on public.tickets from anon;

create policy tickets_select_authorized
  on public.tickets for select to authenticated
  using (
    (select public.is_admin_email())
    or (
      customer_id is not null
      and object_id is not null
      and (requester_user_id is null or requester_user_id = (select auth.uid()))
      and exists (
        select 1
        from public.objects o
        join public.customers c on c.id = o.customer_id
        where o.id = tickets.object_id
          and o.is_active = true
          and o.customer_id = tickets.customer_id
          and o.requester_user_id = (select auth.uid())
          and c.auth_user_id = (select auth.uid())
      )
    )
  );
create policy tickets_insert_admin
  on public.tickets for insert to authenticated
  with check ((select public.is_admin_email()));
create policy tickets_update_admin
  on public.tickets for update to authenticated
  using ((select public.is_admin_email()))
  with check ((select public.is_admin_email()));
create policy tickets_delete_admin
  on public.tickets for delete to authenticated
  using ((select public.is_admin_email()));

drop policy if exists admin_all_documents on public.documents;
drop policy if exists customer_select_visible_documents on public.documents;
create policy documents_select_authorized
  on public.documents for select to authenticated
  using (
    (select public.is_admin_email())
    or (
      visible_to_customer = true
      and exists (
        select 1
        from public.tickets t
        join public.customers c on c.id = t.customer_id
        where t.id = documents.ticket_id
          and c.auth_user_id = (select auth.uid())
      )
    )
  );
create policy documents_insert_admin
  on public.documents for insert to authenticated
  with check ((select public.is_admin_email()));
create policy documents_update_admin
  on public.documents for update to authenticated
  using ((select public.is_admin_email()))
  with check ((select public.is_admin_email()));
create policy documents_delete_admin
  on public.documents for delete to authenticated
  using ((select public.is_admin_email()));

drop policy if exists admin_all_contracts on public.service_contracts;
drop policy if exists customer_select_own_contracts on public.service_contracts;
create policy service_contracts_select_authorized
  on public.service_contracts for select to authenticated
  using (
    (select public.is_admin_email())
    or exists (
      select 1 from public.customers c
      where c.id = service_contracts.customer_id
        and c.auth_user_id = (select auth.uid())
    )
  );
create policy service_contracts_insert_admin
  on public.service_contracts for insert to authenticated
  with check ((select public.is_admin_email()));
create policy service_contracts_update_admin
  on public.service_contracts for update to authenticated
  using ((select public.is_admin_email()))
  with check ((select public.is_admin_email()));
create policy service_contracts_delete_admin
  on public.service_contracts for delete to authenticated
  using ((select public.is_admin_email()));

drop policy if exists admin_all_updates on public.ticket_updates;
drop policy if exists customer_select_visible_updates on public.ticket_updates;
create policy ticket_updates_select_authorized
  on public.ticket_updates for select to authenticated
  using (
    (select public.is_admin_email())
    or (
      visible_to_customer = true
      and exists (
        select 1
        from public.tickets t
        join public.customers c on c.id = t.customer_id
        where t.id = ticket_updates.ticket_id
          and c.auth_user_id = (select auth.uid())
      )
    )
  );
create policy ticket_updates_insert_admin
  on public.ticket_updates for insert to authenticated
  with check ((select public.is_admin_email()));
create policy ticket_updates_update_admin
  on public.ticket_updates for update to authenticated
  using ((select public.is_admin_email()))
  with check ((select public.is_admin_email()));
create policy ticket_updates_delete_admin
  on public.ticket_updates for delete to authenticated
  using ((select public.is_admin_email()));

drop policy if exists objects_admin_all on public.objects;
drop policy if exists objects_customer_read_own on public.objects;
create policy objects_select_authorized
  on public.objects for select to authenticated
  using (
    (select public.is_admin_email())
    or (
      is_active = true
      and customer_id is not null
      and requester_user_id = (select auth.uid())
      and exists (
        select 1 from public.customers c
        where c.id = objects.customer_id
          and c.auth_user_id = (select auth.uid())
      )
    )
  );
create policy objects_insert_admin
  on public.objects for insert to authenticated
  with check ((select public.is_admin_email()));
create policy objects_update_admin
  on public.objects for update to authenticated
  using ((select public.is_admin_email()))
  with check ((select public.is_admin_email()));
create policy objects_delete_admin
  on public.objects for delete to authenticated
  using ((select public.is_admin_email()));

drop policy if exists object_notes_admin_all on public.object_notes;
drop policy if exists object_notes_customer_read_own on public.object_notes;
create policy object_notes_select_authorized
  on public.object_notes for select to authenticated
  using (
    (select public.is_admin_email())
    or exists (
      select 1
      from public.objects o
      join public.customers c on c.id = o.customer_id
      where o.id = object_notes.object_id
        and o.is_active = true
        and o.requester_user_id = (select auth.uid())
        and c.auth_user_id = (select auth.uid())
    )
  );
create policy object_notes_insert_admin
  on public.object_notes for insert to authenticated
  with check ((select public.is_admin_email()));
create policy object_notes_update_admin
  on public.object_notes for update to authenticated
  using ((select public.is_admin_email()))
  with check ((select public.is_admin_email()));
create policy object_notes_delete_admin
  on public.object_notes for delete to authenticated
  using ((select public.is_admin_email()));

-- Legacy operational tables were created before RLS was enabled. Edge Functions
-- use service_role and continue to bypass these policies; direct browser access
-- is restricted to authenticated administrators.
do $block$
declare
  table_name text;
begin
  foreach table_name in array array[
    'document_counters',
    'ticket_events',
    'status_history',
    'ticket_counters',
    'portal_step_events',
    'ticket_files',
    'ticket_attachments',
    'invoices',
    'objectbetreuung_inquiry_sequences',
    'ticket_number_sequences',
    'ticket_documents',
    'timeline_events',
    'offers',
    'reports'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon', table_name);
    execute format('drop policy if exists %I on public.%I', 'admin_only_' || table_name, table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select public.is_admin_email())) with check ((select public.is_admin_email()))',
      'admin_only_' || table_name,
      table_name
    );
  end loop;
end
$block$;

-- Admin views must neither bypass base-table RLS nor be readable by customer or
-- anonymous roles. They are currently unused by the browser application.
alter view public.v_tickets_admin set (security_invoker = true);
alter view public.ticket_admin_view set (security_invoker = true);
revoke all on public.v_tickets_admin from anon, authenticated;
revoke all on public.ticket_admin_view from anon, authenticated;
grant select on public.v_tickets_admin to service_role;
grant select on public.ticket_admin_view to service_role;

-- Remove byte-for-byte duplicate indexes while retaining their canonical copy.
drop index if exists public.uq_allowed_admins_email;
drop index if exists public.idx_analytics_events_ticket;
alter table public.ticket_counters drop constraint if exists ticket_counters_day_unique;
drop index if exists public.idx_tickets_bucket_created;
drop index if exists public.idx_tickets_customer_created;
drop index if exists public.idx_tickets_customer_id_created;
drop index if exists public.idx_tickets_status_created;

-- Cover all currently unindexed foreign keys reported by the database advisor.
create index if not exists idx_documents_ticket_id on public.documents(ticket_id);
create index if not exists idx_object_notes_created_by_user_id on public.object_notes(created_by_user_id);
create index if not exists idx_object_notes_ticket_id on public.object_notes(ticket_id);
create index if not exists idx_objects_customer_id on public.objects(customer_id);
create index if not exists idx_service_contracts_customer_id on public.service_contracts(customer_id);
create index if not exists idx_ticket_attachments_ticket_id on public.ticket_attachments(ticket_id);
create index if not exists idx_ticket_creation_requests_ticket_id on public.ticket_creation_requests(ticket_id);
create index if not exists idx_ticket_documents_linked_package_id on public.ticket_documents(linked_package_id);
create index if not exists idx_ticket_internal_ticket_id on public.ticket_internal(ticket_id);

commit;
