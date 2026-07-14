-- extensions
create extension if not exists "pgcrypto";

-- =========================================
-- tables
-- =========================================

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '여행자',
  default_map_id uuid,
  created_at timestamptz not null default now()
);

create table maps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table profiles
  add constraint profiles_default_map_id_fkey
  foreign key (default_map_id) references maps (id) on delete set null;

create table map_members (
  map_id uuid not null references maps (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (map_id, user_id)
);

create table diaries (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references maps (id) on delete cascade,
  region_code text not null,
  date date not null,
  body text not null default '',
  satisfaction numeric(3, 1) check (satisfaction >= 0 and satisfaction <= 10),
  revisit boolean not null default false,
  created_by uuid not null references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table diary_photos (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references diaries (id) on delete cascade,
  storage_path text not null,
  is_representative boolean not null default false,
  placement jsonb,
  created_at timestamptz not null default now()
);

create table revisit_items (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references diaries (id) on delete cascade,
  text text not null,
  done boolean not null default false
);

create table favorites (
  map_id uuid not null references maps (id) on delete cascade,
  region_code text not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (map_id, region_code)
);

create table bucket_items (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references maps (id) on delete cascade,
  region_code text,
  title text not null,
  memo text,
  naver_url text,
  preview jsonb,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index diaries_map_id_region_code_idx on diaries (map_id, region_code);
create index diary_photos_diary_id_idx on diary_photos (diary_id);
create index revisit_items_diary_id_idx on revisit_items (diary_id);
create index map_members_user_id_idx on map_members (user_id);
create index bucket_items_map_id_idx on bucket_items (map_id);

-- =========================================
-- functions & triggers
-- =========================================

-- new auth.users row -> create matching profile
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', '여행자'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- new map -> owner becomes first map_member (bypasses RLS via security definer)
create function public.handle_new_map()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.map_members (map_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_map_created
  after insert on maps
  for each row execute function public.handle_new_map();

-- touch diaries.updated_at
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger diaries_set_updated_at
  before update on diaries
  for each row execute function public.set_updated_at();

-- membership check used by RLS policies (security definer avoids recursive RLS on map_members)
create function public.is_map_member(target_map_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from map_members
    where map_id = target_map_id and user_id = auth.uid()
  );
$$;

create function public.is_diary_member(target_diary_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from diaries d
    where d.id = target_diary_id and public.is_map_member(d.map_id)
  );
$$;

-- =========================================
-- row level security
-- =========================================

alter table profiles enable row level security;
alter table maps enable row level security;
alter table map_members enable row level security;
alter table diaries enable row level security;
alter table diary_photos enable row level security;
alter table revisit_items enable row level security;
alter table favorites enable row level security;
alter table bucket_items enable row level security;

-- profiles: read own profile, or profiles of people who share a map with you
create policy profiles_select on profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from map_members mine
      join map_members theirs on theirs.map_id = mine.map_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );

create policy profiles_update_own on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- maps: members can read; only the creator can insert/update/delete
create policy maps_select on maps
  for select using (public.is_map_member(id));

create policy maps_insert on maps
  for insert with check (owner_id = auth.uid());

create policy maps_update on maps
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy maps_delete on maps
  for delete using (owner_id = auth.uid());

-- map_members: members can see the roster; any member can invite (as 'member'); owner or self can remove
create policy map_members_select on map_members
  for select using (public.is_map_member(map_id));

create policy map_members_insert on map_members
  for insert with check (
    role = 'member' and public.is_map_member(map_id)
  );

create policy map_members_delete on map_members
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from map_members owner_row
      where owner_row.map_id = map_members.map_id
        and owner_row.user_id = auth.uid()
        and owner_row.role = 'owner'
    )
  );

-- diaries / photos / revisit items / favorites / bucket items:
-- any member of the map can read, create, update, delete
create policy diaries_all on diaries
  for all using (public.is_map_member(map_id)) with check (public.is_map_member(map_id));

create policy diary_photos_all on diary_photos
  for all using (public.is_diary_member(diary_id)) with check (public.is_diary_member(diary_id));

create policy revisit_items_all on revisit_items
  for all using (public.is_diary_member(diary_id)) with check (public.is_diary_member(diary_id));

create policy favorites_all on favorites
  for all using (public.is_map_member(map_id)) with check (public.is_map_member(map_id));

create policy bucket_items_all on bucket_items
  for all using (public.is_map_member(map_id)) with check (public.is_map_member(map_id));

-- =========================================
-- grants (RLS policies above still gate row-level access)
-- =========================================

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
