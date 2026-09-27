create function public.read_shared_private_scene(p_token_hash text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'durationMs', scene.duration_ms,
    'cameraAngle', scene.default_camera_angle,
    'equipment', (
      select jsonb_build_object(
        'slug', asset.slug, 'x', placed.position_x, 'y', placed.position_y,
        'z', placed.position_z, 'scale', placed.scale
      )
      from public.scene_equipment placed
      join public.equipment_assets asset on asset.id = placed.asset_id
      where placed.scene_id = scene.id order by placed.id limit 1
    ),
    'keyframes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'timeMs', frame.position_ms,
        'poses', coalesce((
          select jsonb_agg(jsonb_build_object(
            'slug', rig_joint.slug, 'x', pose.rotation_x,
            'y', pose.rotation_y, 'z', pose.rotation_z, 'w', pose.rotation_w
          ) order by rig_joint.slug)
          from public.motion_joint_poses pose
          join public.rig_joints rig_joint on rig_joint.id = pose.rig_joint_id
          where pose.keyframe_id = frame.id
        ), '[]'::jsonb)
      ) order by frame.position_ms)
      from public.motion_keyframes frame where frame.scene_id = scene.id
    ), '[]'::jsonb)
  )
  from public.private_exercise_shares share_link
  join public.private_exercises private_exercise
    on private_exercise.id = share_link.private_exercise_id
  join public.exercise_scenes scene on scene.content_id = private_exercise.content_id
  where share_link.token_hash = p_token_hash and share_link.revoked_at is null;
$$;

revoke all on function public.read_shared_private_scene(text) from public;
grant execute on function public.read_shared_private_scene(text) to anon, authenticated;
