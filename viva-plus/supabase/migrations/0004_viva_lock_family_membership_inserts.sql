drop policy if exists viva_family_members_owner_insert on public.viva_family_members;
create policy viva_family_members_owner_insert on public.viva_family_members for insert to authenticated with check (user_id=(select auth.uid()) and role='owner' and exists(select 1 from public.viva_family_groups g where g.id=family_id and g.owner_id=(select auth.uid())));
