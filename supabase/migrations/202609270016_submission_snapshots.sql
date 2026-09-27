alter table public.exercise_submissions
  add column revision_of_id uuid unique references public.exercise_submissions(id) on delete restrict,
  add column duplicate_disposition text not null default 'new'
    check (duplicate_disposition in ('new', 'variation', 'possible_duplicate')),
  add column allow_motion_reuse boolean not null default false;

create function private.clone_exercise_content(
  source_content_id uuid,
  target_kind public.content_kind,
  target_owner_id uuid
)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare
  target_content_id uuid := gen_random_uuid();
  old_scene_id uuid;
  target_scene_id uuid := gen_random_uuid();
  source_frame record;
  target_frame_id uuid;
begin
  -- Build children while the target is mutable; the caller freezes it after cloning.
  insert into public.exercise_content (
    id, kind, owner_id, family_id, name, short_description,
    setup_instructions, execution_instructions, form_cues, common_mistakes,
    safety_notes, range_of_motion_notes, difficulty, exercise_type,
    mechanic, force_type, laterality, created_by
  )
  select target_content_id, target_kind, target_owner_id, family_id, name,
    short_description, setup_instructions, execution_instructions, form_cues,
    common_mistakes, safety_notes, range_of_motion_notes, difficulty,
    exercise_type, mechanic, force_type, laterality, created_by
  from public.exercise_content where id = source_content_id;
  if not found then raise exception 'source content not found'; end if;

  insert into public.exercise_biomechanics (
    content_id, body_position_id, grip_id, stance_id, plane_id,
    resistance_source_id, resistance_profile, peak_resistance_position,
    classification_confidence, reviewer_notes
  )
  select target_content_id, body_position_id, grip_id, stance_id, plane_id,
    resistance_source_id, resistance_profile, peak_resistance_position,
    classification_confidence, reviewer_notes
  from public.exercise_biomechanics where content_id = source_content_id;
  insert into public.exercise_aliases (content_id, alias, normalized_alias)
  select target_content_id, alias, normalized_alias
  from public.exercise_aliases where content_id = source_content_id;
  insert into public.exercise_muscles (content_id, muscle_id, role, notes)
  select target_content_id, muscle_id, role, notes
  from public.exercise_muscles where content_id = source_content_id;
  insert into public.exercise_joints (content_id, joint_id, role, notes)
  select target_content_id, joint_id, role, notes
  from public.exercise_joints where content_id = source_content_id;
  insert into public.exercise_joint_actions (content_id, joint_action_id, role, notes)
  select target_content_id, joint_action_id, role, notes
  from public.exercise_joint_actions where content_id = source_content_id;
  insert into public.exercise_equipment (content_id, equipment_id, role, notes)
  select target_content_id, equipment_id, role, notes
  from public.exercise_equipment where content_id = source_content_id;
  insert into public.exercise_attachments (content_id, attachment_id, notes)
  select target_content_id, attachment_id, notes
  from public.exercise_attachments where content_id = source_content_id;
  insert into public.exercise_movement_patterns (content_id, movement_pattern_id)
  select target_content_id, movement_pattern_id
  from public.exercise_movement_patterns where content_id = source_content_id;

  select id into old_scene_id from public.exercise_scenes where content_id = source_content_id;
  if old_scene_id is not null then
    insert into public.exercise_scenes (
      id, content_id, rig_id, duration_ms, default_camera_angle,
      camera_position_x, camera_position_y, camera_position_z,
      camera_target_x, camera_target_y, camera_target_z
    )
    select target_scene_id, target_content_id, rig_id, duration_ms, default_camera_angle,
      camera_position_x, camera_position_y, camera_position_z,
      camera_target_x, camera_target_y, camera_target_z
    from public.exercise_scenes where id = old_scene_id;
    insert into public.scene_equipment (
      scene_id, asset_id, anchor_joint_id, position_x, position_y, position_z,
      rotation_x, rotation_y, rotation_z, rotation_w, scale
    )
    select target_scene_id, asset_id, anchor_joint_id, position_x, position_y, position_z,
      rotation_x, rotation_y, rotation_z, rotation_w, scale
    from public.scene_equipment where scene_id = old_scene_id;
    for source_frame in select * from public.motion_keyframes
      where scene_id = old_scene_id order by position_ms loop
      target_frame_id := gen_random_uuid();
      insert into public.motion_keyframes (id, scene_id, position_ms, phase_label)
      values (target_frame_id, target_scene_id, source_frame.position_ms, source_frame.phase_label);
      insert into public.motion_joint_poses (
        keyframe_id, rig_joint_id, rotation_x, rotation_y, rotation_z, rotation_w,
        position_x, position_y, position_z
      )
      select target_frame_id, rig_joint_id, rotation_x, rotation_y, rotation_z,
        rotation_w, position_x, position_y, position_z
      from public.motion_joint_poses where keyframe_id = source_frame.id;
    end loop;
    insert into public.motion_phase_annotations (scene_id, start_ms, end_ms, joint_action_id, label, note)
    select target_scene_id, start_ms, end_ms, joint_action_id, label, note
    from public.motion_phase_annotations where scene_id = old_scene_id;
  end if;
  return target_content_id;
end;
$$;
revoke all on function private.clone_exercise_content(uuid, public.content_kind, uuid) from public, anon, authenticated;

create function public.submit_private_exercise(
  p_private_id uuid,
  p_duplicate_disposition text,
  p_related_exercise_id uuid default null,
  p_allow_motion_reuse boolean default false,
  p_revision_of_id uuid default null,
  p_suggestions jsonb default '[]'::jsonb
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  source_content_id uuid;
  snapshot_id uuid;
  submission_id uuid := gen_random_uuid();
  source_scene_id uuid;
  snapshot_scene_id uuid;
  prior_status public.submission_status;
  suggestion jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select content_id into source_content_id from public.private_exercises
  where id = p_private_id and owner_id = auth.uid() for update;
  if source_content_id is null then raise exception 'private exercise not found'; end if;
  if p_duplicate_disposition not in ('new', 'variation', 'possible_duplicate') then
    raise exception 'choose how this relates to an existing exercise';
  end if;
  if (p_duplicate_disposition = 'new') <> (p_related_exercise_id is null) then
    raise exception 'relationship selection is incomplete';
  end if;
  if p_related_exercise_id is not null and not exists (
    select 1 from public.exercises where id = p_related_exercise_id and status = 'published'
  ) then raise exception 'related exercise is not published'; end if;
  if jsonb_typeof(p_suggestions) <> 'array'
    or jsonb_array_length(p_suggestions) > 8 then
    raise exception 'invalid taxonomy suggestions';
  end if;
  for suggestion in select value from jsonb_array_elements(p_suggestions) loop
    if jsonb_typeof(suggestion) <> 'object'
      or suggestion->>'taxonomyName' not in (
        'muscles', 'joints', 'joint_actions', 'equipment', 'equipment_categories',
        'attachments', 'movement_patterns', 'exercise_families'
      )
      or length(btrim(coalesce(suggestion->>'suggestedName', ''))) not between 2 and 120
      or length(coalesce(suggestion->>'explanation', '')) > 1000 then
      raise exception 'invalid taxonomy suggestion';
    end if;
  end loop;
  if p_revision_of_id is not null then
    select status into prior_status from public.exercise_submissions
    where id = p_revision_of_id and owner_id = auth.uid()
      and source_private_exercise_id = p_private_id for update;
    if prior_status is distinct from 'changes_requested'
      or exists (select 1 from public.exercise_submissions where revision_of_id = p_revision_of_id) then
      raise exception 'submission is not awaiting a revision';
    end if;
  end if;

  if not exists (select 1 from public.exercise_content
    where id = source_content_id and length(btrim(name)) >= 3) then
    raise exception 'exercise name is required';
  end if;
  if not exists (select 1 from public.exercise_content
    where id = source_content_id and family_id is not null)
    and not exists (select 1 from jsonb_array_elements(p_suggestions) item
      where item->>'taxonomyName' = 'exercise_families') then
    raise exception 'name and exercise family are required';
  end if;
  if not exists (select 1 from public.exercise_muscles
    where content_id = source_content_id and role = 'primary')
    and not exists (select 1 from jsonb_array_elements(p_suggestions) item
      where item->>'taxonomyName' = 'muscles') then
    raise exception 'at least one primary muscle is required';
  end if;
  if not exists (select 1 from public.exercise_joint_actions
    where content_id = source_content_id and role = 'primary')
    and not exists (select 1 from jsonb_array_elements(p_suggestions) item
      where item->>'taxonomyName' = 'joint_actions') then
    raise exception 'at least one primary joint action is required';
  end if;
  select id into source_scene_id from public.exercise_scenes
  where content_id = source_content_id;
  if exists (select 1 from public.exercise_scenes
    where id = source_scene_id and duration_ms > 12000) then
    raise exception 'motion demonstration must be twelve seconds or shorter';
  end if;
  if source_scene_id is null or not exists (
    select 1 from public.motion_keyframes
    where scene_id = source_scene_id
    group by scene_id having count(*) >= 2 and min(position_ms) = 0
      and max(position_ms) = (select duration_ms from public.exercise_scenes where id = source_scene_id)
  ) then raise exception 'a complete motion demonstration is required'; end if;
  if not exists (select 1 from public.motion_joint_poses pose
    join public.motion_keyframes frame on frame.id = pose.keyframe_id
    where frame.scene_id = source_scene_id) then
    raise exception 'the motion demonstration needs at least one posed joint';
  end if;

  snapshot_id := private.clone_exercise_content(
    source_content_id, 'submission_editorial', auth.uid());
  select id into snapshot_scene_id from public.exercise_scenes
  where content_id = snapshot_id;
  update public.exercise_content set kind = 'submission_original'
  where id = snapshot_id;
  insert into public.exercise_submissions (
    id, owner_id, source_private_exercise_id, original_content_id,
    status, related_exercise_id, duplicate_disposition,
    allow_motion_reuse, revision_of_id, submitted_at
  ) values (
    submission_id, auth.uid(), p_private_id, snapshot_id,
    'submitted', p_related_exercise_id, p_duplicate_disposition,
    p_allow_motion_reuse, p_revision_of_id, now()
  );
  for suggestion in select value from jsonb_array_elements(p_suggestions) loop
    insert into public.taxonomy_suggestions (
      submission_id, taxonomy_name, suggested_name, explanation
    ) values (
      submission_id, suggestion->>'taxonomyName',
      btrim(suggestion->>'suggestedName'), nullif(btrim(suggestion->>'explanation'), '')
    );
  end loop;
  if p_revision_of_id is not null then
    update public.exercise_submissions set status = 'withdrawn', updated_at = now()
    where id = p_revision_of_id;
    insert into public.moderation_events (
      submission_id, actor_id, action, from_status, to_status
    ) values (p_revision_of_id, auth.uid(), 'resubmit', 'changes_requested', 'withdrawn');
  end if;
  insert into public.moderation_events (
    submission_id, actor_id, action, from_status, to_status
  ) values (submission_id, auth.uid(), 'submit', null, 'submitted');
  insert into public.render_jobs (scene_id, status, requested_by)
  values (snapshot_scene_id, 'queued', auth.uid());
  return submission_id;
end;
$$;
revoke all on function public.submit_private_exercise(uuid, text, uuid, boolean, uuid, jsonb) from public;
grant execute on function public.submit_private_exercise(uuid, text, uuid, boolean, uuid, jsonb) to authenticated;

create function public.withdraw_submission(p_submission_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare current_status public.submission_status;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select status into current_status from public.exercise_submissions
  where id = p_submission_id and owner_id = auth.uid() for update;
  if current_status is null or current_status not in ('submitted', 'changes_requested') then
    raise exception 'submission cannot be withdrawn';
  end if;
  update public.exercise_submissions set status = 'withdrawn', updated_at = now()
  where id = p_submission_id;
  insert into public.moderation_events (
    submission_id, actor_id, action, from_status, to_status
  ) values (p_submission_id, auth.uid(), 'withdraw', current_status, 'withdrawn');
end;
$$;
revoke all on function public.withdraw_submission(uuid) from public;
grant execute on function public.withdraw_submission(uuid) to authenticated;
