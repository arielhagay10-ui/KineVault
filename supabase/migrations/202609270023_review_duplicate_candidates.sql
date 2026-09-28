create function public.find_submission_duplicates(p_submission_id uuid)
returns table (
  exercise_id uuid,
  slug text,
  name text,
  score integer,
  exact_name boolean,
  alias_match boolean,
  same_family boolean,
  shared_equipment integer,
  shared_muscles integer,
  shared_joint_actions integer,
  shared_patterns integer
)
language plpgsql stable security definer set search_path = '' as $$
declare
  source_id uuid;
  normalized_input text;
  source_family_id uuid;
begin
  if auth.uid() is null or not (select private.is_reviewer()) then
    raise exception 'reviewer role required';
  end if;
  select submission.original_content_id,
    lower(regexp_replace(btrim(content.name), '[^[:alnum:]]+', ' ', 'g')),
    content.family_id
  into source_id, normalized_input, source_family_id
  from public.exercise_submissions submission
  join public.exercise_content content on content.id = submission.original_content_id
  where submission.id = p_submission_id;
  if source_id is null then raise exception 'submission not found'; end if;
  return query
  with candidate_names as (
    select search.exercise_id, search.content_id, search.name, search.normalized_name,
      greatest(
        extensions.similarity(search.normalized_name, normalized_input),
        coalesce((
          select max(extensions.similarity(alias.normalized_alias, normalized_input))
          from public.exercise_aliases alias where alias.content_id = search.content_id
        ), 0)
      ) as name_similarity,
      exists (
        select 1 from public.exercise_aliases alias
        where alias.content_id = search.content_id
          and alias.normalized_alias = normalized_input
      ) as is_alias
    from public.exercise_search search
    where search.normalized_name = normalized_input
      or search.normalized_name OPERATOR(extensions.%) normalized_input
      or exists (
        select 1 from public.exercise_aliases alias
        where alias.content_id = search.content_id
          and (alias.normalized_alias = normalized_input
            or alias.normalized_alias OPERATOR(extensions.%) normalized_input)
      )
    order by search.normalized_name = normalized_input desc,
      extensions.similarity(search.normalized_name, normalized_input) desc,
      search.exercise_id
    limit 200
  ), compared as (
    select candidate.*, exercise.slug,
      (candidate.normalized_name = normalized_input) as is_exact,
      (content.family_id is not distinct from source_family_id
        and source_family_id is not null) as is_same_family,
      (select count(*)::integer from public.exercise_equipment match_item
        where match_item.content_id = candidate.content_id and exists (
          select 1 from public.exercise_equipment source_item
          where source_item.content_id = source_id
            and source_item.equipment_id = match_item.equipment_id
        )) as equipment_overlap,
      (select count(*)::integer from public.exercise_muscles match_item
        where match_item.content_id = candidate.content_id and exists (
          select 1 from public.exercise_muscles source_item
          where source_item.content_id = source_id
            and source_item.muscle_id = match_item.muscle_id
        )) as muscle_overlap,
      (select count(*)::integer from public.exercise_joint_actions match_item
        where match_item.content_id = candidate.content_id and exists (
          select 1 from public.exercise_joint_actions source_item
          where source_item.content_id = source_id
            and source_item.joint_action_id = match_item.joint_action_id
        )) as action_overlap,
      (select count(*)::integer from public.exercise_movement_patterns match_item
        where match_item.content_id = candidate.content_id and exists (
          select 1 from public.exercise_movement_patterns source_item
          where source_item.content_id = source_id
            and source_item.movement_pattern_id = match_item.movement_pattern_id
        )) as pattern_overlap
    from candidate_names candidate
    join public.exercises exercise on exercise.id = candidate.exercise_id and exercise.status = 'published'
    join public.exercise_content content on content.id = candidate.content_id
  )
  select compared.exercise_id, compared.slug, compared.name,
    least(100, case when compared.is_exact then 100
      when compared.is_alias then 97
      else round(compared.name_similarity * 50)::integer
        + case when compared.is_same_family then 10 else 0 end
        + least(compared.equipment_overlap * 12, 12)
        + least(compared.muscle_overlap * 4, 8)
        + least(compared.action_overlap * 5, 10)
        + least(compared.pattern_overlap * 3, 6)
    end)::integer,
    compared.is_exact, compared.is_alias, compared.is_same_family,
    compared.equipment_overlap, compared.muscle_overlap,
    compared.action_overlap, compared.pattern_overlap
  from compared
  order by 4 desc, compared.name, compared.exercise_id
  limit 12;
end;
$$;

revoke all on function public.find_submission_duplicates(uuid) from public;
grant execute on function public.find_submission_duplicates(uuid) to authenticated;

