-- the owner must be able to see their own map immediately after INSERT ... RETURNING,
-- before the on_map_created trigger's map_members row is visible to the select check
drop policy maps_select on maps;

create policy maps_select on maps
  for select using (public.is_map_member(id) or owner_id = auth.uid());
