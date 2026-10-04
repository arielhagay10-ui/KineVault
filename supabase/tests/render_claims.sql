begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(15);
select has_column('public', 'render_jobs', 'claim_id', 'render attempts have a generation identifier');
select has_function('public', 'complete_render_job', array['uuid','uuid','uuid','text','text','text'], 'completion requires a claim identifier');
select has_function('public', 'fail_render_job', array['uuid','uuid','text'], 'failure requires a claim identifier');

-- Keep this fixture independent of any queued development jobs; all changes roll back.
update public.render_jobs set queued_at = now() + interval '1 day' where status = 'queued';
update public.render_jobs set started_at = now() + interval '1 day' where status = 'running';
insert into auth.users(id,email,aud,role) values
  ('00000000-0000-4000-8000-000000000171','render-claim@example.test','authenticated','authenticated');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000171',true);
select set_config('test.private_id',public.save_private_exercise(
  p_name=>'Render Claim Fixture',p_family_slug=>'lateral-raise',
  p_primary_muscle_slugs=>array['lateral-deltoid'],p_joint_action_slugs=>array['shoulder-abduction']
)::text,true);
select public.save_private_scene(current_setting('test.private_id')::uuid,
  '{"durationMs":1000,"cameraAngle":"front","equipment":null,"keyframes":[{"timeMs":0,"poses":{"left-shoulder":{"z":0}}},{"timeMs":1000,"poses":{"left-shoulder":{"z":-70}}}]}'::jsonb);
select public.submit_private_exercise(current_setting('test.private_id')::uuid,'new');
set local role service_role;
select set_config('test.job_id',job_id::text,true), set_config('test.old_claim',claim_id::text,true)
from public.claim_render_job();
set local role postgres;
update public.render_jobs set started_at = clock_timestamp() - interval '11 minutes'
where id=current_setting('test.job_id')::uuid;
set local role service_role;
select throws_ok($$select public.complete_render_job(current_setting('test.job_id')::uuid,
  current_setting('test.old_claim')::uuid,gen_random_uuid(),'a','b','c')$$,
  'P0001','render claim is expired or no longer current','completion rejects an expired lease before a retry starts');
select throws_ok($$select public.fail_render_job(current_setting('test.job_id')::uuid,
  current_setting('test.old_claim')::uuid,'render_error')$$,
  'P0001','render claim is expired or no longer current','failure rejects an expired lease before a retry starts');
set local role postgres;
select is((select status::text from public.render_jobs where id=current_setting('test.job_id')::uuid),'running',
  'expired callbacks cannot change the job');
set local role service_role;
select set_config('test.new_claim',(select claim_id from public.claim_render_job())::text,true);
select isnt(current_setting('test.old_claim'),current_setting('test.new_claim'),'reclaim creates a different generation');
select throws_ok($$select public.complete_render_job(current_setting('test.job_id')::uuid,
  current_setting('test.old_claim')::uuid,gen_random_uuid(),'a','b','c')$$,
  'P0001','render claim is expired or no longer current','stale completion cannot complete the replacement claim');
select throws_ok($$select public.fail_render_job(current_setting('test.job_id')::uuid,
  current_setting('test.old_claim')::uuid,'render_error')$$,
  'P0001','render claim is expired or no longer current','stale failure cannot requeue the replacement claim');
set local role postgres;
select is((select attempt_count from public.render_jobs where id=current_setting('test.job_id')::uuid),2,
  'stale callbacks do not consume another attempt');
set local role service_role;
select lives_ok($$select public.fail_render_job(current_setting('test.job_id')::uuid,
  current_setting('test.new_claim')::uuid,'render_error')$$,'current claim can schedule its retry');
set local role postgres;
select is((select status::text from public.render_jobs where id=current_setting('test.job_id')::uuid),'queued',
  'current failure queues a bounded retry');
select is((select claim_id from public.render_jobs where id=current_setting('test.job_id')::uuid),null::uuid,
  'a queued retry invalidates its previous identifier');
set local role service_role;
select throws_ok($$select public.fail_render_job(current_setting('test.job_id')::uuid,
  current_setting('test.new_claim')::uuid,'render_error')$$,
  'P0001','render claim is expired or no longer current','duplicate failure cannot schedule another retry');
select ok(not has_function_privilege('authenticated','public.complete_render_job(uuid,uuid,uuid,text,text,text)','execute')
  and not has_function_privilege('anon','public.fail_render_job(uuid,uuid,text)','execute'),
  'claim mutation remains restricted to the service role');
select * from finish();
rollback;
