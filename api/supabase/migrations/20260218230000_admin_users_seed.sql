insert into public.admin_users (email, full_name, is_active)
values
  ('info@kusiprimetec.de', 'Robert Kusminov', true),
  ('robertkusminov@gmail.com', 'Robert Kusminov', true)
on conflict (email) do update
set full_name = excluded.full_name,
    is_active = true;
