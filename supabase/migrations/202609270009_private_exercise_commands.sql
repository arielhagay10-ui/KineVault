create function public.save_private_exercise(
  p_private_id uuid default null,
  p_name text default 'Untitled exercise',
  p_short_description text default null,
  p_family_slug text default null,
  p_primary_muscle_slugs text[] default '{}',
  p_secondary_muscle_slugs text[] default '{}',
  p_stabilizer_muscle_slugs text[] default '{}',
  p_joint_slugs text[] default '{}',
  p_joint_action_slugs text[] default '{}',
  p_equipment_slugs text[] default '{}',
  p_resistance_profile public.resistance_profile default 'unknown',
  p_body_position_slug text default null
)
returns uuid
language plpgsql volatile security invoker
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_private_id uuid;
  target_content_id uuid;
  target_family_id uuid;
  target_body_position_id uuid;
begin
  if actor is null then raise exception 'authentication required'; end if;
  if length(btrim(p_name)) not between 2 and 160 then raise exception 'invalid exercise name'; end if;
  if length(coalesce(p_short_description, '')) > 500 then raise exception 'description is too long'; end if;
  if greatest(
    cardinality(p_primary_muscle_slugs), cardinality(p_secondary_muscle_slugs),
    cardinality(p_stabilizer_muscle_slugs), cardinality(p_joint_slugs),
    cardinality(p_joint_action_slugs), cardinality(p_equipment_slugs)
  ) > 20 then raise exception 'too many taxonomy values'; end if;

  if p_family_slug is not null then
    select id into target_family_id from public.exercise_families where slug = p_family_slug;
    if target_family_id is null then raise exception 'unknown exercise family'; end if;
  end if;
  if p_body_position_slug is not null then
    select id into target_body_position_id from public.body_positions where slug = p_body_position_slug;
    if target_body_position_id is null then raise exception 'unknown body position'; end if;
  end if;
  if exists (
    select 1 from unnest(
      p_primary_muscle_slugs || p_secondary_muscle_slugs || p_stabilizer_muscle_slugs
    ) wanted(slug)
    left join public.muscles m on m.slug = wanted.slug where m.id is null
  ) then raise exception 'unknown muscle'; end if;
  if exists (
    select 1 from unnest(p_joint_slugs) wanted(slug)
    left join public.joints j on j.slug = wanted.slug where j.id is null
  ) then raise exception 'unknown joint'; end if;
  if exists (
    select 1 from unnest(p_joint_action_slugs) wanted(slug)
    left join public.joint_actions ja on ja.slug = wanted.slug where ja.id is null
  ) then raise exception 'unknown joint action'; end if;
  if exists (
    select 1 from unnest(p_equipment_slugs) wanted(slug)
    left join public.equipment q on q.slug = wanted.slug where q.id is null
  ) then raise exception 'unknown equipment'; end if;

  if p_private_id is null then
    target_content_id := gen_random_uuid();
    target_private_id := gen_random_uuid();
    insert into public.exercise_content (
      id, kind, owner_id, family_id, name, short_description, created_by
    ) values (
      target_content_id, 'private_draft', actor, target_family_id, btrim(p_name), nullif(btrim(p_short_description), ''), actor
    );
    insert into public.private_exercises (id, owner_id, content_id)
    values (target_private_id, actor, target_content_id);
  else
    select pe.id, pe.content_id into target_private_id, target_content_id
    from public.private_exercises pe
    where pe.id = p_private_id and pe.owner_id = actor for update;
    if target_private_id is null then raise exception 'private exercise not found'; end if;
    update public.exercise_content set
      family_id = target_family_id,
      name = btrim(p_name),
      short_description = nullif(btrim(p_short_description), ''),
      updated_at = now()
    where id = target_content_id;
    delete from public.exercise_muscles where content_id = target_content_id;
    delete from public.exercise_joint_actions where content_id = target_content_id;
    delete from public.exercise_joints where content_id = target_content_id;
    delete from public.exercise_equipment where content_id = target_content_id;
    update public.private_exercises set updated_at = now() where id = target_private_id;
  end if;

  insert into public.exercise_muscles (content_id, muscle_id, role)
  select target_content_id, m.id, selected.role::public.muscle_role
  from (
    select unnest(p_primary_muscle_slugs) as slug, 'primary' as role
    union all select unnest(p_secondary_muscle_slugs), 'secondary'
    union all select unnest(p_stabilizer_muscle_slugs), 'stabilizer'
  ) selected join public.muscles m on m.slug = selected.slug;
  insert into public.exercise_joint_actions (content_id, joint_action_id, role)
  select target_content_id, ja.id, 'primary'
  from public.joint_actions ja where ja.slug = any(p_joint_action_slugs);
  insert into public.exercise_joints (content_id, joint_id, role)
  select target_content_id, joint_ids.id, 'primary'
  from (
    select j.id from public.joints j where j.slug = any(p_joint_slugs)
    union
    select ja.joint_id from public.joint_actions ja where ja.slug = any(p_joint_action_slugs)
  ) joint_ids;
  insert into public.exercise_equipment (content_id, equipment_id, role)
  select target_content_id, q.id, 'required'
  from public.equipment q where q.slug = any(p_equipment_slugs);
  insert into public.exercise_biomechanics (
    content_id, body_position_id, resistance_profile
  ) values (target_content_id, target_body_position_id, p_resistance_profile)
  on conflict (content_id) do update set
    body_position_id = excluded.body_position_id,
    resistance_profile = excluded.resistance_profile;
  return target_private_id;
end;
$$;

revoke all on function public.save_private_exercise(
  uuid, text, text, text, text[], text[], text[], text[], text[], text[],
  public.resistance_profile, text
) from public;
grant execute on function public.save_private_exercise(
  uuid, text, text, text, text[], text[], text[], text[], text[], text[],
  public.resistance_profile, text
) to authenticated;

create function public.delete_private_exercise(p_private_id uuid)
returns void
language plpgsql volatile security invoker
set search_path = ''
as $$
declare
  target_content_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select content_id into target_content_id
  from public.private_exercises
  where id = p_private_id and owner_id = auth.uid() for update;
  if target_content_id is null then raise exception 'private exercise not found'; end if;
  delete from public.private_exercises where id = p_private_id;
  delete from public.exercise_content where id = target_content_id;
end;
$$;

revoke all on function public.delete_private_exercise(uuid) from public;
grant execute on function public.delete_private_exercise(uuid) to authenticated;
