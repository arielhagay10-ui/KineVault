begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users(id,email,aud,role) values
  ('00000000-0000-4000-8000-000000000091','palm-owner@example.test','authenticated','authenticated'),
  ('00000000-0000-4000-8000-000000000092','palm-other@example.test','authenticated','authenticated');
select set_config('test.palm_transform','{"x":0,"y":0,"z":0,"rotationX":0,"rotationY":0,"rotationZ":0,"scale":1}',true);
select set_config('test.palm_scene', jsonb_build_object(
  'durationMs',3200,'cameraAngle','front','equipment',null,
  'keyframes',jsonb_build_array(jsonb_build_object('timeMs',0,'poses','{}'::jsonb),jsonb_build_object('timeMs',3200,'poses','{}'::jsonb)),
  'studio',jsonb_build_object('body',current_setting('test.palm_transform')::jsonb,
    'presentation',jsonb_build_object('highlight','mesh:Deliberate_chosen_l','isolate',false,'view','three_quarter'),
    'objects',jsonb_build_array(current_setting('test.palm_transform')::jsonb || jsonb_build_object(
      'id','00000000-0000-4000-8000-000000000093','name','Palm fixture','slug','cable-row-machine','attachment','none','pulleyHeight',2.6,
      'machineUse',true,'machinePosition',0.5,'machinePalm','inward','machineElbowPath','beside-body',
      'frames',jsonb_build_array(current_setting('test.palm_transform')::jsonb || jsonb_build_object('timeMs',0,'machinePosition',0),
        current_setting('test.palm_transform')::jsonb || jsonb_build_object('timeMs',3200,'machinePosition',1))))))::text,true);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);
select lives_ok(format('select public.create_workshop_exercise(%L::jsonb)',
  jsonb_set(jsonb_set(jsonb_set(current_setting('test.palm_scene')::jsonb,'{studio,objects,0,slug}',to_jsonb(slug)),
    '{studio,objects,0,machinePalm}',to_jsonb(palm)),'{studio,objects,0,machineElbowPath}',to_jsonb(elbow))::text),
  slug || ' saves ' || palm || ' independently from ' || elbow)
from unnest(array['cable-row-machine','pec-deck']) slug
cross join unnest(array['inward','outward']) palm cross join unnest(array['beside-body','shoulder-height']) elbow;
select lives_ok($$select public.create_workshop_exercise(current_setting('test.palm_scene')::jsonb #- '{studio,objects,0,machinePalm}' #- '{studio,objects,0,machineElbowPath}')$$,'legacy omitted choices still save');
select lives_ok($$select public.create_workshop_exercise(current_setting('test.palm_scene')::jsonb #- '{studio,objects,0,machineElbowPath}')$$,'palm alone saves');
select lives_ok($$select public.create_workshop_exercise(current_setting('test.palm_scene')::jsonb #- '{studio,objects,0,machinePalm}')$$,'elbow path alone saves');
select set_config('test.palm_private',public.create_workshop_exercise(current_setting('test.palm_scene')::jsonb)::text,true);
select is((select studio_layout from public.exercise_scenes where content_id=(select content_id from public.private_exercises where id=current_setting('test.palm_private')::uuid)),
  current_setting('test.palm_scene')::jsonb->'studio','saved choices, frames and deliberate highlight round trip exactly');
select throws_ok(format('select public.save_private_scene(%L::uuid,%L::jsonb)',current_setting('test.palm_private'),
  jsonb_set(current_setting('test.palm_scene')::jsonb,array['studio','objects','0',field],bad)::text),'23514',null,field || ' rejects ' || bad::text)
from (values ('machinePalm','null'::jsonb),('machinePalm','"neutral"'::jsonb),('machinePalm','true'::jsonb),
  ('machineElbowPath','null'::jsonb),('machineElbowPath','"wide"'::jsonb),('machineElbowPath','2'::jsonb)) choices(field,bad);
select throws_ok(format('select public.create_workshop_exercise(%L::jsonb)',
  jsonb_set(current_setting('test.palm_scene')::jsonb,'{studio,objects,0,slug}',to_jsonb(slug))::text),'23514',null,'choices rejected on ' || slug)
from unnest(array['smith-machine','lat-pulldown-machine','leg-press','bench']) slug;
select set_config('test.palm_scene',jsonb_set(jsonb_set(current_setting('test.palm_scene')::jsonb,'{studio,objects,0,machinePalm}','"outward"'),
  '{studio,objects,0,machineElbowPath}','"shoulder-height"')::text,true);
select lives_ok($$select public.save_private_scene(current_setting('test.palm_private')::uuid,current_setting('test.palm_scene')::jsonb)$$,'owner changes independent choices');
select public.replace_private_share(current_setting('test.palm_private')::uuid,repeat('b',64));
reset role;
select set_config('test.palm_clone',private.clone_exercise_content((select content_id from public.private_exercises where id=current_setting('test.palm_private')::uuid),'submission_editorial',null)::text,true);
select is((select studio_layout from public.exercise_scenes where content_id=current_setting('test.palm_clone')::uuid),current_setting('test.palm_scene')::jsonb->'studio','editorial clone retains choices and creator highlight');
set local role anon;
select is(public.read_shared_private_scene(repeat('b',64))->'studio',current_setting('test.palm_scene')::jsonb->'studio','shared reader retains choices and creator highlight');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000092',true);
select throws_ok($$select public.save_private_scene(current_setting('test.palm_private')::uuid,current_setting('test.palm_scene')::jsonb)$$,'P0001','private exercise not found','another owner cannot change choices');
select is((select count(*)::integer from public.private_exercises where id=current_setting('test.palm_private')::uuid),0,'another owner cannot read choices');
reset role;
select * from finish();
rollback;
