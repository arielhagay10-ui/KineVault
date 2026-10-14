begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id,email,aud,role) values
  ('00000000-0000-4000-8000-000000000101','driver-owner@example.test','authenticated','authenticated'),
  ('00000000-0000-4000-8000-000000000102','driver-other@example.test','authenticated','authenticated');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select set_config('test.driver_payload','{"durationMs":3200,"cameraAngle":"front","equipment":null,"keyframes":[{"timeMs":0,"poses":{}},{"timeMs":3200,"poses":{}}],"studio":{"body":{"x":0,"y":0,"z":0,"rotationX":0,"rotationY":0,"rotationZ":0,"scale":1},"objects":[{"id":"00000000-0000-4000-8000-000000000103","name":"Driver test","slug":"dumbbell","x":0,"y":1.3,"z":0.4,"rotationX":0,"rotationY":0,"rotationZ":0,"scale":1,"attachment":"left","pulleyHeight":1.5,"poseDriver":"arm","gripOffsets":{"left":{"x":0.1,"y":0,"z":0}}}]}}',true);
select set_config('test.driver_private',public.create_workshop_exercise(current_setting('test.driver_payload')::jsonb)::text,true);

select is((select studio_layout from public.exercise_scenes where content_id=(select content_id from public.private_exercises where id=current_setting('test.driver_private')::uuid)),current_setting('test.driver_payload')::jsonb->'studio','arm driver and edited grip save exactly');
select lives_ok(format('select public.save_private_scene(%L::uuid,%L::jsonb)',current_setting('test.driver_private'),jsonb_set(current_setting('test.driver_payload')::jsonb,'{studio,objects,0,poseDriver}','"weight"')::text),'weight driver saves');
select lives_ok(format('select public.save_private_scene(%L::uuid,%L::jsonb)',current_setting('test.driver_private'),(current_setting('test.driver_payload')::jsonb #- '{studio,objects,0,poseDriver}')::text),'legacy omitted driver saves');
select lives_ok(format('select public.save_private_scene(%L::uuid,%L::jsonb)',current_setting('test.driver_private'),jsonb_set(current_setting('test.driver_payload')::jsonb,'{studio,objects,0,attachment}','"none"')::text),'released dumbbell retains driver preference');
select throws_ok(format('select public.save_private_scene(%L::uuid,%L::jsonb)',current_setting('test.driver_private'),jsonb_set(current_setting('test.driver_payload')::jsonb,'{studio,objects,0,poseDriver}',bad)::text),'23514',null,'invalid driver rejected')
from unnest(array['null','"body"','1','{}','true']::jsonb[]) bad;
select throws_ok(format('select public.save_private_scene(%L::uuid,%L::jsonb)',current_setting('test.driver_private'),jsonb_set(current_setting('test.driver_payload')::jsonb,'{studio,objects,0,slug}',to_jsonb(slug))::text),'23514',null,slug || ' cannot drive a pose')
from unnest(array['bench','cable-machine']) slug;
select lives_ok(format('select public.save_private_scene(%L::uuid,%L::jsonb)',current_setting('test.driver_private'),
  jsonb_set(jsonb_set(current_setting('test.driver_payload')::jsonb,'{studio,objects,0,slug}',to_jsonb(slug)),
    '{studio,objects,0,poseDriver}',to_jsonb(driver))::text),slug || ' saves ' || driver || ' driver')
from unnest(array['dumbbell','barbell','kettlebell']) slug cross join unnest(array['arm','weight','left-arm','right-arm']) driver;
select throws_ok(format('select public.save_private_scene(%L::uuid,%L::jsonb)',current_setting('test.driver_private'),jsonb_set(current_setting('test.driver_payload')::jsonb,'{studio,objects,0,unrecognized}','true')::text),'23514',null,'driver wrapper retains strict unknown-key validation');

select public.save_private_scene(current_setting('test.driver_private')::uuid,current_setting('test.driver_payload')::jsonb);
reset role;
select set_config('test.driver_clone',private.clone_exercise_content((select content_id from public.private_exercises where id=current_setting('test.driver_private')::uuid),'submission_editorial',null)::text,true);
select is((select studio_layout from public.exercise_scenes where content_id=current_setting('test.driver_clone')::uuid),current_setting('test.driver_payload')::jsonb->'studio','review snapshots retain pose driver');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
select throws_ok($$select public.save_private_scene(current_setting('test.driver_private')::uuid,current_setting('test.driver_payload')::jsonb)$$,'P0001','private exercise not found','other owners cannot change pose driver');
select * from finish();
rollback;
