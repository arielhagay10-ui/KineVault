begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

select is((select count(*)::integer from public.exercises), 20, 'twenty original catalog candidates are seeded');
select is((select count(*)::integer from public.joint_actions), 34, 'joint actions are a normalized taxonomy');
select is((
  select count(*)::integer
  from public.exercises e
  join public.exercise_joint_actions eja on eja.content_id = e.current_content_id
  join public.joint_actions ja on ja.id = eja.joint_action_id
  join public.exercise_equipment ee on ee.content_id = e.current_content_id
  join public.equipment q on q.id = ee.equipment_id
  where ja.slug = 'shoulder-abduction' and q.slug = 'cable'
), 3, 'cable and shoulder-abduction intersection finds three variations');
select is((select count(*)::integer from public.exercises where status = 'published'), 0,
  'candidates without reviewed media are unpublished');

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-000000000001', 'owner-one@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000002', 'owner-two@example.test', 'authenticated', 'authenticated');

select is((select count(*)::integer from public.roles where role = 'user'), 2,
  'Auth trigger assigns ordinary user role');

insert into public.exercise_content (id, kind, owner_id, name) values
  ('10000000-0000-4000-8000-000000000001', 'private_draft', '00000000-0000-4000-8000-000000000001', 'Owner One Private Raise'),
  ('10000000-0000-4000-8000-000000000002', 'private_draft', '00000000-0000-4000-8000-000000000002', 'Owner Two Private Raise'),
  ('10000000-0000-4000-8000-000000000003', 'submission_original', '00000000-0000-4000-8000-000000000001', 'Owner One Submission');
insert into public.private_exercises (owner_id, content_id) values
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002');
insert into public.exercise_submissions (owner_id, original_content_id, status) values
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'submitted');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.exercise_content where name = 'Owner One Private Raise'), 1,
  'owner can read a private draft');
select is((select count(*)::integer from public.exercise_content where name = 'Owner Two Private Raise'), 0,
  'owner cannot read another private draft');
select is((select count(*)::integer from public.exercises), 0,
  'authenticated users cannot read unpublished catalog candidates');
select ok(not has_table_privilege('authenticated', 'public.roles', 'INSERT'),
  'authenticated users cannot grant themselves roles');

reset role;
update public.roles set role = 'reviewer' where user_id = '00000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.exercise_content where name = 'Owner One Submission'), 1,
  'reviewer can read submitted content');
select is((select count(*)::integer from public.exercise_content where name = 'Cable Lateral Raise'), 1,
  'reviewer can inspect unpublished catalog candidates');
select is((select count(*)::integer from public.exercise_content where name = 'Owner One Private Raise'), 0,
  'reviewer cannot read unrelated private drafts');

select * from finish();
rollback;
