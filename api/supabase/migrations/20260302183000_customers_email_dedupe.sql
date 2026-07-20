update public.customers
set email = lower(btrim(email))
where email is not null
  and email <> lower(btrim(email));

with normalized as (
  select
    id,
    lower(btrim(email)) as email_norm,
    first_value(id) over (
      partition by lower(btrim(email))
      order by created_at asc nulls last, id asc
    ) as keep_id,
    row_number() over (
      partition by lower(btrim(email))
      order by created_at asc nulls last, id asc
    ) as rn
  from public.customers
  where coalesce(btrim(email), '') <> ''
),
dupes as (
  select id, keep_id
  from normalized
  where rn > 1
)
update public.tickets t
set customer_id = d.keep_id
from dupes d
where t.customer_id = d.id
  and t.customer_id is distinct from d.keep_id;

with normalized as (
  select
    id,
    row_number() over (
      partition by lower(btrim(email))
      order by created_at asc nulls last, id asc
    ) as rn
  from public.customers
  where coalesce(btrim(email), '') <> ''
)
delete from public.customers c
using normalized n
where c.id = n.id
  and n.rn > 1;

create unique index if not exists uq_customers_email_norm
  on public.customers ((lower(btrim(email))))
  where coalesce(btrim(email), '') <> '';
