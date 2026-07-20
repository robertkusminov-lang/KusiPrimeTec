create or replace function public.analytics_visitors_per_day()
returns table(label text, value integer)
language sql
stable
as $$
  select to_char(created_at::date, 'YYYY-MM-DD') as label, count(*)::integer as value
  from public.analytics_events
  where created_at >= (now() - interval '30 days')
  group by created_at::date
  order by created_at::date;
$$;

create or replace function public.analytics_funnel()
returns table(label text, value integer)
language sql
stable
as $$
  select step as label, count(*)::integer as value
  from public.analytics_events
  where event_name in ('wizard_step', 'wizard_submit')
  group by step
  order by step;
$$;

create or replace function public.analytics_categories()
returns table(label text, value integer)
language sql
stable
as $$
  select kategorie as label, count(*)::integer as value
  from public.tickets
  group by kategorie
  order by count(*) desc;
$$;

create or replace function public.analytics_plz()
returns table(label text, value integer)
language sql
stable
as $$
  select plz as label, count(*)::integer as value
  from public.tickets
  group by plz
  order by count(*) desc;
$$;

insert into public.admin_users (email, full_name, is_active)
values
  ('info@kusiprimetec.de', 'Robert Kusminov', true),
  ('robertkusminov@gmail.com', 'Robert Kusminov', true)
on conflict (email) do update
set full_name = excluded.full_name,
    is_active = true;


