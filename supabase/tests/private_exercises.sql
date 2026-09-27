begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(15);

select ok(has_function_privilege('authenticated', 'public.save_private_exercise(uuid,text,text,text,text[],text[],text[],text[],text[],text[],public.resistance_profile,text)', 'EXECUTE'),
  'authenticated users can save private exercises');
select ok(not has_function_privilege('anon', 'public.save_private_exercise(uuid,text,text,text,text[],text[],text[],text[],text[],text[],public.resistance_profile,text)', 'EXECUTE'),
  'anonymous visitors cannot save private exercises');

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-000000000021', 'draft-owner@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000022', 'other-owner@example.test', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000021', true);
select set_config('test.private_id', public.save_private_exercise(
  p_name => 'Private Cable Raise',
  p_short_description => 'A private draft.',
  p_family_slug => 'lateral-raise',
  p_primary_muscle_slugs => array['lateral-deltoid'],
  p_joint_action_slugs => array['shoulder-abduction'],
  p_equipment_slugs => array['cable'],
  p_body_position_slug => 'standing'
)::text, true);

select is((select count(*)::integer from public.private_exercises
  where id = current_setting('test.private_id')::uuid and owner_id = auth.uid()), 1,
  'new private exercise belongs to the caller');
select is((select count(*)::integer from public.exercise_muscles em
  join public.private_exercises pe on pe.content_id = em.content_id
  where pe.id = current_setting('test.private_id')::uuid and em.role = 'primary'), 1,
  'muscles are saved relationally');
select is((select count(*)::integer from public.exercise_joint_actions eja
  join public.private_exercises pe on pe.content_id = eja.content_id
  where pe.id = current_setting('test.private_id')::uuid), 1,
  'joint actions are saved relationally');
select is((select count(*)::integer from public.exercise_joints ej
  join public.private_exercises pe on pe.content_id = ej.content_id
  where pe.id = current_setting('test.private_id')::uuid), 1,
  'the joint is derived from its selected action');
select is((select count(*)::integer from public.exercise_equipment ee
  join public.private_exercises pe on pe.content_id = ee.content_id
  where pe.id = current_setting('test.private_id')::uuid), 1,
  'equipment is saved relationally');
select is((select count(*)::integer from public.exercise_biomechanics b
  join public.private_exercises pe on pe.content_id = b.content_id
  join public.body_positions bp on bp.id = b.body_position_id
  where pe.id = current_setting('test.private_id')::uuid and bp.slug = 'standing'), 1,
  'body position is a taxonomy relationship');

select public.save_private_exercise(
  p_private_id => current_setting('test.private_id')::uuid,
  p_name => 'Private Dumbbell Curl',
  p_primary_muscle_slugs => array['biceps-brachii'],
  p_joint_action_slugs => array['elbow-flexion'],
  p_equipment_slugs => array['dumbbell']
);
select is((select c.name from public.exercise_content c
  join public.private_exercises pe on pe.content_id = c.id
  where pe.id = current_setting('test.private_id')::uuid), 'Private Dumbbell Curl',
  'editing changes the private content');
select is((select count(*)::integer from public.exercise_muscles em
  join public.private_exercises pe on pe.content_id = em.content_id
  join public.muscles m on m.id = em.muscle_id
  where pe.id = current_setting('test.private_id')::uuid and m.slug = 'lateral-deltoid'), 0,
  'editing removes replaced classifications');
select is((select count(*)::integer from public.exercise_muscles em
  join public.private_exercises pe on pe.content_id = em.content_id
  join public.muscles m on m.id = em.muscle_id
  where pe.id = current_setting('test.private_id')::uuid and m.slug = 'biceps-brachii'), 1,
  'editing saves new classifications');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000022', true);
select throws_ok(
  $$select public.save_private_exercise(p_private_id => current_setting('test.private_id')::uuid, p_name => 'Stolen Draft')$$,
  'P0001', 'private exercise not found', 'another user cannot edit the draft'
);
select throws_ok(
  $$select public.delete_private_exercise(current_setting('test.private_id')::uuid)$$,
  'P0001', 'private exercise not found', 'another user cannot delete the draft'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000021', true);
select set_config('test.content_id', (select content_id::text from public.private_exercises
  where id = current_setting('test.private_id')::uuid), true);
select public.delete_private_exercise(current_setting('test.private_id')::uuid);
select is((select count(*)::integer from public.private_exercises
  where id = current_setting('test.private_id')::uuid), 0,
  'owner can delete the private record');
select is((select count(*)::integer from public.exercise_content
  where id = current_setting('test.content_id')::uuid), 0,
  'deleting a draft removes its content and relationships');

select * from finish();
rollback;
