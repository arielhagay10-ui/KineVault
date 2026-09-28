begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
select plan(9);
insert into auth.users(id,email,aud,role) values
 ('00000000-0000-4000-8000-000000000151','candidate-reviewer@example.test','authenticated','authenticated'),
 ('00000000-0000-4000-8000-000000000152','candidate-user@example.test','authenticated','authenticated');
update public.roles set role='reviewer' where user_id='00000000-0000-4000-8000-000000000151';
select set_config('test.candidate_id',(select id::text from public.exercises where slug='dumbbell-lateral-raise'),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000152',true);
select throws_ok($$select public.prepare_catalog_candidate(current_setting('test.candidate_id')::uuid)$$,'P0001','reviewer role required','ordinary users cannot prepare unpublished seeds');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000151',true);
select set_config('test.private_id',public.prepare_catalog_candidate(current_setting('test.candidate_id')::uuid)::text,true);
select is(public.prepare_catalog_candidate(current_setting('test.candidate_id')::uuid),current_setting('test.private_id')::uuid,'preparing again resumes the existing private draft');
select is((select catalog_candidate_id from public.private_exercises where id=current_setting('test.private_id')::uuid),current_setting('test.candidate_id')::uuid,'draft retains explicit candidate provenance');
select public.save_private_scene(current_setting('test.private_id')::uuid,
 '{"durationMs":1000,"cameraAngle":"front","equipment":null,"keyframes":[{"timeMs":0,"poses":{"left-shoulder":{"z":0}}},{"timeMs":1000,"poses":{"left-shoulder":{"z":-70}}}]}');
select set_config('test.submission_id',public.submit_private_exercise(current_setting('test.private_id')::uuid,'new')::text,true);
select is((select catalog_candidate_id from public.exercise_submissions where id=current_setting('test.submission_id')::uuid),current_setting('test.candidate_id')::uuid,'submission freezes candidate provenance');
select public.begin_submission_review(current_setting('test.submission_id')::uuid);
set local role service_role;
select set_config('test.job_id',(select job_id from public.claim_render_job())::text,true);
set local role postgres;
insert into storage.objects(bucket_id,name) values
  ('exercise-private',current_setting('test.submission_id') || '/' || current_setting('test.job_id') || '/demo.webm'),
  ('exercise-private',current_setting('test.submission_id') || '/' || current_setting('test.job_id') || '/demo.mp4'),
  ('exercise-private',current_setting('test.submission_id') || '/' || current_setting('test.job_id') || '/poster.webp');
set local role service_role;
select public.complete_render_job(current_setting('test.job_id')::uuid,gen_random_uuid(),
  current_setting('test.submission_id') || '/' || current_setting('test.job_id') || '/demo.webm',
  current_setting('test.submission_id') || '/' || current_setting('test.job_id') || '/demo.mp4',
  current_setting('test.submission_id') || '/' || current_setting('test.job_id') || '/poster.webp');
set local role authenticated;
set local role postgres;
insert into storage.objects(bucket_id,name) values
  ('exercise-public','submissions/' || current_setting('test.submission_id') || '/demo.webm'),
  ('exercise-public','submissions/' || current_setting('test.submission_id') || '/demo.mp4'),
  ('exercise-public','submissions/' || current_setting('test.submission_id') || '/demo.webp');

set local role authenticated;
select throws_ok($$select public.approve_submission(current_setting('test.submission_id')::uuid,'wrong-slug',p_candidate_exercise_id=>current_setting('test.candidate_id')::uuid)$$,
 'P0001','catalog candidate must keep its stable slug','candidate URLs stay stable');
select throws_ok($$select public.approve_submission(current_setting('test.submission_id')::uuid,'dumbbell-lateral-raise',p_candidate_exercise_id=>gen_random_uuid())$$,
 'P0001','candidate does not match submission source','approval cannot replace another candidate');
select is(public.approve_submission(current_setting('test.submission_id')::uuid,'dumbbell-lateral-raise',p_candidate_exercise_id=>current_setting('test.candidate_id')::uuid),
 current_setting('test.candidate_id')::uuid,'approval reuses the canonical UUID');
set constraints all immediate;
select is((select count(*)::integer from public.exercise_versions where exercise_id=current_setting('test.candidate_id')::uuid),1,'candidate has an immutable approved version');
set local role anon;
select is((select count(*)::integer from public.explore_exercises(search_text=>'Dumbbell Lateral Raise')),1,'approved original appears in search');
select * from finish();
rollback;
