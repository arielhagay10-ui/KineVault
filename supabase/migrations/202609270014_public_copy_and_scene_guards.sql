create function private.protect_scene_snapshot_children()
returns trigger language plpgsql set search_path = '' as $$
declare
  target_scene_id uuid;
  target_kind public.content_kind;
begin
  target_scene_id := case when tg_op = 'DELETE' then old.scene_id else new.scene_id end;
  select content.kind into target_kind
  from public.exercise_scenes scene
  join public.exercise_content content on content.id = scene.content_id
  where scene.id = target_scene_id;
  if target_kind in ('submission_original', 'published_version') then
    raise exception 'motion snapshot is immutable';
  end if;
  if tg_op = 'UPDATE' and old.scene_id is distinct from new.scene_id then
    select content.kind into target_kind
    from public.exercise_scenes scene
    join public.exercise_content content on content.id = scene.content_id
    where scene.id = old.scene_id;
    if target_kind in ('submission_original', 'published_version') then
      raise exception 'motion snapshot is immutable';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger immutable_scene_equipment before insert or update or delete on public.scene_equipment
for each row execute function private.protect_scene_snapshot_children();
create trigger immutable_motion_keyframes before insert or update or delete on public.motion_keyframes
for each row execute function private.protect_scene_snapshot_children();
create trigger immutable_motion_annotations before insert or update or delete on public.motion_phase_annotations
for each row execute function private.protect_scene_snapshot_children();

create function private.protect_pose_snapshot()
returns trigger language plpgsql set search_path = '' as $$
declare
  target_keyframe_id uuid;
  target_kind public.content_kind;
begin
  target_keyframe_id := case when tg_op = 'DELETE' then old.keyframe_id else new.keyframe_id end;
  select content.kind into target_kind
  from public.motion_keyframes frame
  join public.exercise_scenes scene on scene.id = frame.scene_id
  join public.exercise_content content on content.id = scene.content_id
  where frame.id = target_keyframe_id;
  if target_kind in ('submission_original', 'published_version') then
    raise exception 'motion snapshot is immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger immutable_motion_poses before insert or update or delete on public.motion_joint_poses
for each row execute function private.protect_pose_snapshot();

create function public.copy_public_exercise(p_exercise_id uuid)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare
  source_content_id uuid;
  target_content_id uuid := gen_random_uuid();
  target_private_id uuid := gen_random_uuid();
  old_scene_id uuid;
  target_scene_id uuid := gen_random_uuid();
  source_frame record;
  target_frame_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select current_content_id into source_content_id
  from public.exercises where id = p_exercise_id and status = 'published';
  if source_content_id is null then raise exception 'published exercise not found'; end if;

  insert into public.exercise_content (
    id, kind, owner_id, family_id, name, short_description,
    setup_instructions, execution_instructions, form_cues, common_mistakes,
    safety_notes, range_of_motion_notes, difficulty, exercise_type,
    mechanic, force_type, laterality, created_by
  )
  select target_content_id, 'private_draft', auth.uid(), family_id, name,
    short_description, setup_instructions, execution_instructions, form_cues,
    common_mistakes, safety_notes, range_of_motion_notes, difficulty,
    exercise_type, mechanic, force_type, laterality, auth.uid()
  from public.exercise_content where id = source_content_id;

  insert into public.private_exercises (id, owner_id, content_id, copied_from_exercise_id)
  values (target_private_id, auth.uid(), target_content_id, p_exercise_id);

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
  return target_private_id;
end;
$$;

revoke all on function public.copy_public_exercise(uuid) from public;
grant execute on function public.copy_public_exercise(uuid) to authenticated;
