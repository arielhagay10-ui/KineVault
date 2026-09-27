drop function public.explore_exercises(
  text, text[], text[], text[], text[], public.resistance_profile[],
  text, text, timestamptz, integer, uuid, integer
);

create function public.explore_exercises(
  search_text text default null,
  muscle_slugs text[] default '{}',
  primary_muscle_slugs text[] default '{}',
  secondary_muscle_slugs text[] default '{}',
  stabilizer_muscle_slugs text[] default '{}',
  joint_slugs text[] default '{}',
  joint_action_slugs text[] default '{}',
  family_slugs text[] default '{}',
  movement_pattern_slugs text[] default '{}',
  plane_slugs text[] default '{}',
  mechanic_values public.exercise_mechanic[] default '{}',
  force_type_values public.force_type[] default '{}',
  laterality_values public.laterality[] default '{}',
  equipment_category_slugs text[] default '{}',
  equipment_slugs text[] default '{}',
  attachment_slugs text[] default '{}',
  resistance_source_slugs text[] default '{}',
  resistance_profiles public.resistance_profile[] default '{}',
  peak_resistance_positions public.peak_resistance_position[] default '{}',
  body_position_slugs text[] default '{}',
  difficulty_values public.exercise_difficulty[] default '{}',
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
  if greatest(
    cardinality(muscle_slugs), cardinality(primary_muscle_slugs),
    cardinality(secondary_muscle_slugs), cardinality(stabilizer_muscle_slugs),
    cardinality(joint_slugs), cardinality(joint_action_slugs),
    cardinality(family_slugs), cardinality(movement_pattern_slugs),
    cardinality(plane_slugs), cardinality(mechanic_values),
    cardinality(force_type_values), cardinality(laterality_values),
    cardinality(equipment_category_slugs), cardinality(equipment_slugs),
    cardinality(attachment_slugs), cardinality(resistance_source_slugs),
    cardinality(resistance_profiles), cardinality(peak_resistance_positions),
    cardinality(body_position_slugs), cardinality(difficulty_values)
  ) > 20 then
    raise exception 'too many selected filters';
  end if;

  return query
  with recursive equipment_descendants(root_slug, equipment_id) as (
    select q.slug, q.id from public.equipment q
    where q.slug = any(equipment_slugs)
    union all
    select d.root_slug, child.id
    from public.equipment child
    join equipment_descendants d on child.parent_id = d.equipment_id
  ), family_descendants(root_slug, family_id) as (
    select f.slug, f.id from public.exercise_families f
    where f.slug = any(family_slugs)
    union all
    select d.root_slug, child.id
    from public.exercise_families child
    join family_descendants d on child.parent_id = d.family_id
  )
  select e.id, c.id, e.slug, s.name, c.short_description, f.slug,
    e.favorite_count, e.published_at, s.normalized_name
  from public.exercises e
  join public.exercise_search s on s.exercise_id = e.id
  join public.exercise_content c on c.id = e.current_content_id
  left join public.exercise_families f on f.id = c.family_id
  left join public.exercise_biomechanics b on b.content_id = c.id
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
      select 1 from unnest(primary_muscle_slugs) wanted(slug)
      where not exists (
        select 1 from public.exercise_muscles em
        join public.muscles m on m.id = em.muscle_id
        where em.content_id = c.id and em.role = 'primary' and m.slug = wanted.slug
      )
    )
    and not exists (
      select 1 from unnest(secondary_muscle_slugs) wanted(slug)
      where not exists (
        select 1 from public.exercise_muscles em
        join public.muscles m on m.id = em.muscle_id
        where em.content_id = c.id and em.role = 'secondary' and m.slug = wanted.slug
      )
    )
    and not exists (
      select 1 from unnest(stabilizer_muscle_slugs) wanted(slug)
      where not exists (
        select 1 from public.exercise_muscles em
        join public.muscles m on m.id = em.muscle_id
        where em.content_id = c.id and em.role = 'stabilizer' and m.slug = wanted.slug
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
      select 1 from unnest(family_slugs) wanted(slug)
      where not exists (
        select 1 from family_descendants d
        where d.root_slug = wanted.slug and d.family_id = c.family_id
      )
    )
    and not exists (
      select 1 from unnest(movement_pattern_slugs) wanted(slug)
      where not exists (
        select 1 from public.exercise_movement_patterns emp
        join public.movement_patterns mp on mp.id = emp.movement_pattern_id
        where emp.content_id = c.id and mp.slug = wanted.slug
      )
    )
    and not exists (
      select 1 from unnest(plane_slugs) wanted(slug)
      where not exists (
        select 1 from public.planes_of_motion p
        where p.id = b.plane_id and p.slug = wanted.slug
      )
    )
    and not exists (select 1 from unnest(mechanic_values) wanted(value)
                    where c.mechanic is distinct from wanted.value)
    and not exists (select 1 from unnest(force_type_values) wanted(value)
                    where c.force_type is distinct from wanted.value)
    and not exists (select 1 from unnest(laterality_values) wanted(value)
                    where c.laterality is distinct from wanted.value)
    and not exists (
      select 1 from unnest(equipment_category_slugs) wanted(slug)
      where not exists (
        select 1 from public.exercise_equipment ee
        join public.equipment q on q.id = ee.equipment_id
        join public.equipment_categories ec on ec.id = q.category_id
        where ee.content_id = c.id and ec.slug = wanted.slug
      )
    )
    and not exists (
      select 1 from unnest(equipment_slugs) wanted(slug)
      where not exists (
        select 1 from public.exercise_equipment ee
        join equipment_descendants d on d.equipment_id = ee.equipment_id
        where ee.content_id = c.id and d.root_slug = wanted.slug
      )
    )
    and not exists (
      select 1 from unnest(attachment_slugs) wanted(slug)
      where not exists (
        select 1 from public.exercise_attachments ea
        join public.attachments a on a.id = ea.attachment_id
        where ea.content_id = c.id and a.slug = wanted.slug
      )
    )
    and not exists (
      select 1 from unnest(resistance_source_slugs) wanted(slug)
      where not exists (
        select 1 from public.resistance_sources rs
        where rs.id = b.resistance_source_id and rs.slug = wanted.slug
      )
    )
    and not exists (select 1 from unnest(resistance_profiles) wanted(value)
                    where b.resistance_profile is distinct from wanted.value)
    and not exists (select 1 from unnest(peak_resistance_positions) wanted(value)
                    where b.peak_resistance_position is distinct from wanted.value)
    and not exists (
      select 1 from unnest(body_position_slugs) wanted(slug)
      where not exists (
        select 1 from public.body_positions bp
        where bp.id = b.body_position_id and bp.slug = wanted.slug
      )
    )
    and not exists (select 1 from unnest(difficulty_values) wanted(value)
                    where c.difficulty is distinct from wanted.value)
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
  text, text[], text[], text[], text[], text[], text[], text[], text[], text[],
  public.exercise_mechanic[], public.force_type[], public.laterality[],
  text[], text[], text[], text[], public.resistance_profile[],
  public.peak_resistance_position[], text[], public.exercise_difficulty[],
  text, text, timestamptz, integer, uuid, integer
) from public;
grant execute on function public.explore_exercises(
  text, text[], text[], text[], text[], text[], text[], text[], text[], text[],
  public.exercise_mechanic[], public.force_type[], public.laterality[],
  text[], text[], text[], text[], public.resistance_profile[],
  public.peak_resistance_position[], text[], public.exercise_difficulty[],
  text, text, timestamptz, integer, uuid, integer
) to anon, authenticated;
