do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'customers_self_read_by_email_claim'
  ) then
    create policy customers_self_read_by_email_claim on public.customers
      for select
      to authenticated
      using (
        auth_user_id = auth.uid()
        or (
          auth_user_id is null
          and lower(btrim(coalesce(email, ''))) = lower(btrim(coalesce(auth.jwt()->>'email', '')))
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'customers_self_claim_update'
  ) then
    create policy customers_self_claim_update on public.customers
      for update
      to authenticated
      using (
        auth_user_id = auth.uid()
        or (
          auth_user_id is null
          and lower(btrim(coalesce(email, ''))) = lower(btrim(coalesce(auth.jwt()->>'email', '')))
        )
      )
      with check (auth_user_id = auth.uid());
  end if;
end
$$;

