begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(26);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-000000000071', 'submit-owner@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000072', 'submit-other@example.test', 'authenticated', 'authenticated');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000071', true);
select set_config('test.private_id', public.save_private_exercise(
  p_name => 'My Original Cable Raise', p_family_slug => 'lateral-raise',
  p_primary_muscle_slugs => array['lateral-deltoid'],
  p_joint_action_slugs => array['shoulder-abduction'],
  p_equipment_slugs => array['cable']
)::text, true);
select throws_ok(
  $$select public.submit_private_exercise(current_setting('test.private_id')::uuid, 'new')$$,
  'P0001', 'a complete motion demonstration is required',
  'a contributor must build a motion demo before submitting'
);
select public.save_private_scene(current_setting('test.private_id')::uuid,
  '{"durationMs":2000,"cameraAngle":"front","equipment":{"slug":"single-cable","x":0,"y":0,"z":0,"scale":1},"keyframes":[{"timeMs":0,"poses":{"left-shoulder":{"z":0}}},{"timeMs":2000,"poses":{"left-shoulder":{"z":-75}}}]}'::jsonb);
select set_config('test.submission_id', public.submit_private_exercise(
  current_setting('test.private_id')::uuid, 'new', null, true
)::text, true);
select is((select status::text from public.exercise_submissions
  where id = current_setting('test.submission_id')::uuid), 'submitted',
  'submission enters the queue');
select is((select allow_motion_reuse from public.exercise_submissions
  where id = current_setting('test.submission_id')::uuid), true,
  'reuse consent is recorded explicitly');
select isnt((select original_content_id from public.exercise_submissions
  where id = current_setting('test.submission_id')::uuid),
  (select content_id from public.private_exercises
    where id = current_setting('test.private_id')::uuid),
  'submission has an independent content snapshot');
select is((select count(*)::integer from public.motion_keyframes frame
  join public.exercise_scenes scene on scene.id = frame.scene_id
  join public.exercise_submissions submission on submission.original_content_id = scene.content_id
  where submission.id = current_setting('test.submission_id')::uuid), 2,
  'submitted scene contains the original keyframes');
select is((select count(*)::integer from public.render_jobs job
  join public.exercise_scenes scene on scene.id = job.scene_id
  join public.exercise_submissions submission on submission.original_content_id = scene.content_id
  where submission.id = current_setting('test.submission_id')::uuid), 1,
  'submission queues a render job');
set local role service_role;
select set_config('test.job_id',job_id::text,true), set_config('test.claim_id',claim_id::text,true)
from public.claim_render_job();
select set_config('test.render_scene', public.read_render_scene(current_setting('test.job_id')::uuid)::text, true);
set local role postgres;
select is(jsonb_array_length(current_setting('test.render_scene')::jsonb->'keyframes'), 2,
  'the worker sees only the claimed scene keyframes');
select is((select status::text from public.render_jobs
  where id = current_setting('test.job_id')::uuid), 'running',
  'the worker claims a queued render job');
select is((select attempt_count from public.render_jobs
  where id = current_setting('test.job_id')::uuid), 1,
  'claiming a job increments its attempt count');
set local role service_role;
select throws_ok(
  $$select public.complete_render_job(
    current_setting('test.job_id')::uuid, current_setting('test.claim_id')::uuid, gen_random_uuid(),
    current_setting('test.submission_id') || '/' || current_setting('test.job_id') || '/' || current_setting('test.claim_id') || '/demo.webm',
    current_setting('test.submission_id') || '/' || current_setting('test.job_id') || '/' || current_setting('test.claim_id') || '/demo.mp4',
    current_setting('test.submission_id') || '/' || current_setting('test.job_id') || '/' || current_setting('test.claim_id') || '/poster.webp')$$,
  'P0001', 'render outputs are missing from private storage',
  'a job cannot complete before its files exist'
);
set local role postgres;
insert into storage.objects (bucket_id, name) values
  ('exercise-private', current_setting('test.submission_id') || '/' || current_setting('test.job_id') || '/' || current_setting('test.claim_id') || '/demo.webm'),
  ('exercise-private', current_setting('test.submission_id') || '/' || current_setting('test.job_id') || '/' || current_setting('test.claim_id') || '/demo.mp4'),
  ('exercise-private', current_setting('test.submission_id') || '/' || current_setting('test.job_id') || '/' || current_setting('test.claim_id') || '/poster.webp');
set local role service_role;
select public.complete_render_job(
  current_setting('test.job_id')::uuid, current_setting('test.claim_id')::uuid, gen_random_uuid(),
  current_setting('test.submission_id') || '/' || current_setting('test.job_id') || '/' || current_setting('test.claim_id') || '/demo.webm',
  current_setting('test.submission_id') || '/' || current_setting('test.job_id') || '/' || current_setting('test.claim_id') || '/demo.mp4',
  current_setting('test.submission_id') || '/' || current_setting('test.job_id') || '/' || current_setting('test.claim_id') || '/poster.webp'
);
set local role postgres;
select is((select status::text from public.render_jobs
  where id = current_setting('test.job_id')::uuid), 'succeeded',
  'successful rendering completes the job');
select is((select count(*)::integer from public.submission_media
  where submission_id = current_setting('test.submission_id')::uuid), 3,
  'WebM, MP4, and poster are grouped as submission media');
select is((select count(*)::integer from public.exercise_media
  where content_id = (select original_content_id from public.exercise_submissions
    where id = current_setting('test.submission_id')::uuid)
    and storage_bucket = 'exercise-private'), 3,
  'render output stays in private storage before approval');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000071', true);
select is((select count(*)::integer from storage.objects
  where bucket_id = 'exercise-private'), 3,
  'the contributor can read their private render files');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000072', true);
select is((select count(*)::integer from storage.objects
  where bucket_id = 'exercise-private'), 0,
  'another user cannot read private render files');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000071', true);
select is((select count(*)::integer from public.moderation_events
  where submission_id = current_setting('test.submission_id')::uuid and action = 'submit'), 1,
  'submission writes an audit event');

select public.save_private_exercise(
  p_private_id => current_setting('test.private_id')::uuid,
  p_name => 'My Revised Cable Raise', p_family_slug => 'lateral-raise',
  p_primary_muscle_slugs => array['lateral-deltoid'],
  p_joint_action_slugs => array['shoulder-abduction']
);
select is((select name from public.exercise_content
  where id = (select original_content_id from public.exercise_submissions
    where id = current_setting('test.submission_id')::uuid)),
  'My Original Cable Raise', 'private edits do not change the submitted snapshot');
select is((select name from public.exercise_content
  where id = (select content_id from public.private_exercises
    where id = current_setting('test.private_id')::uuid)),
  'My Revised Cable Raise', 'the private source remains editable');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000072', true);
select throws_ok(
  $$select public.submit_private_exercise(current_setting('test.private_id')::uuid, 'new')$$,
  'P0001', 'private exercise not found', 'another user cannot submit the draft'
);
select throws_ok(
  $$select public.withdraw_submission(current_setting('test.submission_id')::uuid)$$,
  'P0001', 'submission cannot be withdrawn', 'another user cannot withdraw a submission'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000071', true);
select public.withdraw_submission(current_setting('test.submission_id')::uuid);
select is((select status::text from public.exercise_submissions
  where id = current_setting('test.submission_id')::uuid), 'withdrawn',
  'the owner can withdraw before review');

select set_config('test.novel_private_id', public.save_private_exercise(
  p_name => 'Novel Movement'
)::text, true);
select public.save_private_scene(current_setting('test.novel_private_id')::uuid,
  '{"durationMs":1000,"cameraAngle":"front","equipment":null,"keyframes":[{"timeMs":0,"poses":{"left-shoulder":{"z":0}}},{"timeMs":1000,"poses":{"left-shoulder":{"z":-30}}}]}'::jsonb);
select set_config('test.novel_submission_id', public.submit_private_exercise(
  current_setting('test.novel_private_id')::uuid, 'new',
  p_suggestions => '[{"taxonomyName":"exercise_families","suggestedName":"Novel Family"},{"taxonomyName":"muscles","suggestedName":"Novel Muscle"},{"taxonomyName":"joint_actions","suggestedName":"Novel Joint Action"}]'::jsonb
)::text, true);
select is((select count(*)::integer from public.taxonomy_suggestions
  where submission_id = current_setting('test.novel_submission_id')::uuid), 3,
  'missing canonical taxonomy values are attached as reviewable suggestions');
select is((select status::text from public.exercise_submissions
  where id = current_setting('test.novel_submission_id')::uuid), 'submitted',
  'an exercise with complete suggestions can enter review');
set local role postgres;
update public.exercise_submissions set status = 'changes_requested'
where id = current_setting('test.novel_submission_id')::uuid;
set local role authenticated;
select set_config('test.revision_id', public.submit_private_exercise(
  current_setting('test.novel_private_id')::uuid, 'new',
  p_revision_of_id => current_setting('test.novel_submission_id')::uuid,
  p_suggestions => '[{"taxonomyName":"exercise_families","suggestedName":"Novel Family"},{"taxonomyName":"muscles","suggestedName":"Novel Muscle"},{"taxonomyName":"joint_actions","suggestedName":"Novel Joint Action"}]'::jsonb
)::text, true);
select is((select revision_of_id from public.exercise_submissions
  where id = current_setting('test.revision_id')::uuid),
  current_setting('test.novel_submission_id')::uuid,
  'a requested change creates a linked new revision');
select is((select status::text from public.exercise_submissions
  where id = current_setting('test.novel_submission_id')::uuid), 'withdrawn',
  'the superseded revision leaves the active review queue');
select isnt((select original_content_id from public.exercise_submissions
  where id = current_setting('test.revision_id')::uuid),
  (select original_content_id from public.exercise_submissions
    where id = current_setting('test.novel_submission_id')::uuid),
  'the revision has a separate immutable snapshot');

select * from finish();
rollback;
