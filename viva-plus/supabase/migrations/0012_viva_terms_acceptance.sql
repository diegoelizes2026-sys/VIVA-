alter table public.viva_profiles
  add column if not exists terms_of_use_version text,
  add column if not exists privacy_policy_version text,
  add column if not exists terms_accepted_at timestamptz;

create or replace function public.viva_handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  is_viva boolean := coalesce(new.raw_user_meta_data->>'app_source', '') = 'viva_plus';
  accepted_at timestamptz;
begin
  if is_viva then
    if coalesce(new.raw_user_meta_data->>'terms_and_privacy_accepted','false') <> 'true'
       or coalesce(new.raw_user_meta_data->>'terms_of_use_version','') = ''
       or coalesce(new.raw_user_meta_data->>'privacy_policy_version','') = ''
       or coalesce(new.raw_user_meta_data->>'terms_accepted_at','') = '' then
      raise exception 'VIVA_TERMS_ACCEPTANCE_REQUIRED' using errcode = '23514';
    end if;
    begin
      accepted_at := (new.raw_user_meta_data->>'terms_accepted_at')::timestamptz;
    exception when others then
      raise exception 'VIVA_TERMS_ACCEPTANCE_INVALID' using errcode = '23514';
    end;
    insert into public.viva_profiles(id,full_name,terms_of_use_version,privacy_policy_version,terms_accepted_at)
    values(new.id,new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'terms_of_use_version',new.raw_user_meta_data->>'privacy_policy_version',accepted_at)
    on conflict(id) do update set
      full_name=coalesce(public.viva_profiles.full_name,excluded.full_name),
      terms_of_use_version=excluded.terms_of_use_version,
      privacy_policy_version=excluded.privacy_policy_version,
      terms_accepted_at=excluded.terms_accepted_at,
      updated_at=now();
  end if;
  return new;
end;
$$;

create or replace function public.viva_profile_on_signup()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.viva_profiles(id,username,account_status,terms_of_use_version,privacy_policy_version,terms_accepted_at)
  values(
    new.id,public.viva_make_username(new.email,new.id),'active',
    case when coalesce(new.raw_user_meta_data->>'app_source','')='viva_plus' then new.raw_user_meta_data->>'terms_of_use_version' end,
    case when coalesce(new.raw_user_meta_data->>'app_source','')='viva_plus' then new.raw_user_meta_data->>'privacy_policy_version' end,
    case when coalesce(new.raw_user_meta_data->>'app_source','')='viva_plus' then nullif(new.raw_user_meta_data->>'terms_accepted_at','')::timestamptz end
  )
  on conflict(id) do nothing;
  return new;
end;
$$;