begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(11);

select is((select count(*)::integer from public.rig_joints rj
  join public.rigs r on r.id = rj.rig_id where r.active), 9,
  'the original workshop rig has nine named controls');
select is((select count(*)::integer from public.equipment_assets where active), 3,
  'three original equipment assets are available');

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-000000000051', 'motion-owner@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000052', 'motion-other@example.test', 'authenticated', 'authenticated');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000051', true);
select set_config('test.private_id', public.save_private_exercise(p_name => 'Motion Draft')::text, true);
select set_config('test.scene_id', public.save_private_scene(
  current_setting('test.private_id')::uuid,
  '{"durationMs":3200,"cameraAngle":"front","equipment":{"slug":"dumbbell-pair","x":0,"y":0,"z":0,"scale":1},"keyframes":[{"timeMs":0,"poses":{"left-shoulder":{"x":0,"y":0,"z":0},"right-shoulder":{"x":0,"y":0,"z":0}}},{"timeMs":3200,"poses":{"left-shoulder":{"x":0,"y":0,"z":-90},"right-shoulder":{"x":0,"y":0,"z":90}}}]}'::jsonb
)::text, true);
select is((select count(*)::integer from public.motion_keyframes
  where scene_id = current_setting('test.scene_id')::uuid), 2,
  'keyframes are stored in relational rows');
select is((select count(*)::integer from public.motion_joint_poses p
  join public.motion_keyframes k on k.id = p.keyframe_id
  where k.scene_id = current_setting('test.scene_id')::uuid), 4,
  'joint poses are stored as relational quaternions');
select is((select count(*)::integer from public.scene_equipment
  where scene_id = current_setting('test.scene_id')::uuid), 1,
  'selected equipment placement is stored relationally');
select is((select default_camera_angle::text from public.exercise_scenes
  where id = current_setting('test.scene_id')::uuid), 'front',
  'camera choice is persisted');

select public.save_private_scene(
  current_setting('test.private_id')::uuid,
  '{"durationMs":4000,"cameraAngle":"side","equipment":null,"keyframes":[{"timeMs":0,"poses":{}},{"timeMs":2000,"poses":{"left-elbow":{"x":90}}},{"timeMs":4000,"poses":{}}]}'::jsonb
);
select is((select count(*)::integer from public.motion_keyframes
  where scene_id = current_setting('test.scene_id')::uuid), 3,
  'saving again replaces old keyframes atomically');
select is((select count(*)::integer from public.scene_equipment
  where scene_id = current_setting('test.scene_id')::uuid), 0,
  'saving without equipment clears the old asset');
select throws_ok(
  $$select public.save_private_scene(current_setting('test.private_id')::uuid,
    '{"durationMs":1000,"cameraAngle":"front","keyframes":[{"timeMs":0,"poses":{"left-elbow":{"x":180}}},{"timeMs":1000,"poses":{}}]}'::jsonb)$$,
  'P0001', 'joint angle outside rig limits', 'joint controls enforce rig limits'
);
select is((select duration_ms from public.exercise_scenes
  where id = current_setting('test.scene_id')::uuid), 4000,
  'a rejected save leaves the previous scene intact');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000052', true);
select throws_ok(
  $$select public.save_private_scene(current_setting('test.private_id')::uuid,
    '{"durationMs":1000,"cameraAngle":"front","keyframes":[{"timeMs":0,"poses":{}},{"timeMs":1000,"poses":{}}]}'::jsonb)$$,
  'P0001', 'private exercise not found', 'another user cannot change the scene'
);

select * from finish();
rollback;
