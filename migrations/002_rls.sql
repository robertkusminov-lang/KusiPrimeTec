create or replace function public.is_admin_email()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.admin_users a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and a.is_active = true
  );
$$;

alter table public.admin_users enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_attachments enable row level security;
alter table public.ticket_events enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.document_counters enable row level security;
alter table public.ticket_documents enable row level security;
alter table public.analytics_events enable row level security;
alter table public.graph_tokens enable row level security;
alter table public.graph_oauth_states enable row level security;
alter table public.audit_log enable row level security;

create policy admin_users_self_read on public.admin_users
for select to authenticated
using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy admin_users_admin_all on public.admin_users
for all to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

create policy tickets_admin_all on public.tickets
for all to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

create policy ticket_attachments_admin_all on public.ticket_attachments
for all to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

create policy ticket_events_admin_all on public.ticket_events
for all to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

create policy ticket_messages_admin_all on public.ticket_messages
for all to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

create policy document_counters_admin_all on public.document_counters
for all to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

create policy ticket_documents_admin_all on public.ticket_documents
for all to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

create policy analytics_events_admin_all on public.analytics_events
for all to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

create policy graph_tokens_admin_all on public.graph_tokens
for all to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

create policy graph_states_admin_all on public.graph_oauth_states
for all to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

create policy audit_log_admin_all on public.audit_log
for all to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

create policy storage_documents_admin_read on storage.objects
for select to authenticated
using (bucket_id = 'documents' and public.is_admin_email());

create policy storage_documents_admin_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'documents' and public.is_admin_email());

create policy storage_documents_admin_update on storage.objects
for update to authenticated
using (bucket_id = 'documents' and public.is_admin_email())
with check (bucket_id = 'documents' and public.is_admin_email());

create policy storage_documents_admin_delete on storage.objects
for delete to authenticated
using (bucket_id = 'documents' and public.is_admin_email());


