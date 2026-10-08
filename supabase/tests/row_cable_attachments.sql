begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(19);
insert into auth.users(id,email,aud,role) values
  ('00000000-0000-4000-8000-000000000091','row-cable-owner@example.test','authenticated','authenticated'),
  ('00000000-0000-4000-8000-000000000092','row-cable-other@example.test','authenticated','authenticated');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);
select set_config('test.row_cable','{"durationMs":3200,"cameraAngle":"side","equipment":null,"motionStyle":"free","keyframes":[{"timeMs":0,"poses":{}},{"timeMs":3200,"poses":{}}],"studio":{"body":{"x":0,"y":0,"z":0,"rotationX":0,"rotationY":0,"rotationZ":0,"scale":1},"objects":[{"id":"00000000-0000-4000-8000-000000000093","name":"Cable row","slug":"cable-row-machine","x":0,"y":0,"z":0,"rotationX":0,"rotationY":0,"rotationZ":0,"scale":1,"attachment":"left","pulleyHeight":1.5,"cableAttachment":"d-handle","machineUse":true}]}}',true);
select set_config('test.row_private',public.create_workshop_exercise(current_setting('test.row_cable')::jsonb)::text,true);
select is((select studio_layout from public.exercise_scenes where content_id=(select content_id from public.private_exercises where id=current_setting('test.row_private')::uuid)),current_setting('test.row_cable')::jsonb->'studio','seated row attachment saves exactly');
select lives_ok(format('select public.save_private_scene(%L::uuid,%L::jsonb)',current_setting('test.row_private'),jsonb_set(current_setting('test.row_cable')::jsonb,'{studio,objects,0,cableAttachment}',to_jsonb(kind))::text),'seated row ' || kind) from unnest(array['d-handle','rope','straight-bar','angled-bar','lat-bar','v-bar','cuff']) kind;
select lives_ok(format('select public.save_private_scene(%L::uuid,%L::jsonb)',current_setting('test.row_private'),jsonb_set(jsonb_set(current_setting('test.row_cable')::jsonb,'{studio,objects,0,machineUse}','false'),'{studio,objects,0,cableAttachment}',to_jsonb(kind))::text),'free row ' || kind) from unnest(array['d-handle','rope','straight-bar','angled-bar','lat-bar','v-bar','cuff']) kind;
select throws_ok($$select public.save_private_scene(current_setting('test.row_private')::uuid,jsonb_set(jsonb_set(current_setting('test.row_cable')::jsonb,'{studio,objects,0,cableAttachment}','"cuff"'),'{studio,objects,0,attachment}','"both"'))$$,'23514',null,'single cuff cannot hold both arms');
select throws_ok($$select public.save_private_scene(current_setting('test.row_private')::uuid,jsonb_set(current_setting('test.row_cable')::jsonb,'{studio,objects,0,cableAttachment}','"unknown"'))$$,'23514',null,'unknown row attachment rejected');
select throws_ok($$select public.save_private_scene(current_setting('test.row_private')::uuid,jsonb_set(current_setting('test.row_cable')::jsonb,'{studio,objects}',(current_setting('test.row_cable')::jsonb#>'{studio,objects}') || '[{"id":"00000000-0000-4000-8000-000000000094","name":"Dumbbell","slug":"dumbbell","x":0,"y":0,"z":0,"rotationX":0,"rotationY":0,"rotationZ":0,"scale":1,"attachment":"right","pulleyHeight":1.5}]'::jsonb))$$,'23514',null,'seated support rejects other held equipment');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000092',true);
select throws_ok($$select public.save_private_scene(current_setting('test.row_private')::uuid,current_setting('test.row_cable')::jsonb)$$,'P0001','private exercise not found','another owner cannot alter row attachments');
reset role;
select * from finish();
rollback;
