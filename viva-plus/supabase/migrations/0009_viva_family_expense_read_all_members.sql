drop policy if exists viva_family_expenses_member_all on public.viva_family_expenses;
drop policy if exists viva_family_expenses_member_read on public.viva_family_expenses;
drop policy if exists viva_family_expenses_member_insert on public.viva_family_expenses;
drop policy if exists viva_family_expenses_manage_own on public.viva_family_expenses;
create policy viva_family_expenses_member_read on public.viva_family_expenses for select to authenticated
using (public.viva_is_family_member(family_id));
create policy viva_family_expenses_member_insert on public.viva_family_expenses for insert to authenticated
with check (
 public.viva_is_family_member(family_id)
 and created_by=(select auth.uid())
 and (responsible_user_id is null or exists(select 1 from public.viva_family_members m where m.family_id=family_id and m.user_id=responsible_user_id))
);
create policy viva_family_expenses_manage_own on public.viva_family_expenses for update to authenticated
using (
 public.viva_is_family_member(family_id)
 and (created_by=(select auth.uid()) or exists(select 1 from public.viva_family_groups g where g.id=family_id and g.owner_id=(select auth.uid())))
)
with check (
 public.viva_is_family_member(family_id)
 and (created_by=(select auth.uid()) or exists(select 1 from public.viva_family_groups g where g.id=family_id and g.owner_id=(select auth.uid())))
 and (responsible_user_id is null or exists(select 1 from public.viva_family_members m where m.family_id=family_id and m.user_id=responsible_user_id))
);
create policy viva_family_expenses_delete_own on public.viva_family_expenses for delete to authenticated
using (
 public.viva_is_family_member(family_id)
 and (created_by=(select auth.uid()) or exists(select 1 from public.viva_family_groups g where g.id=family_id and g.owner_id=(select auth.uid())))
);
