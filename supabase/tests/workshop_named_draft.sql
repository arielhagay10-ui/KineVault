begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users(id,email,role,aud) values
 ('00000000-0000-4000-8000-000000000161','named-owner@example.test','authenticated','authenticated'),
 ('00000000-0000-4000-8000-000000000162','named-other@example.test','authenticated','authenticated');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000161',true);
select set_config('test.named_scene','{"durationMs":3200,"cameraAngle":"front","equipment":null,"keyframes":[{"timeMs":0,"poses":{}},{"timeMs":3200,"poses":{}}]}',true);
select set_config('test.named_id',public.save_workshop_draft(current_setting('test.named_scene')::jsonb,'My private row')::text,true);
select is((select name from exercise_content c join private_exercises p on p.content_id=c.id where p.id=current_setting('test.named_id')::uuid),'My private row','new name and scene saved together');
select is((select count(*)::integer from exercise_scenes s join private_exercises p on p.content_id=s.content_id where p.id=current_setting('test.named_id')::uuid),1,'new scene exists');
select lives_ok($$select public.save_workshop_draft(current_setting('test.named_scene')::jsonb,'Renamed row',current_setting('test.named_id')::uuid)$$,'existing owner can autosave');
select throws_ok($$select public.save_workshop_draft(current_setting('test.named_scene')::jsonb,'X',current_setting('test.named_id')::uuid)$$,'P0001',null,'invalid name rejected before writes');
select throws_ok($$select public.save_workshop_draft(jsonb_set(current_setting('test.named_scene')::jsonb,'{durationMs}','0'),'Broken scene',current_setting('test.named_id')::uuid)$$,null,null,'invalid scene rejected');
select is((select name from exercise_content c join private_exercises p on p.content_id=c.id where p.id=current_setting('test.named_id')::uuid),'Renamed row','failed scene leaves prior name intact');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000162',true);
select throws_ok($$select public.save_workshop_draft(current_setting('test.named_scene')::jsonb,'Stolen',current_setting('test.named_id')::uuid)$$,'P0001',null,'another account cannot save');
reset role;
select is((select name from exercise_content c join private_exercises p on p.content_id=c.id where p.id=current_setting('test.named_id')::uuid),'Renamed row','ownership denial preserves owner name');
set local role anon;
select throws_ok($$select public.save_workshop_draft(current_setting('test.named_scene')::jsonb,'Anonymous')$$,'42501',null,'anonymous cannot save');
reset role;
select * from finish();
rollback;
