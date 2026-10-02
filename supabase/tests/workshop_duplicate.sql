begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
select plan(12);
insert into auth.users(id,email,aud,role) values
  ('00000000-0000-4000-8000-000000000291','template-owner@example.test','authenticated','authenticated'),
  ('00000000-0000-4000-8000-000000000292','template-other@example.test','authenticated','authenticated');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000291',true);
select set_config('test.template_source',public.save_private_metadata('{"name":"My row","muscles":[{"slug":"lateral-deltoid","role":"primary"}],"resistance_profile":"unknown","aliases":["My original row"],"setup_instructions":"My setup."}')::text,true);
select public.save_private_scene(current_setting('test.template_source')::uuid,'{"durationMs":1000,"cameraAngle":"front","equipment":null,"keyframes":[{"timeMs":0,"poses":{}},{"timeMs":1000,"poses":{}}],"studio":{"body":{"x":0,"y":0,"z":0,"rotationX":0,"rotationY":0,"rotationZ":0,"scale":1},"objects":[],"presentation":{"highlight":"group:abs","isolate":false,"view":"front"}}}');
select public.replace_private_share(current_setting('test.template_source')::uuid,repeat('a',64));
select set_config('test.template_copy',public.duplicate_private_exercise(current_setting('test.template_source')::uuid)::text,true);
select isnt(current_setting('test.template_copy'),current_setting('test.template_source'),'duplicate has an independent private ID');
select is((select owner_id from public.private_exercises where id=current_setting('test.template_copy')::uuid),'00000000-0000-4000-8000-000000000291'::uuid,'duplicate belongs to the authenticated owner');
select is((select c.name from public.exercise_content c join public.private_exercises p on p.content_id=c.id where p.id=current_setting('test.template_copy')::uuid),'My row (copy)','copy has a distinguishable name');
select is((select c.kind::text from public.exercise_content c join public.private_exercises p on p.content_id=c.id where p.id=current_setting('test.template_copy')::uuid),'private_draft','copy stays private');
select is((select m.role::text from public.exercise_muscles m join public.private_exercises p on p.content_id=m.content_id where p.id=current_setting('test.template_copy')::uuid),'primary','deliberate muscle role survives');
select is((select s.studio_layout->'presentation'->>'highlight' from public.exercise_scenes s join public.private_exercises p on p.content_id=s.content_id where p.id=current_setting('test.template_copy')::uuid),'group:abs','deliberate scene highlight survives');
select is((select count(*)::integer from public.motion_keyframes f join public.exercise_scenes s on s.id=f.scene_id join public.private_exercises p on p.content_id=s.content_id where p.id=current_setting('test.template_copy')::uuid),2,'copy contains playable keyframes');
select is((select count(*)::integer from public.private_exercise_shares where private_exercise_id=current_setting('test.template_copy')::uuid),0,'share capabilities are not copied');
select public.save_private_metadata('{"name":"Edited copy"}',current_setting('test.template_copy')::uuid);
select is((select c.name from public.exercise_content c join public.private_exercises p on p.content_id=c.id where p.id=current_setting('test.template_source')::uuid),'My row','editing duplicate leaves source intact');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000292',true);
select throws_ok($$select public.duplicate_private_exercise(current_setting('test.template_source')::uuid)$$,'P0001','private exercise not found','another owner cannot copy the source');
select is((select count(*)::integer from public.private_exercises),0,'failed foreign copy creates no draft');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.duplicate_private_exercise(current_setting('test.template_source')::uuid)$$,'P0001','authentication required','empty identity cannot copy a draft');
select * from finish();
rollback;

