create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_sequences (
  year integer primary key,
  next_value integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_nummer text unique not null,
  status text not null,
  anfrageart text not null,
  kategorie text not null,
  dringlichkeit text not null,
  titel text not null,
  kunde_name text not null,
  kunde_firma text null,
  kunde_email text not null,
  kunde_telefon text not null,
  objekt_adresse text not null,
  ort text not null,
  plz text not null,
  radius_km integer not null default 30,
  terminwunsch date null,
  zeitfenster_von time null,
  zeitfenster_bis time null,
  beschreibung text not null,
  datenschutz_akzeptiert boolean not null default false,
  agb_akzeptiert boolean not null default false,
  haftung_koordination_akzeptiert boolean not null default false,
  bestaetigt_at timestamptz null,
  termin_geplant_at timestamptz null,
  angebot_summe numeric(12,2) not null default 0,
  rechnungs_summe numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tickets_status_check check (
    status in (
      'Neu','Geprueft','Rueckfrage_Kunde','Termin_geplant','In_Arbeit','Angebot_erstellt','Angebot_gesendet',
      'Angebot_angenommen','Rapport_erstellt','Rechnung_erstellt','Rechnung_gesendet','Bezahlt','Storniert'
    )
  )
);

create table if not exists public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,
  base64_content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  event_typ text not null,
  detail text not null,
  actor text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  richtung text not null,
  kanal text not null,
  betreff text not null,
  sender text not null,
  inhalt text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.document_counters (
  prefix text primary key,
  year integer not null,
  next_value integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_documents (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  dokument_typ text not null,
  dokument_nummer text unique not null,
  storage_path text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  constraint dokument_typ_check check (dokument_typ in ('angebot','rapport','rechnung'))
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  step text null,
  page_path text null,
  ticket_id uuid null references public.tickets(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.graph_tokens (
  admin_email text primary key,
  access_cipher text not null,
  access_iv text not null,
  refresh_cipher text not null,
  refresh_iv text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.graph_oauth_states (
  state text primary key,
  admin_email text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tickets_touch on public.tickets;
create trigger trg_tickets_touch
before update on public.tickets
for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_graph_tokens_touch on public.graph_tokens;
create trigger trg_graph_tokens_touch
before update on public.graph_tokens
for each row execute procedure public.touch_updated_at();

create or replace function public.next_ticket_number()
returns text
language plpgsql
as $$
declare
  y integer := extract(year from now())::integer;
  v integer;
begin
  insert into public.ticket_sequences (year, next_value)
  values (y, 1)
  on conflict (year) do nothing;

  update public.ticket_sequences
  set next_value = next_value + 1,
      updated_at = now()
  where year = y
  returning next_value - 1 into v;

  return format('KPT-%s-%s', y, lpad(v::text, 4, '0'));
end;
$$;

create or replace function public.next_document_number(p_prefix text)
returns text
language plpgsql
as $$
declare
  y integer := extract(year from now())::integer;
  k text := upper(coalesce(trim(p_prefix), 'DOC'));
  v integer;
begin
  insert into public.document_counters (prefix, year, next_value)
  values (k, y, 1)
  on conflict (prefix) do update
    set year = excluded.year,
        next_value = case when document_counters.year = excluded.year then document_counters.next_value else 1 end,
        updated_at = now();

  update public.document_counters
  set next_value = next_value + 1,
      updated_at = now()
  where prefix = k
  returning next_value - 1 into v;

  return format('%s-%s-%s', k, y, lpad(v::text, 4, '0'));
end;
$$;

create index if not exists idx_tickets_status_created on public.tickets(status, created_at desc);
create index if not exists idx_tickets_created on public.tickets(created_at desc);
create index if not exists idx_tickets_kategorie on public.tickets(kategorie);
create index if not exists idx_tickets_plz on public.tickets(plz);
create index if not exists idx_tickets_termin on public.tickets(terminwunsch);
create index if not exists idx_ticket_events_ticket on public.ticket_events(ticket_id, created_at desc);
create index if not exists idx_analytics_created on public.analytics_events(created_at desc);
create index if not exists idx_analytics_ticket on public.analytics_events(ticket_id);

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;


