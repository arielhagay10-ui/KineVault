begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(18);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-000000000081', 'review-owner@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000082', 'reviewer@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000083', 'review-outsider@example.test', 'authenticated', 'authenticated');
update public.roles set role = 'reviewer' where user_id = '00000000-0000-4000-8000-000000000082';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000081', true);
select set_config('test.private_id', public.save_private_exercise(
  p_name => 'Reviewable Raise', p_family_slug => 'lateral-raise',
  p_primary_muscle_slugs => array['lateral-deltoid'],
  p_joint_action_slugs => array['shoulder-abduction']
)::text, true);
select public.save_private_scene(current_setting('test.private_id')::uuid,
  '{"durationMs":1000,"cameraAngle":"front","equipment":null,"keyframes":[{"timeMs":0,"poses":{"left-shoulder":{"z":0}}},{"timeMs":1000,"poses":{"left-shoulder":{"z":-70}}}]}'::jsonb);
select set_config('test.submission_id', public.submit_private_exercise(
  current_setting('test.private_id')::uuid, 'new')::text, true);

select throws_ok(
  $$select public.begin_submission_review(current_setting('test.submission_id')::uuid)$$,
  'P0001', 'reviewer role required', 'a contributor cannot start review'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000083', true);
select throws_ok(
  $$select public.begin_submission_review(current_setting('test.submission_id')::uuid)$$,
  'P0001', 'reviewer role required', 'another ordinary user cannot start review'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000082', true);
select public.begin_submission_review(current_setting('test.submission_id')::uuid);
select is((select status::text from public.exercise_submissions
  where id = current_setting('test.submission_id')::uuid), 'in_review',
  'reviewer moves submission into review');
select isnt((select editorial_content_id from public.exercise_submissions
  where id = current_setting('test.submission_id')::uuid),
  (select original_content_id from public.exercise_submissions
    where id = current_setting('test.submission_id')::uuid),
  'reviewer receives an independent editorial copy');
select is((select count(*)::integer from public.motion_keyframes frame
  join public.exercise_scenes scene on scene.id = frame.scene_id
  join public.exercise_submissions submission on submission.editorial_content_id = scene.content_id
  where submission.id = current_setting('test.submission_id')::uuid), 2,
  'editorial copy includes the reviewable motion source');
select public.edit_submission_classifications(current_setting('test.submission_id')::uuid,
  '{"name":"Editorial Raise","muscles":[{"slug":"lateral-deltoid","role":"primary"}],"resistance_profile":"ascending"}'::jsonb,
  'Corrected the exercise name and resistance curve.');
select is((select name from public.exercise_content c join public.exercise_submissions s
  on s.editorial_content_id = c.id where s.id = current_setting('test.submission_id')::uuid),
  'Editorial Raise', 'reviewer can correct editorial content');
select is((select name from public.exercise_content c join public.exercise_submissions s
  on s.original_content_id = c.id where s.id = current_setting('test.submission_id')::uuid),
  'Reviewable Raise', 'original submission is immutable');
select is((select count(*)::integer from public.moderation_field_changes fc
  join public.moderation_events e on e.id = fc.event_id
  where e.submission_id = current_setting('test.submission_id')::uuid), 2,
  'each changed field has a recorded before and after value');
select is((select before_value #>> '{}' from public.moderation_field_changes fc
  join public.moderation_events e on e.id = fc.event_id
  where e.submission_id = current_setting('test.submission_id')::uuid and field_name = 'name'),
  'Reviewable Raise', 'audit records the previous classification');
with changed as (
  update public.exercise_content set name = 'Unaudited correction'
  where id = (select editorial_content_id from public.exercise_submissions
    where id = current_setting('test.submission_id')::uuid) returning id
) select is((select count(*)::integer from changed),0,
  'reviewers cannot bypass the audited edit operation');
select throws_ok(
  $$select public.edit_submission_classifications(current_setting('test.submission_id')::uuid,
    '{"muscles":[{"slug":"imaginary-muscle","role":"primary"}]}'::jsonb,
    'Trying an invalid taxonomy.')$$,
  'P0001', 'unknown taxonomy value', 'review edits validate relational taxonomies'
);
select throws_ok(
  $$select public.request_submission_changes(current_setting('test.submission_id')::uuid,
    'poor_media', 'bad')$$,
  'P0001', 'a reason and useful comment are required',
  'reviewer must leave a useful change request'
);
select public.request_submission_changes(current_setting('test.submission_id')::uuid,
  'poor_media', 'Please show the full range from the side.');
select is((select status::text from public.exercise_submissions
  where id = current_setting('test.submission_id')::uuid), 'changes_requested',
  'requesting changes updates status');
select is((select count(*)::integer from public.moderation_reviews
  where submission_id = current_setting('test.submission_id')::uuid
    and action = 'request_changes'), 1,
  'requesting changes records a structured review');
select is((select count(*)::integer from public.moderation_events
  where submission_id = current_setting('test.submission_id')::uuid), 4,
  'submit, begin review, edit, and request changes are audited');
select throws_ok(
  $$select public.reject_submission(current_setting('test.submission_id')::uuid,
    'duplicate', 'This is a duplicate.')$$,
  'P0001', 'submission must be in review',
  'a resolved review cannot be rejected without a new review cycle'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000081', true);
select set_config('test.revision_id', public.submit_private_exercise(
  current_setting('test.private_id')::uuid, 'new',
  p_revision_of_id => current_setting('test.submission_id')::uuid
)::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000082', true);
select public.begin_submission_review(current_setting('test.revision_id')::uuid);
select public.reject_submission(current_setting('test.revision_id')::uuid,
  'duplicate', 'This is the same motion as the existing variation.');
select is((select status::text from public.exercise_submissions
  where id = current_setting('test.revision_id')::uuid), 'rejected',
  'reviewer can reject a revised submission with a reason');
select is((select count(*)::integer from public.moderation_reviews
  where submission_id = current_setting('test.revision_id')::uuid
    and action = 'reject'), 1,
  'rejection persists the structured review');

select * from finish();
rollback;
