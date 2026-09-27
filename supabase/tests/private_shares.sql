begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-000000000031', 'share-owner@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000032', 'share-other@example.test', 'authenticated', 'authenticated');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000031', true);
select set_config('test.private_id', public.save_private_exercise(
  p_name => 'Shareable Cable Raise',
  p_primary_muscle_slugs => array['lateral-deltoid'],
  p_joint_action_slugs => array['shoulder-abduction'],
  p_equipment_slugs => array['cable']
)::text, true);
select public.replace_private_share(current_setting('test.private_id')::uuid, repeat('a', 64));
select public.save_private_scene(
  current_setting('test.private_id')::uuid,
  '{"durationMs":1200,"cameraAngle":"front","equipment":null,"keyframes":[{"timeMs":0,"poses":{}},{"timeMs":1200,"poses":{"left-shoulder":{"z":-60}}}]}'::jsonb
);
select is((select count(*)::integer from public.private_exercise_shares
  where private_exercise_id = current_setting('test.private_id')::uuid and revoked_at is null), 1,
  'the owner has one active share link');
select is(public.read_shared_private_exercise(repeat('a', 64))->>'name', 'Shareable Cable Raise',
  'the active link resolves the exercise');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select ok(not has_table_privilege('anon', 'public.private_exercise_shares', 'SELECT'),
  'anonymous visitors cannot read share records directly');
select is(public.read_shared_private_exercise(repeat('a', 64))->>'name', 'Shareable Cable Raise',
  'a link holder can view the private exercise anonymously');
select is((public.read_shared_private_scene(repeat('a', 64))->>'durationMs')::integer, 1200,
  'a link holder can view the motion scene anonymously');
select is(jsonb_array_length(public.read_shared_private_scene(repeat('a', 64))->'keyframes'), 2,
  'shared motion contains both keyframes');
select is((select count(*)::integer from public.exercise_content where name = 'Shareable Cable Raise'), 0,
  'the private exercise remains hidden from ordinary anonymous reads');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000032', true);
select throws_ok(
  $$select public.revoke_private_share(current_setting('test.private_id')::uuid)$$,
  'P0001', 'private exercise not found', 'another user cannot revoke the link'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000031', true);
select public.replace_private_share(current_setting('test.private_id')::uuid, repeat('b', 64));
select is(public.read_shared_private_exercise(repeat('a', 64))::text, null::text,
  'rotating a link revokes the previous URL');
select is(public.read_shared_private_scene(repeat('a', 64))::text, null::text,
  'rotating a link also revokes scene access');
select is(public.read_shared_private_exercise(repeat('b', 64))->>'name', 'Shareable Cable Raise',
  'the replacement link resolves the exercise');
select public.revoke_private_share(current_setting('test.private_id')::uuid);
select is(public.read_shared_private_exercise(repeat('b', 64))::text, null::text,
  'revocation removes anonymous access');

select * from finish();
rollback;
