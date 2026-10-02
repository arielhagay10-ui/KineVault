begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users(id,email,role,aud) values
 ('00000000-0000-4000-8000-000000000171','idempotent-owner@example.test','authenticated','authenticated'),
 ('00000000-0000-4000-8000-000000000172','idempotent-other@example.test','authenticated','authenticated');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000171',true);
select set_config('test.idempotent_scene','{"durationMs":3200,"cameraAngle":"front","equipment":null,"keyframes":[{"timeMs":0,"poses":{}},{"timeMs":3200,"poses":{}}]}',true);
select is(public.save_workshop_draft(current_setting('test.idempotent_scene')::jsonb,'First save','00000000-0000-4000-8000-000000000173',true),'00000000-0000-4000-8000-000000000173'::uuid,'client UUID used for first save');
select is(public.save_workshop_draft(current_setting('test.idempotent_scene')::jsonb,'Retried save','00000000-0000-4000-8000-000000000173',true),'00000000-0000-4000-8000-000000000173'::uuid,'lost-response retry reuses UUID');
select is((select count(*)::integer from private_exercises where owner_id=auth.uid()),1,'retry creates one private exercise');
select is((select count(*)::integer from exercise_content where owner_id=auth.uid()),1,'retry creates one content record');
select lives_ok($$select public.save_private_metadata('{"muscles":[{"slug":"lateral-deltoid","role":"primary"}]}'::jsonb,'00000000-0000-4000-8000-000000000173')$$,'existing metadata can be classified');
select is(public.save_workshop_draft(current_setting('test.idempotent_scene')::jsonb,'Named again','00000000-0000-4000-8000-000000000173',true),'00000000-0000-4000-8000-000000000173'::uuid,'retry on existing exercise updates name and scene');
select is((select count(*)::integer from exercise_muscles m join private_exercises p on p.content_id=m.content_id where p.id='00000000-0000-4000-8000-000000000173'),1,'name-only save preserves classification');
select throws_ok($$select public.save_workshop_draft(current_setting('test.idempotent_scene')::jsonb,'Missing existing','00000000-0000-4000-8000-000000000174')$$,'P0001',null,'missing existing exercise is not recreated without creation flag');
select throws_ok($$select public.save_workshop_draft(jsonb_set(current_setting('test.idempotent_scene')::jsonb,'{durationMs}','0'),'Broken first scene','00000000-0000-4000-8000-000000000175',true)$$,null,null,'invalid first scene rolls back creation');
select is((select count(*)::integer from private_exercises where id='00000000-0000-4000-8000-000000000175'),0,'invalid first scene leaves no draft');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000172',true);
select throws_ok($$select public.save_workshop_draft(current_setting('test.idempotent_scene')::jsonb,'Stolen UUID','00000000-0000-4000-8000-000000000173',true)$$,null,null,'other owner cannot reuse UUID with creation flag');
reset role;
select is((select name from exercise_content c join private_exercises p on p.content_id=c.id where p.id='00000000-0000-4000-8000-000000000173'),'Named again','owner content preserved after denied retry');
set local role anon;
select throws_ok($$select public.save_workshop_draft(current_setting('test.idempotent_scene')::jsonb,'Anonymous','00000000-0000-4000-8000-000000000174',true)$$,'42501',null,'anonymous cannot request creation');
reset role;
select * from finish();
rollback;
