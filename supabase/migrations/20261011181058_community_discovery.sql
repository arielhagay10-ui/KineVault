-- Authenticated, distinct people are useful signals; refreshes and self-views are not.
alter table public.exercises
  add column view_count integer not null default 0 check (view_count >= 0),
  add column use_count integer not null default 0 check (use_count >= 0),
  add column discovery_score double precision generated always as (
    (case when verified_at is not null then 6.0 else 0.0 end)
      + 3.0 * ln(1.0 + favorite_count) + 2.0 * ln(1.0 + use_count)
      + 0.25 * ln(1.0 + view_count)
  ) stored;
create index exercises_recommended_idx on public.exercises(discovery_score desc,published_at desc,id desc)
  where status = 'published';

create table public.exercise_engagement (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  kind text not null check (kind in ('view','use')),
  created_at timestamptz not null default now(),
  unique(user_id,exercise_id,kind)
);
create index exercise_engagement_exercise_idx on public.exercise_engagement(exercise_id,kind);
alter table public.exercise_engagement enable row level security;
revoke all on public.exercise_engagement from public,anon,authenticated;
grant select on public.exercise_engagement to authenticated;
create policy exercise_engagement_read_own on public.exercise_engagement for select to authenticated
  using (user_id = (select auth.uid()));

create function private.update_engagement_counts()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_id uuid; event_kind text; delta integer;
begin
  if tg_op = 'INSERT' then target_id := new.exercise_id; event_kind := new.kind; delta := 1;
  else target_id := old.exercise_id; event_kind := old.kind; delta := -1; end if;
  update public.exercises set
    view_count = view_count + case when event_kind = 'view' then delta else 0 end,
    use_count = use_count + case when event_kind = 'use' then delta else 0 end
  where id = target_id;
  return null;
end;
$$;
revoke all on function private.update_engagement_counts() from public,anon,authenticated;
create trigger exercise_engagement_counts after insert or delete on public.exercise_engagement
  for each row execute function private.update_engagement_counts();

create function private.protect_engagement_counts()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('postgres','supabase_admin') and
    (new.view_count is distinct from old.view_count or new.use_count is distinct from old.use_count) then
    raise exception 'engagement counters are maintained internally';
  end if;
  return new;
end;
$$;
revoke all on function private.protect_engagement_counts() from public,anon,authenticated;
create trigger exercise_engagement_counter_guard before update on public.exercises
  for each row execute function private.protect_engagement_counts();

create function public.record_exercise_engagement(p_exercise_id uuid,p_kind text)
returns void language plpgsql security definer set search_path = '' as $$
declare creator uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_kind is null or p_kind not in ('view','use') then raise exception 'invalid engagement kind'; end if;
  select created_by into creator from public.exercises where id = p_exercise_id and status = 'published' for update;
  if not found then raise exception 'published exercise required'; end if;
  if creator = auth.uid() then return; end if;
  if p_kind = 'use' and not exists(select 1 from public.private_exercises
    where owner_id = auth.uid() and copied_from_exercise_id = p_exercise_id) then
    raise exception 'copy the exercise before recording use';
  end if;
  insert into public.exercise_engagement(user_id,exercise_id,kind)
    values(auth.uid(),p_exercise_id,p_kind) on conflict(user_id,exercise_id,kind) do nothing;
end;
$$;
revoke all on function public.record_exercise_engagement(uuid,text) from public,anon;
grant execute on function public.record_exercise_engagement(uuid,text) to authenticated;

create function private.record_exercise_copy()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.copied_from_exercise_id is not null and new.owner_id = auth.uid() and exists (
    select 1 from public.exercises where id = new.copied_from_exercise_id and status = 'published'
      and created_by is distinct from new.owner_id
  ) then
    insert into public.exercise_engagement(user_id,exercise_id,kind)
      values(new.owner_id,new.copied_from_exercise_id,'use') on conflict(user_id,exercise_id,kind) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.record_exercise_copy() from public,anon,authenticated;
create trigger private_exercise_copy_engagement after insert on public.private_exercises
  for each row execute function private.record_exercise_copy();

-- Existing copies count once per person, excluding the original contributor.
insert into public.exercise_engagement(user_id,exercise_id,kind)
select distinct p.owner_id,p.copied_from_exercise_id,'use' from public.private_exercises p
  join public.exercises e on e.id = p.copied_from_exercise_id
where e.status = 'published' and e.created_by is distinct from p.owner_id
on conflict(user_id,exercise_id,kind) do nothing;

-- Preserve all normalized filters and explicit sorts; only recommendations use engagement.
drop function public.explore_exercises(text,text[],text[],text[],text[],text[],text[],text[],text[],text[],public.exercise_mechanic[],public.force_type[],public.laterality[],text[],text[],text[],text[],public.resistance_profile[],public.peak_resistance_position[],text[],public.exercise_difficulty[],text,text,timestamptz,integer,uuid,integer);
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
  sort_key text default 'recommended',
  cursor_name text default null,
  cursor_published_at timestamptz default null,
  cursor_favorite_count integer default null,
  cursor_id uuid default null,
  page_size integer default 24,
  cursor_score double precision default null
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
  normalized_name text,
  verified_at timestamptz,
  view_count integer,
  use_count integer,
  discovery_score double precision
)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  query_sql text;
  prefix_sql text := '';
  group_record record;
  selected text;
  order_sql text;
  normalized_query text;
  match_rank_sql text;
  cursor_match_rank integer;
begin
  if sort_key is null or sort_key not in ('recommended','alphabetical','newest','most_favorited') then raise exception 'invalid sort key'; end if;
  if length(coalesce(search_text,'')) > 100 then raise exception 'search text is too long'; end if;
  if greatest(cardinality(muscle_slugs),cardinality(primary_muscle_slugs),cardinality(secondary_muscle_slugs),
    cardinality(stabilizer_muscle_slugs),cardinality(joint_slugs),cardinality(joint_action_slugs),
    cardinality(family_slugs),cardinality(movement_pattern_slugs),cardinality(plane_slugs),
    cardinality(mechanic_values),cardinality(force_type_values),cardinality(laterality_values),
    cardinality(equipment_category_slugs),cardinality(equipment_slugs),cardinality(attachment_slugs),
    cardinality(resistance_source_slugs),cardinality(resistance_profiles),cardinality(peak_resistance_positions),
    cardinality(body_position_slugs),cardinality(difficulty_values)) > 20 then raise exception 'too many selected filters'; end if;

  -- Only selected filters enter the plan. All identifiers below are fixed by this
  -- function; user values are quoted with %L and never become SQL identifiers.
  query_sql := 'select e.id,c.id,e.slug,s.name,c.short_description,f.slug,e.favorite_count,e.published_at,s.normalized_name,e.verified_at,e.view_count,e.use_count,e.discovery_score
    from public.exercises e join public.exercise_search s on s.exercise_id = e.id
    join public.exercise_content c on c.id = e.current_content_id and c.kind = ''published_version''
    left join public.exercise_families f on f.id = c.family_id';
  if cardinality(plane_slugs) > 0 or cardinality(resistance_source_slugs) > 0 or cardinality(resistance_profiles) > 0
    or cardinality(peak_resistance_positions) > 0 or cardinality(body_position_slugs) > 0 then
    query_sql := query_sql || ' join public.exercise_biomechanics b on b.content_id = c.id';
  end if;
  if nullif(btrim(search_text),'') is not null then
    normalized_query := lower(regexp_replace(btrim(search_text),'[^[:alnum:]]+',' ','g'));
    prefix_sql := format('with candidates as (
      select exercise_id from public.exercise_search where search_vector @@ websearch_to_tsquery(''english''::regconfig,%L)
      union select exercise_id from public.exercise_search where normalized_name OPERATOR(extensions.%%) %L
      union select e.id from public.exercise_aliases a join public.exercises e on e.current_content_id = a.content_id
        where e.status = ''published'' and a.normalized_alias OPERATOR(extensions.%%) %L
    ) ',search_text,normalized_query,normalized_query);
    query_sql := query_sql || ' join candidates candidate on candidate.exercise_id = e.id';
    if sort_key in ('recommended','alphabetical') then
      match_rank_sql := format('case when s.normalized_name = %L then 0
        when exists(select 1 from public.exercise_aliases a where a.content_id = c.id
          and a.normalized_alias = %L) then 1 else 2 end',normalized_query,normalized_query);
    end if;
  end if;
  query_sql := query_sql || ' where e.status = ''published''';

  for group_record in select * from (values
    ('exercise_muscles','muscles','muscle_id',muscle_slugs,null::text),
    ('exercise_muscles','muscles','muscle_id',primary_muscle_slugs,'primary'),
    ('exercise_muscles','muscles','muscle_id',secondary_muscle_slugs,'secondary'),
    ('exercise_muscles','muscles','muscle_id',stabilizer_muscle_slugs,'stabilizer'),
    ('exercise_joints','joints','joint_id',joint_slugs,null::text),
    ('exercise_joint_actions','joint_actions','joint_action_id',joint_action_slugs,null::text),
    ('exercise_attachments','attachments','attachment_id',attachment_slugs,null::text),
    ('exercise_movement_patterns','movement_patterns','movement_pattern_id',movement_pattern_slugs,null::text)
  ) as groups(relation_table,taxonomy_table,id_column,slugs,role_name) loop
    foreach selected in array coalesce(group_record.slugs,'{}'::text[]) loop
      query_sql := query_sql || format(' and exists(select 1 from public.%I r where r.content_id = c.id
        and r.%I = (select id from public.%I where slug = %L)',group_record.relation_table,
        group_record.id_column,group_record.taxonomy_table,selected);
      if group_record.role_name is not null then query_sql := query_sql || format(' and r.role = %L',group_record.role_name); end if;
      query_sql := query_sql || ')';
    end loop;
  end loop;

  foreach selected in array coalesce(family_slugs,'{}'::text[]) loop
    query_sql := query_sql || format(' and c.family_id in(with recursive descendants as (
      select id from public.exercise_families where slug = %L
      union select child.id from public.exercise_families child join descendants parent on child.parent_id = parent.id
    ) select id from descendants)',selected);
  end loop;
  foreach selected in array coalesce(equipment_slugs,'{}'::text[]) loop
    query_sql := query_sql || format(' and exists(select 1 from public.exercise_equipment r where r.content_id = c.id
      and r.equipment_id in(with recursive descendants as (
        select id from public.equipment where slug = %L
        union select child.id from public.equipment child join descendants parent on child.parent_id = parent.id
      ) select id from descendants))',selected);
  end loop;
  foreach selected in array coalesce(equipment_category_slugs,'{}'::text[]) loop
    query_sql := query_sql || format(' and exists(select 1 from public.exercise_equipment r
      join public.equipment q on q.id = r.equipment_id where r.content_id = c.id
      and q.category_id in(with recursive descendants as (
        select id from public.equipment_categories where slug = %L
        union select child.id from public.equipment_categories child join descendants parent on child.parent_id = parent.id
      ) select id from descendants))',selected);
  end loop;
  for group_record in select * from (values
    ('plane_id','planes_of_motion',plane_slugs),('resistance_source_id','resistance_sources',resistance_source_slugs),
    ('body_position_id','body_positions',body_position_slugs)
  ) as groups(id_column,taxonomy_table,slugs) loop
    foreach selected in array coalesce(group_record.slugs,'{}'::text[]) loop
      query_sql := query_sql || format(' and b.%I = (select id from public.%I where slug = %L)',group_record.id_column,group_record.taxonomy_table,selected);
    end loop;
  end loop;
  for group_record in select * from (values
    ('c','mechanic',mechanic_values::text[]),('c','force_type',force_type_values::text[]),
    ('c','laterality',laterality_values::text[]),('c','difficulty',difficulty_values::text[]),
    ('b','resistance_profile',resistance_profiles::text[]),('b','peak_resistance_position',peak_resistance_positions::text[])
  ) as groups(table_alias,column_name,selected_values) loop
    foreach selected in array coalesce(group_record.selected_values,'{}'::text[]) loop
      query_sql := query_sql || format(' and %I.%I = %L',group_record.table_alias,group_record.column_name,selected);
    end loop;
  end loop;

  if cursor_id is not null then
    if sort_key = 'recommended' and cursor_score is not null and cursor_published_at is not null then
      if cursor_score < 0 or cursor_score > 1000000 or cursor_score = 'NaN'::double precision then
        raise exception 'invalid cursor';
      end if;
      if match_rank_sql is not null then
        select case when s.normalized_name = normalized_query then 0
          when exists(select 1 from public.exercise_aliases a where a.content_id = c.id
            and a.normalized_alias = normalized_query) then 1 else 2 end
        into cursor_match_rank
        from public.exercises e join public.exercise_search s on s.exercise_id = e.id
        join public.exercise_content c on c.id = e.current_content_id and c.kind = 'published_version'
        where e.id = cursor_id and e.status = 'published';
        if cursor_match_rank is null then raise exception 'invalid cursor'; end if;
        query_sql := query_sql || format(' and ((%s) > %s or ((%s) = %s and (e.discovery_score,e.published_at,e.id) < (%L::double precision,%L::timestamptz,%L::uuid)))',
          match_rank_sql,cursor_match_rank,match_rank_sql,cursor_match_rank,cursor_score,cursor_published_at,cursor_id);
      else
        query_sql := query_sql || format(' and (e.discovery_score,e.published_at,e.id) < (%L::double precision,%L::timestamptz,%L::uuid)',
          cursor_score,cursor_published_at,cursor_id);
      end if;
    elsif sort_key = 'alphabetical' and cursor_name is not null then
      if match_rank_sql is not null then
        -- Derive the rank from approved content rather than trusting a URL rank.
        select case when s.normalized_name = normalized_query then 0
          when exists(select 1 from public.exercise_aliases a where a.content_id = c.id
            and a.normalized_alias = normalized_query) then 1 else 2 end
        into cursor_match_rank
        from public.exercises e join public.exercise_search s on s.exercise_id = e.id
        join public.exercise_content c on c.id = e.current_content_id and c.kind = 'published_version'
        where e.id = cursor_id and e.status = 'published';
        if cursor_match_rank is null then raise exception 'invalid cursor'; end if;
        query_sql := query_sql || format(' and (%s,s.normalized_name,e.id) > (%s,%L,%L::uuid)',
          match_rank_sql,cursor_match_rank,cursor_name,cursor_id);
      else
        query_sql := query_sql || format(' and (s.normalized_name,e.id) > (%L,%L::uuid)',cursor_name,cursor_id);
      end if;
    elsif sort_key = 'newest' and cursor_published_at is not null then
      query_sql := query_sql || format(' and (e.published_at,e.id) < (%L::timestamptz,%L::uuid)',cursor_published_at,cursor_id);
    elsif sort_key = 'most_favorited' and cursor_favorite_count is not null then
      query_sql := query_sql || format(' and (e.favorite_count,e.id) < (%L::integer,%L::uuid)',cursor_favorite_count,cursor_id);
    else raise exception 'invalid cursor'; end if;
  end if;
  order_sql := case sort_key when 'recommended' then 'e.discovery_score desc,e.published_at desc,e.id desc'
    when 'alphabetical' then 's.normalized_name asc,e.id asc'
    when 'newest' then 'e.published_at desc,e.id desc' else 'e.favorite_count desc,e.id desc' end;
  if match_rank_sql is not null then order_sql := match_rank_sql || ' asc,' || order_sql; end if;
  query_sql := prefix_sql || query_sql || ' order by ' || order_sql || format(' limit %s',least(greatest(coalesce(page_size,24),1),50)+1);
  return query execute query_sql;
end;
$$;

revoke all on function public.explore_exercises(text,text[],text[],text[],text[],text[],text[],text[],text[],text[],public.exercise_mechanic[],public.force_type[],public.laterality[],text[],text[],text[],text[],public.resistance_profile[],public.peak_resistance_position[],text[],public.exercise_difficulty[],text,text,timestamptz,integer,uuid,integer,double precision) from public;
grant execute on function public.explore_exercises(text,text[],text[],text[],text[],text[],text[],text[],text[],text[],public.exercise_mechanic[],public.force_type[],public.laterality[],text[],text[],text[],text[],public.resistance_profile[],public.peak_resistance_position[],text[],public.exercise_difficulty[],text,text,timestamptz,integer,uuid,integer,double precision) to anon,authenticated;
