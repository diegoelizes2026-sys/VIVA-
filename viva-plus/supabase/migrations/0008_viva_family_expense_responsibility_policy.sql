drop policy if exists viva_family_expenses_member_all on public.viva_family_expenses;
create policy viva_family_expenses_member_all on public.viva_family_expenses for all to authenticated
using (
 public.viva_is_family_member(family_id)
 and (created_by=(select auth.uid()) or exists(select 1 from public.viva_family_groups g where g.id=family_id and g.owner_id=(select auth.uid())))
)
with check (
 public.viva_is_family_member(family_id)
 and (created_by=(select auth.uid()) or exists(select 1 from public.viva_family_groups g where g.id=family_id and g.owner_id=(select auth.uid())))
 and (responsible_user_id is null or exists(select 1 from public.viva_family_members m where m.family_id=family_id and m.user_id=responsible_user_id))
);
