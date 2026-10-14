begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(24);
insert into auth.users(id,email,aud,role) values
  ('00000000-0000-4000-8000-000000000091','grip-owner@example.test','authenticated','authenticated'),
  ('00000000-0000-4000-8000-000000000092','grip-other@example.test','authenticated','authenticated');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);
select set_config('test.grip_payload','{"durationMs":3200,"cameraAngle":"front","equipment":null,"keyframes":[{"timeMs":0,"poses":{}},{"timeMs":3200,"poses":{}}],"studio":{"body":{"x":0,"y":0,"z":0,"rotationX":0,"rotationY":0,"rotationZ":0,"scale":1},"objects":[{"id":"00000000-0000-4000-8000-000000000093","name":"Grip test","slug":"barbell","x":0,"y":1.3,"z":0.4,"rotationX":0,"rotationY":0,"rotationZ":0,"scale":1,"attachment":"none","pulleyHeight":1.5,"gripOffsets":{"left":{"x":-0.08,"y":0,"z":0},"right":{"x":0.08,"y":0.01,"z":0}}}]}}',true);
select set_config('test.grip_private',public.create_workshop_exercise(current_setting('test.grip_payload')::jsonb)::text,true);
select is((select studio_layout from public.exercise_scenes where content_id=(select content_id from public.private_exercises where id=current_setting('test.grip_private')::uuid)),current_setting('test.grip_payload')::jsonb->'studio','independent grip edits save exactly');
select lives_ok(format('select public.save_private_scene(%L::uuid,%L::jsonb)',current_setting('test.grip_private'),jsonb_set(current_setting('test.grip_payload')::jsonb,'{studio,objects,0,slug}',to_jsonb(slug))::text),slug || ' accepts edited grip positions')
from unnest(array['cable-machine','bench','squat-rack','barbell','dumbbell','kettlebell','lat-pulldown-machine','smith-machine','leg-press','cable-row-machine','pec-deck']) slug;
select throws_ok(format('select public.save_private_scene(%L::uuid,%L::jsonb)',current_setting('test.grip_private'),jsonb_set(current_setting('test.grip_payload')::jsonb,'{studio,objects,0,gripOffsets}',bad)::text),'23514',null,'malformed grip rejected')
from unnest(array['null','[]','{"middle":{"x":0,"y":0,"z":0}}','{"left":{"x":2.01,"y":0,"z":0}}','{"left":{"x":0,"y":"0","z":0}}','{"left":{"x":0,"y":0}}','{"left":{"x":0,"y":0,"z":0,"extra":1}}']::jsonb[]) bad;
select lives_ok(format('select public.save_private_scene(%L::uuid,%L::jsonb)',current_setting('test.grip_private'),jsonb_set(jsonb_set(current_setting('test.grip_payload')::jsonb,'{studio,objects,0,slug}',to_jsonb(slug)),'{studio,objects,0,attachment}','"both"')::text),slug || ' supports hand contacts') from unnest(array['bench','squat-rack']) slug;
select lives_ok(format('select public.save_private_scene(%L::uuid,%L::jsonb)',current_setting('test.grip_private'),(current_setting('test.grip_payload')::jsonb #- '{studio,objects,0,gripOffsets}')::text),'resetting automatic grips saves');
select public.save_private_scene(current_setting('test.grip_private')::uuid,current_setting('test.grip_payload')::jsonb);
reset role;
select set_config('test.grip_clone',private.clone_exercise_content((select content_id from public.private_exercises where id=current_setting('test.grip_private')::uuid),'submission_editorial',null)::text,true);
select is((select studio_layout from public.exercise_scenes where content_id=current_setting('test.grip_clone')::uuid),current_setting('test.grip_payload')::jsonb->'studio','review snapshots retain custom grip locations');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000092',true);
select throws_ok($$select public.save_private_scene(current_setting('test.grip_private')::uuid,current_setting('test.grip_payload')::jsonb)$$,'P0001','private exercise not found','other owners cannot edit grips');
select * from finish();
rollback;
