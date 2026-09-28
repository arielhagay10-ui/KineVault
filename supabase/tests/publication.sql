begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(20);

insert into auth.users(id,email,aud,role) values
  ('00000000-0000-4000-8000-000000000091','publish-owner@example.test','authenticated','authenticated'),
  ('00000000-0000-4000-8000-000000000092','publish-reviewer@example.test','authenticated','authenticated');
update public.roles set role = 'reviewer' where user_id = '00000000-0000-4000-8000-000000000092';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);
select set_config('test.private_id',public.save_private_exercise(
  p_name => 'Publication Cable Raise',p_family_slug => 'lateral-raise',
  p_primary_muscle_slugs => array['lateral-deltoid'],
  p_joint_action_slugs => array['shoulder-abduction'],p_equipment_slugs => array['cable']
)::text,true);
select public.save_private_scene(current_setting('test.private_id')::uuid,
  '{"durationMs":1000,"cameraAngle":"front","equipment":null,"keyframes":[{"timeMs":0,"poses":{"left-shoulder":{"z":0}}},{"timeMs":1000,"poses":{"left-shoulder":{"z":-70}}}]}'::jsonb);
select set_config('test.submission_id',public.submit_private_exercise(current_setting('test.private_id')::uuid,'new')::text,true);
select throws_ok($$select public.approve_submission(current_setting('test.submission_id')::uuid,'publication-raise')$$,
  'P0001','reviewer role required','contributors cannot publish themselves');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000092',true);
select public.begin_submission_review(current_setting('test.submission_id')::uuid);
select throws_ok($$select public.approve_submission(current_setting('test.submission_id')::uuid,'publication-raise')$$,
  'P0001','rendered demonstration is incomplete','approval waits for all rendered assets');
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
select throws_ok($$select public.approve_submission(current_setting('test.submission_id')::uuid,'publication-raise')$$,
  'P0001','public media object missing: webm','approval verifies copied public objects');
set local role postgres;
insert into storage.objects(bucket_id,name) values
  ('exercise-public','submissions/' || current_setting('test.submission_id') || '/demo.webm'),
  ('exercise-public','submissions/' || current_setting('test.submission_id') || '/demo.mp4'),
  ('exercise-public','submissions/' || current_setting('test.submission_id') || '/demo.webp');
set local role anon;
select is((select count(*)::integer from storage.objects where bucket_id = 'exercise-public'),0,'staged approval media is not anonymously readable');
set local role authenticated;
select throws_ok($$select public.approve_submission(current_setting('test.submission_id')::uuid,'cable-lateral-raise')$$,
  '23505',null,'slug collision rolls back publication');
select is((select status::text from public.exercise_submissions where id = current_setting('test.submission_id')::uuid),'in_review','failed publication leaves the review unresolved');
select set_config('test.exercise_id',public.approve_submission(current_setting('test.submission_id')::uuid,'publication-raise')::text,true);
set constraints all immediate;
set local role anon;
select is((select count(*)::integer from storage.objects where bucket_id = 'exercise-public'),3,'catalog visitors can read approved media only');
set local role authenticated;
select is((select status::text from public.exercise_submissions where id = current_setting('test.submission_id')::uuid),'approved','approval resolves the submission');
select is((select count(*)::integer from public.exercise_versions where exercise_id = current_setting('test.exercise_id')::uuid),1,'approval records the first immutable version');
select is((select count(*)::integer from public.explore_exercises(joint_action_slugs => array['shoulder-abduction'],equipment_slugs => array['cable'])),1,'approved content appears in combined search');
select is((select count(*)::integer from public.exercise_media m join public.exercises e on e.current_content_id = m.content_id
  where e.id = current_setting('test.exercise_id')::uuid and m.storage_bucket = 'exercise-public'),3,'published version uses public media');
select throws_ok($$select public.approve_submission(current_setting('test.submission_id')::uuid,'publication-raise-again')$$,
  'P0001','submission must be in review','approval cannot run twice');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);
select public.save_private_exercise(p_private_id => current_setting('test.private_id')::uuid,
  p_name => 'Alternate Raise Alias',p_family_slug => 'lateral-raise',
  p_primary_muscle_slugs => array['lateral-deltoid'],p_joint_action_slugs => array['shoulder-abduction']);
select set_config('test.merge_id',public.submit_private_exercise(current_setting('test.private_id')::uuid,
  'possible_duplicate',current_setting('test.exercise_id')::uuid,true)::text,true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000092',true);
select public.begin_submission_review(current_setting('test.merge_id')::uuid);
select throws_ok($$select public.merge_submission(current_setting('test.merge_id')::uuid,gen_random_uuid(),'Same movement under another name.')$$,
  'P0001','merge target is not published','merge target must be canonical and published');
select public.merge_submission(current_setting('test.merge_id')::uuid,current_setting('test.exercise_id')::uuid,'Same movement under another name.');
select is((select status::text from public.exercise_submissions where id = current_setting('test.merge_id')::uuid),'merged','merge resolves the duplicate');
select is((select count(*)::integer from public.exercise_versions where exercise_id = current_setting('test.exercise_id')::uuid),2,'merge produces a new immutable canonical version');
select is((select count(*)::integer from public.explore_exercises(search_text => 'Alternate Raise Alias')),1,'merged alias is searchable');
select is((select merged_into_exercise_id from public.exercise_submissions where id = current_setting('test.merge_id')::uuid),current_setting('test.exercise_id')::uuid,'merge keeps canonical identity');
select is((select count(*)::integer from public.exercise_media m join public.exercise_versions v on v.content_id = m.content_id
  where v.exercise_id = current_setting('test.exercise_id')::uuid),6,'both versions retain media metadata');
select is((select count(*)::integer from public.moderation_reviews where submission_id = current_setting('test.merge_id')::uuid and action = 'merge'),1,'merge reason is audited');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);
select set_config('test.copy_id',public.copy_public_exercise(current_setting('test.exercise_id')::uuid)::text,true);
select is((select count(*)::integer from public.exercise_scenes scene join public.private_exercises pe on pe.content_id = scene.content_id
  where pe.id = current_setting('test.copy_id')::uuid),0,'alias merge preserves the original motion author consent');
select * from finish();
rollback;
