drop policy if exists viva_card_purchases_owner on public.viva_card_purchases;
create policy viva_card_purchases_owner on public.viva_card_purchases for all to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.viva_credit_cards c where c.id=card_id and c.user_id=(select auth.uid())))
with check (user_id=(select auth.uid()) and exists(select 1 from public.viva_credit_cards c where c.id=card_id and c.user_id=(select auth.uid())));
drop policy if exists viva_habit_logs_owner on public.viva_habit_logs;
create policy viva_habit_logs_owner on public.viva_habit_logs for all to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.viva_habits h where h.id=habit_id and h.user_id=(select auth.uid())))
with check (user_id=(select auth.uid()) and exists(select 1 from public.viva_habits h where h.id=habit_id and h.user_id=(select auth.uid())));
