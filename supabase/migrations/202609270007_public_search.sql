create table public.exercise_search (
  exercise_id uuid primary key references public.exercises(id) on delete cascade,
  content_id uuid not null references public.exercise_content(id) on delete restrict,
  name text not null,
  normalized_name text not null,
  aliases_text text not null default '',
  description_text text not null default '',
  search_vector tsvector generated always as (
    setweight(to_tsvector('english'::regconfig, name), 'A') ||
    setweight(to_tsvector('english'::regconfig, aliases_text), 'B') ||
    setweight(to_tsvector('english'::regconfig, description_text), 'C')
  ) stored
);
create index exercise_search_name_idx on public.exercise_search (normalized_name, exercise_id);
create index exercise_search_name_trgm_idx on public.exercise_search using gin (normalized_name extensions.gin_trgm_ops);
create index exercise_search_vector_idx on public.exercise_search using gin (search_vector);

create or replace function private.refresh_exercise_search()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.status <> 'published' then
    delete from public.exercise_search where exercise_id = new.id;
    return new;
  end if;

  insert into public.exercise_search (
    exercise_id, content_id, name, normalized_name, aliases_text, description_text
  )
  select new.id, c.id, c.name,
    lower(regexp_replace(btrim(c.name), '[^[:alnum:]]+', ' ', 'g')),
    coalesce((select string_agg(a.alias, ' ') from public.exercise_aliases a where a.content_id = c.id), ''),
    coalesce(c.short_description, '')
  from public.exercise_content c
  where c.id = new.current_content_id
  on conflict (exercise_id) do update set
    content_id = excluded.content_id,
    name = excluded.name,
    normalized_name = excluded.normalized_name,
    aliases_text = excluded.aliases_text,
    description_text = excluded.description_text;
  return new;
end;
$$;

create trigger refresh_exercise_search
after insert or update of status, current_content_id on public.exercises
for each row execute function private.refresh_exercise_search();

alter table public.exercise_search enable row level security;
revoke all on public.exercise_search from anon, authenticated;
grant select on public.exercise_search to anon, authenticated;
create policy published_search_read on public.exercise_search for select to anon, authenticated
  using (exists (
    select 1 from public.exercises e
    where e.id = exercise_id and e.status = 'published'
  ));

create or replace function public.explore_exercises(
  search_text text default null,
  muscle_slugs text[] default '{}',
  joint_slugs text[] default '{}',
  joint_action_slugs text[] default '{}',
  equipment_slugs text[] default '{}',
  resistance_profiles public.resistance_profile[] default '{}',
  sort_key text default 'alphabetical',
  cursor_name text default null,
  cursor_published_at timestamptz default null,
  cursor_favorite_count integer default null,
  cursor_id uuid default null,
  page_size integer default 24
)
returns table (
  exercise_id uuid,
  content_id uuid,
  slug text,
  name text,
  short_description text,
  family_slug text,
  favorite_count integer,
  published_at timestamptz,
  normalized_name text
)
language plpgsql stable security invoker
set search_path = ''
as $$
begin
  if sort_key not in ('alphabetical', 'newest', 'most_favorited') then
    raise exception 'invalid sort key';
  end if;
  if length(coalesce(search_text, '')) > 100 then
    raise exception 'search text is too long';
  end if;
  if cardinality(muscle_slugs) > 20 or cardinality(joint_slugs) > 20
     or cardinality(joint_action_slugs) > 20 or cardinality(equipment_slugs) > 20
     or cardinality(resistance_profiles) > 20 then
    raise exception 'too many selected filters';
  end if;

  return query
  select e.id, c.id, e.slug, s.name, c.short_description, f.slug,
    e.favorite_count, e.published_at, s.normalized_name
  from public.exercises e
  join public.exercise_search s on s.exercise_id = e.id
  join public.exercise_content c on c.id = e.current_content_id
  left join public.exercise_families f on f.id = c.family_id
  where e.status = 'published'
    and (
      nullif(btrim(search_text), '') is null
      or s.search_vector @@ websearch_to_tsquery('english'::regconfig, search_text)
      or s.normalized_name OPERATOR(extensions.%) lower(btrim(search_text))
      or exists (
        select 1 from public.exercise_aliases a
        where a.content_id = c.id and a.normalized_alias OPERATOR(extensions.%) lower(btrim(search_text))
      )
    )
    and not exists (
      select 1 from unnest(muscle_slugs) wanted(slug)
      where not exists (
        select 1 from public.exercise_muscles em
        join public.muscles m on m.id = em.muscle_id
        where em.content_id = c.id and m.slug = wanted.slug
      )
    )
    and not exists (
      select 1 from unnest(joint_slugs) wanted(slug)
      where not exists (
        select 1 from public.exercise_joints ej
        join public.joints j on j.id = ej.joint_id
        where ej.content_id = c.id and j.slug = wanted.slug
      )
    )
    and not exists (
      select 1 from unnest(joint_action_slugs) wanted(slug)
      where not exists (
        select 1 from public.exercise_joint_actions eja
        join public.joint_actions ja on ja.id = eja.joint_action_id
        where eja.content_id = c.id and ja.slug = wanted.slug
      )
    )
    and not exists (
      select 1 from unnest(equipment_slugs) wanted(slug)
      where not exists (
        select 1 from public.exercise_equipment ee
        join public.equipment q on q.id = ee.equipment_id
        where ee.content_id = c.id and q.slug = wanted.slug
      )
    )
    and (cardinality(resistance_profiles) = 0 or exists (
      select 1 from public.exercise_biomechanics b
      where b.content_id = c.id and b.resistance_profile = any(resistance_profiles)
    ))
    and (
      cursor_id is null
      or (sort_key = 'alphabetical' and cursor_name is not null
          and (s.normalized_name, e.id) > (cursor_name, cursor_id))
      or (sort_key = 'newest' and cursor_published_at is not null
          and (e.published_at, e.id) < (cursor_published_at, cursor_id))
      or (sort_key = 'most_favorited' and cursor_favorite_count is not null
          and (e.favorite_count, e.id) < (cursor_favorite_count, cursor_id))
    )
  order by
    case when sort_key = 'alphabetical' then s.normalized_name end asc,
    case when sort_key = 'alphabetical' then e.id end asc,
    case when sort_key = 'newest' then e.published_at end desc,
    case when sort_key = 'newest' then e.id end desc,
    case when sort_key = 'most_favorited' then e.favorite_count end desc,
    case when sort_key = 'most_favorited' then e.id end desc
  limit least(greatest(page_size, 1), 50) + 1;
end;
$$;

revoke all on function public.explore_exercises(
  text, text[], text[], text[], text[], public.resistance_profile[],
  text, text, timestamptz, integer, uuid, integer
) from public;
grant execute on function public.explore_exercises(
  text, text[], text[], text[], text[], public.resistance_profile[],
  text, text, timestamptz, integer, uuid, integer
) to anon, authenticated;
