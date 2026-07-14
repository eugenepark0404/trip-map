-- a diary can now cover multiple regions (e.g. one trip touching several split districts).
-- the representative photo's clip shape is the union of all of a diary's regions, which the
-- client renders as a single SVG <clipPath> containing one <path> per region (SVG clips to the
-- union of a clipPath's children natively, so no server-side geometry merging is needed).

create table diary_regions (
  diary_id uuid not null references diaries (id) on delete cascade,
  region_code text not null,
  primary key (diary_id, region_code)
);

create index diary_regions_region_code_idx on diary_regions (region_code);

alter table diary_regions enable row level security;

create policy diary_regions_all on diary_regions
  for all using (public.is_diary_member(diary_id)) with check (public.is_diary_member(diary_id));

grant select, insert, update, delete on diary_regions to anon, authenticated;

drop index if exists diaries_map_id_region_code_idx;
alter table diaries drop column region_code;
