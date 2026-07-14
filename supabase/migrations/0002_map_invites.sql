-- invite an existing user to a map by email (email lives in auth.users, not exposed to clients directly)
create function public.invite_member_by_email(p_map_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  if not public.is_map_member(p_map_id) then
    raise exception '해당 지도의 참여자만 친구를 초대할 수 있습니다.';
  end if;

  select id into target_user_id from auth.users where email = p_email;

  if target_user_id is null then
    raise exception '가입된 사용자를 찾을 수 없습니다.';
  end if;

  insert into public.map_members (map_id, user_id, role)
  values (p_map_id, target_user_id, 'member')
  on conflict (map_id, user_id) do nothing;
end;
$$;

revoke execute on function public.invite_member_by_email(uuid, text) from public;
grant execute on function public.invite_member_by_email(uuid, text) to authenticated;
