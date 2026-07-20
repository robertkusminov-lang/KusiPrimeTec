do $$
declare
  r record;
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'tickets'
  ) then
    return;
  end if;

  -- Wichtig: alte Status-Checks zuerst entfernen, sonst blockieren sie die Normalisierung.
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'tickets'
      and c.contype = 'c'
      and (
        c.conname in ('check_status', 'tickets_status_check')
        or pg_get_constraintdef(c.oid) ilike '%status%'
      )
  loop
    execute format('alter table public.tickets drop constraint if exists %I', r.conname);
  end loop;

  update public.tickets
  set status = case
    when status is null or btrim(status) = '' then 'Neu'
    when lower(btrim(status)) in ('neu', 'new') then 'Neu'
    when lower(btrim(status)) in ('geprueft', 'gepruft', 'geprüft') then 'Geprueft'
    when lower(btrim(status)) in ('rueckfrage_kunde', 'rueckfrage kunde', 'rückfrage kunde', 'wartet auf kunde', 'wartet_auf_kunde') then 'Rueckfrage_Kunde'
    when lower(btrim(status)) in ('termin_geplant', 'termin geplant', 'geplant') then 'Termin_geplant'
    when lower(btrim(status)) in ('in_arbeit', 'in arbeit', 'in_bearbeitung', 'in bearbeitung', 'inprogress', 'in_progress', 'in progress') then 'In_Arbeit'
    when lower(btrim(status)) in ('angebot_erstellt', 'angebot erstellt') then 'Angebot_erstellt'
    when lower(btrim(status)) in ('angebot_gesendet', 'angebot gesendet') then 'Angebot_gesendet'
    when lower(btrim(status)) in ('angebot_angenommen', 'angebot angenommen') then 'Angebot_angenommen'
    when lower(btrim(status)) in ('rapport_erstellt', 'rapport erstellt') then 'Rapport_erstellt'
    when lower(btrim(status)) in ('rechnung_erstellt', 'rechnung erstellt') then 'Rechnung_erstellt'
    when lower(btrim(status)) in ('rechnung_gesendet', 'rechnung gesendet') then 'Rechnung_gesendet'
    when lower(btrim(status)) in ('bezahlt', 'abgeschlossen', 'erledigt', 'done') then 'Bezahlt'
    when lower(btrim(status)) in ('storniert', 'abgebrochen', 'cancelled') then 'Storniert'
    else 'Neu'
  end;

  alter table public.tickets drop constraint if exists tickets_status_check;

  alter table public.tickets
    add constraint tickets_status_check
    check (
      status in (
        'Neu','Geprueft','Rueckfrage_Kunde','Termin_geplant','In_Arbeit',
        'Angebot_erstellt','Angebot_gesendet','Angebot_angenommen',
        'Rapport_erstellt','Rechnung_erstellt','Rechnung_gesendet',
        'Bezahlt','Storniert'
      )
    );
end
$$;

create index if not exists idx_tickets_status_created on public.tickets(status, created_at desc);
