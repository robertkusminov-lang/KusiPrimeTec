create extension if not exists pgcrypto;

create table if not exists public.price_catalog_items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text null,
  unit text not null default 'pauschal',
  unit_price numeric(12,2) not null,
  tax_rate numeric(5,2) null,
  active boolean not null default true,
  rules jsonb not null default '{}'::jsonb,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_price_catalog_items_touch on public.price_catalog_items;
create trigger trg_price_catalog_items_touch
before update on public.price_catalog_items
for each row execute procedure public.touch_updated_at();

insert into public.price_catalog_items (code, name, category, unit, unit_price, tax_rate, active, rules, source)
values
  ('LABOR_HOURLY_80', 'Stundensatz Technischer Service', 'service', 'stunde', 80, 0, true, '{"rounding":"full_started_hour"}'::jsonb, 'business_rules'),
  ('SERVICE_CALL_FLAT_39', 'Einsatzpauschale', 'service', 'einsatz', 39, 0, true, '{}'::jsonb, 'business_rules'),
  ('SURCHARGE_WD_AFTER_17_PCT', 'Zuschlag Mo-Fr nach 17:00', 'surcharge', 'prozent', 20, 0, true, '{"kind":"percentage"}'::jsonb, 'business_rules'),
  ('SURCHARGE_SAT_PCT', 'Zuschlag Samstag', 'surcharge', 'prozent', 35, 0, true, '{"kind":"percentage"}'::jsonb, 'business_rules'),
  ('SURCHARGE_SUN_HOLIDAY_PCT', 'Zuschlag Sonntag/Feiertag', 'surcharge', 'prozent', 100, 0, true, '{"kind":"percentage"}'::jsonb, 'business_rules'),
  ('PROJECT_COORDINATION_15_PCT', 'Projektkoordination Basis', 'coordination', 'prozent', 15, 0, true, '{"kind":"percentage"}'::jsonb, 'business_rules'),
  ('PROJECT_COORDINATION_20_PCT', 'Projektkoordination Komplex', 'coordination', 'prozent', 20, 0, true, '{"kind":"percentage"}'::jsonb, 'business_rules')
on conflict (code) do update
set
  name = excluded.name,
  category = excluded.category,
  unit = excluded.unit,
  unit_price = excluded.unit_price,
  tax_rate = excluded.tax_rate,
  active = excluded.active,
  rules = excluded.rules,
  source = excluded.source,
  updated_at = now();

create index if not exists idx_price_catalog_items_active
  on public.price_catalog_items(active, category, code);

create table if not exists public.ops_agent_runs (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid null references public.tickets(id) on delete set null,
  intent text not null,
  risk_level text not null,
  requires_approval boolean not null default true,
  actor text not null default 'ops-agent',
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ops_agent_runs_ticket_created
  on public.ops_agent_runs(ticket_id, created_at desc);

create index if not exists idx_ops_agent_runs_created
  on public.ops_agent_runs(created_at desc);

alter table public.price_catalog_items enable row level security;
alter table public.ops_agent_runs enable row level security;

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_admin_email'
  ) then
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'price_catalog_items'
        and policyname = 'price_catalog_items_admin_all'
    ) then
      create policy price_catalog_items_admin_all on public.price_catalog_items
      for all to authenticated
      using (public.is_admin_email())
      with check (public.is_admin_email());
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'ops_agent_runs'
        and policyname = 'ops_agent_runs_admin_all'
    ) then
      create policy ops_agent_runs_admin_all on public.ops_agent_runs
      for all to authenticated
      using (public.is_admin_email())
      with check (public.is_admin_email());
    end if;
  end if;
end
$$;
