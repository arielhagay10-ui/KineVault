begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users(id,email,aud,role) values ('00000000-0000-4000-8000-000000000071','row-height@example.test','authenticated','authenticated');
select set_config('test.row_transform','{"x":0,"y":0,"z":0,"rotationX":0,"rotationY":0,"rotationZ":0,"scale":1}',true);
select set_config('test.row_scene',jsonb_build_object(
  'durationMs',3200,'cameraAngle','side','equipment',null,
  'keyframes',jsonb_build_array(jsonb_build_object('timeMs',0,'poses','{}'::jsonb),jsonb_build_object('timeMs',3200,'poses','{}'::jsonb)),
  'studio',jsonb_build_object('body',current_setting('test.row_transform')::jsonb,'presentation',jsonb_build_object('highlight','group:abs','isolate',false,'view','side'),
    'objects',jsonb_build_array(current_setting('test.row_transform')::jsonb || jsonb_build_object(
      'id','00000000-0000-4000-8000-000000000072','name','Variable row height','slug','cable-row-machine','attachment','none','pulleyHeight',2.6,'machineUse',true,
      'machineHandleHeight',1.1,'frames',jsonb_build_array(
        current_setting('test.row_transform')::jsonb || jsonb_build_object('timeMs',0,'machinePosition',0.15,'machineHandleHeight',1.1),
        current_setting('test.row_transform')::jsonb || jsonb_build_object('timeMs',1600,'machinePosition',0.85,'machineHandleHeight',1.45),
        current_setting('test.row_transform')::jsonb || jsonb_build_object('timeMs',3200,'machinePosition',0.15,'machineHandleHeight',1.1))))))::text,true);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000071',true);
select set_config('test.row_id',public.create_workshop_exercise(current_setting('test.row_scene')::jsonb)::text,true);
select is((select studio_layout from public.exercise_scenes where content_id=(select content_id from public.private_exercises where id=current_setting('test.row_id')::uuid)),current_setting('test.row_scene')::jsonb->'studio','independent heights and chosen muscles save exactly');
select lives_ok($$select public.save_private_scene(current_setting('test.row_id')::uuid,current_setting('test.row_scene')::jsonb)$$,'owner can save heights again');
select throws_ok(format('select public.save_private_scene(%L::uuid,%L::jsonb)',current_setting('test.row_id'),jsonb_set(current_setting('test.row_scene')::jsonb,path,bad)::text),'23514',null,'reject invalid height at ' || array_to_string(path,'.') || ': ' || bad::text)
from (values (array['studio','objects','0','machineHandleHeight']), (array['studio','objects','0','frames','1','machineHandleHeight'])) paths(path)
cross join (values ('null'::jsonb),('0.69'::jsonb),('1.86'::jsonb),('"1.2"'::jsonb),('true'::jsonb)) values_to_reject(bad);
select throws_ok(format('select public.create_workshop_exercise(%L::jsonb)',jsonb_set(current_setting('test.row_scene')::jsonb,'{studio,objects,0,slug}',to_jsonb(slug))::text),'23514',null,'height rejected on ' || slug)
from unnest(array['pec-deck','smith-machine','lat-pulldown-machine']) slug;
select is((select studio_layout from public.exercise_scenes where content_id=(select content_id from public.private_exercises where id=current_setting('test.row_id')::uuid)),current_setting('test.row_scene')::jsonb->'studio','failed writes preserve original heights and highlight');
select * from finish();
rollback;
