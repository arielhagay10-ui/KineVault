begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(11);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-000000000061', 'copy-owner@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000062', 'copy-other@example.test', 'authenticated', 'authenticated');
insert into public.exercise_content (id, kind, name, family_id)
select '00000000-0000-4000-8000-000000000063', 'submission_editorial',
  'Reviewed Raise', id from public.exercise_families where slug = 'lateral-raise';
insert into public.exercise_muscles (content_id, muscle_id, role)
select '00000000-0000-4000-8000-000000000063', id, 'primary'
from public.muscles where slug = 'lateral-deltoid';
insert into public.exercise_scenes (id, content_id, rig_id, duration_ms)
select '00000000-0000-4000-8000-000000000064',
  '00000000-0000-4000-8000-000000000063', id, 1200
from public.rigs where name = 'KineVault Anatomical Figure';
insert into public.motion_keyframes (id, scene_id, position_ms) values
  ('00000000-0000-4000-8000-000000000065', '00000000-0000-4000-8000-000000000064', 0),
  ('00000000-0000-4000-8000-000000000066', '00000000-0000-4000-8000-000000000064', 1200);
insert into public.motion_joint_poses (keyframe_id, rig_joint_id)
select '00000000-0000-4000-8000-000000000066', id
from public.rig_joints where slug = 'left-shoulder'
  and rig_id = (select id from public.rigs where name = 'KineVault Anatomical Figure');
insert into public.exercise_media (content_id, asset_group_id, kind, storage_bucket, storage_path, license_name)
values ('00000000-0000-4000-8000-000000000063', gen_random_uuid(), 'webm',
  'exercise-public', 'test/reviewed-raise.webm', 'test original');
update public.exercise_content set kind = 'published_version'
where id = '00000000-0000-4000-8000-000000000063';
insert into public.exercises (id, slug, current_content_id, status, published_at)
values ('00000000-0000-4000-8000-000000000067', 'reviewed-raise',
  '00000000-0000-4000-8000-000000000063', 'published', now());
insert into public.exercise_content (id, kind, owner_id, name)
values ('00000000-0000-4000-8000-000000000068', 'submission_original',
  '00000000-0000-4000-8000-000000000061', 'Contributor Source');
insert into public.exercise_submissions (id, owner_id, original_content_id, status, allow_motion_reuse)
values ('00000000-0000-4000-8000-000000000069',
  '00000000-0000-4000-8000-000000000061',
  '00000000-0000-4000-8000-000000000068', 'approved', false);
insert into public.exercise_versions (exercise_id, version_number, content_id, source_submission_id)
values ('00000000-0000-4000-8000-000000000067', 1,
  '00000000-0000-4000-8000-000000000063',
  '00000000-0000-4000-8000-000000000069');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000061', true);
select set_config('test.copy_id', public.copy_public_exercise(
  '00000000-0000-4000-8000-000000000067')::text, true);
select is((select copied_from_exercise_id from public.private_exercises
  where id = current_setting('test.copy_id')::uuid),
  '00000000-0000-4000-8000-000000000067'::uuid, 'copy retains source lineage');
select is((select c.name from public.private_exercises p
  join public.exercise_content c on c.id = p.content_id
  where p.id = current_setting('test.copy_id')::uuid), 'Reviewed Raise',
  'copy retains the reviewed name');
select is((select count(*)::integer from public.exercise_muscles m
  join public.private_exercises p on p.content_id = m.content_id
  where p.id = current_setting('test.copy_id')::uuid), 1,
  'copy retains normalized muscle classifications');
select is((select count(*)::integer from public.motion_keyframes frame
  join public.exercise_scenes scene on scene.id = frame.scene_id
  join public.private_exercises private_exercise on private_exercise.content_id = scene.content_id
  where private_exercise.id = current_setting('test.copy_id')::uuid), 0,
  'copy excludes motion without contributor consent');
set local role postgres;
update public.exercise_submissions set allow_motion_reuse = true
where id = '00000000-0000-4000-8000-000000000069';
set local role authenticated;
select set_config('test.consent_copy_id', public.copy_public_exercise(
  '00000000-0000-4000-8000-000000000067')::text, true);
select is((select count(*)::integer from public.motion_keyframes frame
  join public.exercise_scenes scene on scene.id = frame.scene_id
  join public.private_exercises private_exercise on private_exercise.content_id = scene.content_id
  where private_exercise.id = current_setting('test.consent_copy_id')::uuid), 2,
  'consented motion copies as editable keyframes');
select isnt((select content_id from public.private_exercises
  where id = current_setting('test.copy_id')::uuid),
  '00000000-0000-4000-8000-000000000063'::uuid,
  'copy has an independent content record');
select is((select score from public.find_exercise_duplicates(current_setting('test.copy_id')::uuid)
  where exercise_id = '00000000-0000-4000-8000-000000000067'), 100,
  'an exact public name is ranked at 100');
select is((select shared_muscles from public.find_exercise_duplicates(current_setting('test.copy_id')::uuid)
  where exercise_id = '00000000-0000-4000-8000-000000000067'), 1,
  'duplicate comparison counts relational muscle overlap');
set local role postgres;
select throws_ok(
  $$update public.motion_keyframes set position_ms = 500
    where id = '00000000-0000-4000-8000-000000000065'$$,
  'P0001', 'motion snapshot is immutable', 'published source motion cannot be changed'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000062', true);
select is((select count(*)::integer from public.private_exercises
  where id = current_setting('test.copy_id')::uuid), 0,
  'another user cannot see the private copy');
select throws_ok(
  $$select * from public.find_exercise_duplicates(current_setting('test.copy_id')::uuid)$$,
  'P0001', 'private exercise not found',
  'another user cannot run duplicate search on the private copy'
);

select * from finish();
rollback;
