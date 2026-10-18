begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id,email,aud,role) values
  ('00000000-0000-4000-8000-000000000111','shared-dumbbell-owner@example.test','authenticated','authenticated'),
  ('00000000-0000-4000-8000-000000000112','shared-dumbbell-other@example.test','authenticated','authenticated');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000111',true);
select set_config('test.shared_dumbbell_private',public.save_private_exercise(p_name=>'Shared dumbbell')::text,true);
select set_config('test.shared_dumbbell_payload','{"durationMs":3200,"cameraAngle":"front","equipment":null,"keyframes":[{"timeMs":0,"poses":{}},{"timeMs":3200,"poses":{}}],"studio":{"body":{"x":0,"y":0,"z":0,"rotationX":0,"rotationY":0,"rotationZ":0,"scale":1},"objects":[{"id":"00000000-0000-4000-8000-000000000113","name":"Shared dumbbell","slug":"dumbbell","x":0.2,"y":1.3,"z":0.4,"rotationX":15,"rotationY":20,"rotationZ":30,"scale":1,"attachment":"both","pulleyHeight":1.5,"gripOffsets":{"left":{"x":-0.1,"y":0.02,"z":0},"right":{"x":0.1,"y":-0.02,"z":0}},"frames":[{"timeMs":0,"x":0.2,"y":1.3,"z":0.4,"rotationX":15,"rotationY":20,"rotationZ":30,"scale":1},{"timeMs":1600,"x":0.3,"y":1.5,"z":0.2,"rotationX":25,"rotationY":35,"rotationZ":40,"scale":1}]}]}}',true);

select lives_ok($$select public.save_private_scene(current_setting('test.shared_dumbbell_private')::uuid,current_setting('test.shared_dumbbell_payload')::jsonb)$$,'both-hand dumbbell saves without a pose driver');
select is((select studio_layout from public.exercise_scenes where content_id=(select content_id from public.private_exercises where id=current_setting('test.shared_dumbbell_private')::uuid)),current_setting('test.shared_dumbbell_payload')::jsonb->'studio','both-hand dumbbell transform, grips and movement reload exactly');
select lives_ok(format('select public.save_private_scene(%L::uuid,%L::jsonb)',current_setting('test.shared_dumbbell_private'),jsonb_set(current_setting('test.shared_dumbbell_payload')::jsonb,'{studio,objects,0,poseDriver}',to_jsonb(driver))::text),'both-hand dumbbell saves ' || driver || ' driver')
from unnest(array['arm','weight','left-arm','right-arm']) driver;
select is((select studio_layout->'objects'->0->>'poseDriver' from public.exercise_scenes where content_id=(select content_id from public.private_exercises where id=current_setting('test.shared_dumbbell_private')::uuid)),'right-arm','explicit shared dumbbell driver reloads');

select throws_ok(format('select public.save_private_scene(%L::uuid,%L::jsonb)',current_setting('test.shared_dumbbell_private'),
  jsonb_set(current_setting('test.shared_dumbbell_payload')::jsonb,'{studio,objects}',
    (current_setting('test.shared_dumbbell_payload')::jsonb#>'{studio,objects}') || jsonb_build_array(
      (current_setting('test.shared_dumbbell_payload')::jsonb#>'{studio,objects,0}') || jsonb_build_object('id','00000000-0000-4000-8000-000000000114','attachment',hand)))::text),
  '23514',null,'shared dumbbell reserves the ' || hand || ' hand')
from unnest(array['left','right']) hand;

select throws_ok(format('select public.save_private_scene(%L::uuid,%L::jsonb)',current_setting('test.shared_dumbbell_private'),
  jsonb_set(current_setting('test.shared_dumbbell_payload')::jsonb,'{studio,objects,0}',
    (current_setting('test.shared_dumbbell_payload')::jsonb#>'{studio,objects,0}') || jsonb_build_object('slug',slug,'cableAttachment',attachment))::text),
  '23514',null,slug || ' ' || attachment || ' still rejects both-hand attachment')
from unnest(array['cable-machine','cable-row-machine']) slug cross join unnest(array['d-handle','cuff']) attachment;
select throws_ok($$select public.save_private_scene(current_setting('test.shared_dumbbell_private')::uuid,jsonb_set(current_setting('test.shared_dumbbell_payload')::jsonb,'{studio,objects,0,poseDriver}','"invalid"'))$$,'23514',null,'shared dumbbell still validates pose drivers');
select throws_ok($$select public.save_private_scene(current_setting('test.shared_dumbbell_private')::uuid,jsonb_set(current_setting('test.shared_dumbbell_payload')::jsonb,'{studio,objects,0,unknown}','true'))$$,'23514',null,'shared dumbbell still rejects unknown fields');
select is((select studio_layout->'objects'->0->>'poseDriver' from public.exercise_scenes where content_id=(select content_id from public.private_exercises where id=current_setting('test.shared_dumbbell_private')::uuid)),'right-arm','rejected edits preserve the saved shared dumbbell');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000112',true);
select throws_ok($$select public.save_private_scene(current_setting('test.shared_dumbbell_private')::uuid,current_setting('test.shared_dumbbell_payload')::jsonb)$$,'P0001','private exercise not found','another owner cannot edit the shared dumbbell');
select * from finish();
rollback;
