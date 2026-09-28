create or replace function public.save_private_scene(p_private_id uuid, p_scene jsonb)
returns uuid
language plpgsql volatile security invoker
set search_path = ''
as $$
declare
  target_content_id uuid;
  target_rig_id uuid;
  target_scene_id uuid;
  frame jsonb;
  poses jsonb;
  pose record;
  target_joint public.rig_joints%rowtype;
  target_asset_id uuid;
  saved_asset_id uuid;
  saved_rig_id uuid;
  frame_id uuid;
  duration integer;
  frame_time integer;
  previous_time integer := -1;
  angle_x numeric;
  angle_y numeric;
  angle_z numeric;
  half_x double precision;
  half_y double precision;
  half_z double precision;
  cx double precision;
  cy double precision;
  cz double precision;
  sx double precision;
  sy double precision;
  sz double precision;
  equipment jsonb;
  equipment_x numeric;
  equipment_y numeric;
  equipment_z numeric;
  equipment_scale numeric;
  camera public.camera_angle;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select content_id into target_content_id from public.private_exercises
  where id = p_private_id and owner_id = auth.uid() for update;
  if target_content_id is null then raise exception 'private exercise not found'; end if;
  if jsonb_typeof(p_scene) <> 'object'
     or jsonb_typeof(p_scene->'durationMs') <> 'number'
     or jsonb_typeof(p_scene->'keyframes') <> 'array' then
    raise exception 'invalid scene document';
  end if;
  duration := (p_scene->>'durationMs')::integer;
  if duration not between 250 and 60000 then raise exception 'invalid scene duration'; end if;
  if jsonb_array_length(p_scene->'keyframes') not between 2 and 24 then
    raise exception 'scene needs two to twenty-four keyframes';
  end if;
  if p_scene->>'cameraAngle' not in ('front', 'side', 'three_quarter') then
    raise exception 'invalid camera angle';
  end if;
  camera := (p_scene->>'cameraAngle')::public.camera_angle;
  select id,rig_id into target_scene_id,saved_rig_id from public.exercise_scenes
  where content_id = target_content_id for update;
  select asset_id into saved_asset_id from public.scene_equipment where scene_id = target_scene_id limit 1;
  equipment := p_scene->'equipment';
  if equipment is not null and jsonb_typeof(equipment) <> 'null' then
    if jsonb_typeof(equipment) <> 'object' then raise exception 'invalid equipment placement'; end if;
    select id into target_asset_id from public.equipment_assets
    where slug = equipment->>'slug' and version = 1 and (active or id = saved_asset_id);
    if target_asset_id is null then raise exception 'unknown workshop equipment'; end if;
  end if;
  select id into target_rig_id from public.rigs
  where name = 'KineVault Anatomical Figure' and version = 1 and (active or id = saved_rig_id);
  if target_rig_id is null then raise exception 'workshop rig unavailable'; end if;

  select id into target_scene_id from public.exercise_scenes
  where content_id = target_content_id for update;
  if target_scene_id is null then
    target_scene_id := gen_random_uuid();
    insert into public.exercise_scenes (
      id, content_id, rig_id, duration_ms, default_camera_angle,
      camera_position_x, camera_position_y, camera_position_z,
      camera_target_x, camera_target_y, camera_target_z
    ) values (
      target_scene_id, target_content_id, target_rig_id, duration, camera,
      case when camera = 'side' then 5 when camera = 'front' then 0 else 3.4 end,
      case when camera = 'three_quarter' then 2.8 else 2.4 end,
      case when camera = 'side' then 0 when camera = 'front' then 5 else 5.5 end,
      0, 1.2, 0
    );
  else
    update public.exercise_scenes set duration_ms = duration,
      default_camera_angle = camera,
      camera_position_x = case when camera = 'side' then 5 when camera = 'front' then 0 else 3.4 end,
      camera_position_y = case when camera = 'three_quarter' then 2.8 else 2.4 end,
      camera_position_z = case when camera = 'side' then 0 when camera = 'front' then 5 else 5.5 end,
      updated_at = now()
    where id = target_scene_id;
    delete from public.scene_equipment where scene_id = target_scene_id;
    delete from public.motion_keyframes where scene_id = target_scene_id;
  end if;

  equipment := p_scene->'equipment';
  if equipment is not null and jsonb_typeof(equipment) <> 'null' then
    equipment_x := coalesce((equipment->>'x')::numeric, 0);
    equipment_y := coalesce((equipment->>'y')::numeric, 0);
    equipment_z := coalesce((equipment->>'z')::numeric, 0);
    equipment_scale := coalesce((equipment->>'scale')::numeric, 1);
    if equipment_x not between -3 and 3 or equipment_y not between -3 and 3
       or equipment_z not between -3 and 3 or equipment_scale not between 0.5 and 2 then
      raise exception 'equipment placement outside workshop bounds';
    end if;
    insert into public.scene_equipment (
      scene_id, asset_id, position_x, position_y, position_z, scale
    ) values (
      target_scene_id, target_asset_id, equipment_x, equipment_y, equipment_z, equipment_scale
    );
  end if;

  for frame in select value from jsonb_array_elements(p_scene->'keyframes') loop
    if jsonb_typeof(frame->'timeMs') <> 'number'
       or jsonb_typeof(frame->'poses') <> 'object' then
      raise exception 'invalid keyframe';
    end if;
    frame_time := (frame->>'timeMs')::integer;
    if frame_time <= previous_time or frame_time > duration then
      raise exception 'keyframes must be strictly ordered within duration';
    end if;
    if previous_time = -1 and frame_time <> 0 then raise exception 'first keyframe must start at zero'; end if;
    previous_time := frame_time;
    frame_id := gen_random_uuid();
    insert into public.motion_keyframes (id, scene_id, position_ms)
    values (frame_id, target_scene_id, frame_time);
    poses := frame->'poses';
    for pose in select key, value from jsonb_each(poses) loop
      select * into target_joint from public.rig_joints
      where rig_id = target_rig_id and slug = pose.key;
      if target_joint.id is null then raise exception 'unknown rig joint'; end if;
      if jsonb_typeof(pose.value) <> 'object' then raise exception 'invalid joint pose'; end if;
      angle_x := coalesce((pose.value->>'x')::numeric, 0);
      angle_y := coalesce((pose.value->>'y')::numeric, 0);
      angle_z := coalesce((pose.value->>'z')::numeric, 0);
      if angle_x not between target_joint.min_x_degrees and target_joint.max_x_degrees
         or angle_y not between target_joint.min_y_degrees and target_joint.max_y_degrees
         or angle_z not between target_joint.min_z_degrees and target_joint.max_z_degrees then
        raise exception 'joint angle outside rig limits';
      end if;
      half_x := radians(angle_x::double precision) / 2;
      half_y := radians(angle_y::double precision) / 2;
      half_z := radians(angle_z::double precision) / 2;
      cx := cos(half_x); cy := cos(half_y); cz := cos(half_z);
      sx := sin(half_x); sy := sin(half_y); sz := sin(half_z);
      insert into public.motion_joint_poses (
        keyframe_id, rig_joint_id, rotation_x, rotation_y, rotation_z, rotation_w
      ) values (
        frame_id, target_joint.id,
        sx * cy * cz + cx * sy * sz,
        cx * sy * cz - sx * cy * sz,
        cx * cy * sz + sx * sy * cz,
        cx * cy * cz - sx * sy * sz
      );
    end loop;
  end loop;
  if previous_time <> duration then raise exception 'final keyframe must end at scene duration'; end if;
  return target_scene_id;
end;
$$;

revoke all on function public.save_private_scene(uuid, jsonb) from public;
grant execute on function public.save_private_scene(uuid, jsonb) to authenticated;

