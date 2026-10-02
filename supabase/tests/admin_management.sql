begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
select plan(13);
insert into auth.users(id,email,aud,role) values
  ('00000000-0000-4000-8000-000000000101','admin-owner@example.test','authenticated','authenticated'),
  ('00000000-0000-4000-8000-000000000102','admin-account@example.test','authenticated','authenticated'),
  ('00000000-0000-4000-8000-000000000103','admin-reviewer@example.test','authenticated','authenticated');
update public.roles set role = 'admin' where user_id = '00000000-0000-4000-8000-000000000102';
update public.roles set role = 'reviewer' where user_id = '00000000-0000-4000-8000-000000000103';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select throws_ok($$select public.assign_application_role('00000000-0000-4000-8000-000000000101','admin','Self promotion attempt.')$$,
  'P0001','admin role required','users cannot promote themselves');
select set_config('test.private_id',public.save_private_exercise(p_name => 'Retired Asset Draft')::text,true);
select set_config('test.scene','{"durationMs":1000,"cameraAngle":"front","equipment":{"slug":"dumbbell-pair","x":0,"y":0,"z":0,"scale":1},"keyframes":[{"timeMs":0,"poses":{"left-shoulder":{"z":0}}},{"timeMs":1000,"poses":{"left-shoulder":{"z":-50}}}]}',true);
select public.save_private_scene(current_setting('test.private_id')::uuid,current_setting('test.scene')::jsonb);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true);
with changed as (update public.equipment_assets set active = false where slug = 'dumbbell-pair' returning id)
select is((select count(*)::integer from changed),0,'reviewers cannot retire library assets');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
select throws_ok($$select public.assign_application_role('00000000-0000-4000-8000-000000000102','user','Demote the last admin.')$$,
  'P0001','the final admin cannot be demoted','the final admin is protected');
select public.assign_application_role('00000000-0000-4000-8000-000000000101','reviewer','Approved as a qualified reviewer.');
select is((select role::text from public.roles where user_id = '00000000-0000-4000-8000-000000000101'),'reviewer','admin can assign a reviewer role');
select is((select count(*)::integer from public.admin_events where object_type = 'roles'
  and object_id = '00000000-0000-4000-8000-000000000101' and comment = 'Approved as a qualified reviewer.'),1,'role changes record actor and reason');
insert into public.muscles(id,slug,name) values('10000000-0000-4000-8000-000000000101','cycle-parent','Cycle parent');
insert into public.muscles(id,slug,name,parent_id) values('10000000-0000-4000-8000-000000000102','cycle-child','Cycle child','10000000-0000-4000-8000-000000000101');
select throws_ok($$update public.muscles set parent_id = '10000000-0000-4000-8000-000000000102' where slug = 'cycle-parent'$$,
  'P0001','taxonomy hierarchy cannot contain a cycle','taxonomy parent links cannot form cycles');
set local role postgres;
select throws_ok($$update public.admin_events set comment = 'Changed'$$,'P0001','admin_events is append-only','admin history is immutable');
set local role authenticated;
select public.assign_application_role('00000000-0000-4000-8000-000000000101','user','Restore ordinary owner for access tests.');
update public.equipment_assets set active = false where slug = 'dumbbell-pair';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select is((select count(*)::integer from public.equipment_assets where slug = 'dumbbell-pair'),1,'saved scene owners can read retired equipment versions');
select lives_ok($$select public.save_private_scene(current_setting('test.private_id')::uuid,current_setting('test.scene')::jsonb)$$,'an existing scene can retain its retired asset');
select set_config('test.new_private_id',public.save_private_exercise(p_name => 'New Scene Draft')::text,true);
select throws_ok($$select public.save_private_scene(current_setting('test.new_private_id')::uuid,current_setting('test.scene')::jsonb)$$,
  'P0001','unknown workshop equipment','retired equipment is unavailable for new scene selection');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
update public.rigs set active = false;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select is((select count(*)::integer from public.rig_joints),13,'saved scenes retain retired rig joint definitions including wrists and ankles');
select lives_ok($$select public.save_private_scene(current_setting('test.private_id')::uuid,current_setting('test.scene')::jsonb)$$,'an existing scene can retain its retired rig');
select throws_ok($$select public.save_private_scene(current_setting('test.new_private_id')::uuid,jsonb_set(current_setting('test.scene')::jsonb,'{equipment}','null'::jsonb))$$,
  'P0001','workshop rig unavailable','retired rigs are unavailable for new scenes');
select * from finish();
rollback;
