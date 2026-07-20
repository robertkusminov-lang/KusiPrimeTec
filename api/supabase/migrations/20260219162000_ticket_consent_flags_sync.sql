alter table if exists public.tickets
  add column if not exists datenschutz_akzeptiert boolean,
  add column if not exists agb_akzeptiert boolean,
  add column if not exists haftung_koordination_akzeptiert boolean,
  add column if not exists privacy_accepted boolean,
  add column if not exists terms_accepted boolean,
  add column if not exists liability_coordination_accepted boolean;

-- Historische Wizard-Tickets hatten bereits Pflicht-Checkboxen, konnten aber je nach Schema
-- nicht in die DB-Spalten geschrieben werden. Diese Datensaetze werden auf "true" gesetzt.
update public.tickets
set
  datenschutz_akzeptiert = coalesce(datenschutz_akzeptiert, privacy_accepted, true),
  agb_akzeptiert = coalesce(agb_akzeptiert, terms_accepted, true),
  haftung_koordination_akzeptiert = coalesce(haftung_koordination_akzeptiert, liability_coordination_accepted, true)
where
  datenschutz_akzeptiert is null
  or agb_akzeptiert is null
  or haftung_koordination_akzeptiert is null;

update public.tickets
set
  privacy_accepted = datenschutz_akzeptiert,
  terms_accepted = agb_akzeptiert,
  liability_coordination_accepted = haftung_koordination_akzeptiert
where
  privacy_accepted is distinct from datenschutz_akzeptiert
  or terms_accepted is distinct from agb_akzeptiert
  or liability_coordination_accepted is distinct from haftung_koordination_akzeptiert;

create or replace function public.sync_ticket_consent_fields()
returns trigger
language plpgsql
as $$
begin
  if new.datenschutz_akzeptiert is null and new.privacy_accepted is not null then
    new.datenschutz_akzeptiert := new.privacy_accepted;
  end if;
  if new.privacy_accepted is null and new.datenschutz_akzeptiert is not null then
    new.privacy_accepted := new.datenschutz_akzeptiert;
  end if;

  if new.agb_akzeptiert is null and new.terms_accepted is not null then
    new.agb_akzeptiert := new.terms_accepted;
  end if;
  if new.terms_accepted is null and new.agb_akzeptiert is not null then
    new.terms_accepted := new.agb_akzeptiert;
  end if;

  if new.haftung_koordination_akzeptiert is null and new.liability_coordination_accepted is not null then
    new.haftung_koordination_akzeptiert := new.liability_coordination_accepted;
  end if;
  if new.liability_coordination_accepted is null and new.haftung_koordination_akzeptiert is not null then
    new.liability_coordination_accepted := new.haftung_koordination_akzeptiert;
  end if;

  new.datenschutz_akzeptiert := coalesce(new.datenschutz_akzeptiert, false);
  new.agb_akzeptiert := coalesce(new.agb_akzeptiert, false);
  new.haftung_koordination_akzeptiert := coalesce(new.haftung_koordination_akzeptiert, false);
  new.privacy_accepted := new.datenschutz_akzeptiert;
  new.terms_accepted := new.agb_akzeptiert;
  new.liability_coordination_accepted := new.haftung_koordination_akzeptiert;

  return new;
end
$$;

drop trigger if exists trg_tickets_sync_consent_fields on public.tickets;
create trigger trg_tickets_sync_consent_fields
before insert or update of
  datenschutz_akzeptiert,
  agb_akzeptiert,
  haftung_koordination_akzeptiert,
  privacy_accepted,
  terms_accepted,
  liability_coordination_accepted
on public.tickets
for each row
execute function public.sync_ticket_consent_fields();

alter table public.tickets
  alter column datenschutz_akzeptiert set default false,
  alter column agb_akzeptiert set default false,
  alter column haftung_koordination_akzeptiert set default false,
  alter column privacy_accepted set default false,
  alter column terms_accepted set default false,
  alter column liability_coordination_accepted set default false;

alter table public.tickets
  alter column datenschutz_akzeptiert set not null,
  alter column agb_akzeptiert set not null,
  alter column haftung_koordination_akzeptiert set not null,
  alter column privacy_accepted set not null,
  alter column terms_accepted set not null,
  alter column liability_coordination_accepted set not null;
