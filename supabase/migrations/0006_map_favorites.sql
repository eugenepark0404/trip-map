-- per-member favorite flag, so a user can pin their frequently-used maps to the top of their
-- own map list. personal preference, not shared — lives on map_members, not maps.

alter table map_members add column is_favorite boolean not null default false;

create policy map_members_update_own on map_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
