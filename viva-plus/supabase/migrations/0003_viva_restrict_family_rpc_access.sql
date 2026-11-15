revoke execute on function public.viva_is_family_member(uuid) from anon;
revoke execute on function public.viva_join_family(text) from anon;
grant execute on function public.viva_is_family_member(uuid) to authenticated;
grant execute on function public.viva_join_family(text) to authenticated;
