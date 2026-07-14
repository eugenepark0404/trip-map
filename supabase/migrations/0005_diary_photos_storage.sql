-- storage bucket for diary photos. private (not public) — access is gated by RLS on
-- storage.objects below, same map-membership rule as everything else, so photos require an
-- authenticated request from a map member (served via signed URLs from the client).
-- object path convention: `${mapId}/${diaryId}/${filename}`.

insert into storage.buckets (id, name, public)
values ('diary-photos', 'diary-photos', false)
on conflict (id) do nothing;

create policy diary_photos_storage_select on storage.objects
  for select using (
    bucket_id = 'diary-photos' and public.is_map_member((storage.foldername(name))[1]::uuid)
  );

create policy diary_photos_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'diary-photos' and public.is_map_member((storage.foldername(name))[1]::uuid)
  );

create policy diary_photos_storage_update on storage.objects
  for update using (
    bucket_id = 'diary-photos' and public.is_map_member((storage.foldername(name))[1]::uuid)
  );

create policy diary_photos_storage_delete on storage.objects
  for delete using (
    bucket_id = 'diary-photos' and public.is_map_member((storage.foldername(name))[1]::uuid)
  );
