do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'customers_self_insert'
  ) then
    create policy customers_self_insert on public.customers
      for insert
      to authenticated
      with check (auth.uid() = auth_user_id);
  end if;
end
$$;

