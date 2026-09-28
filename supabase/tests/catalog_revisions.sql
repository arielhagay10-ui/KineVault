begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
select plan(12);
insert into auth.users(id,email,aud,role) values
  ('00000000-0000-4000-8000-000000000121','revision-user@example.test','authenticated','authenticated'),
  ('00000000-0000-4000-8000-000000000122','revision-reviewer@example.test','authenticated','authenticated');
update public.roles set role = 'reviewer' where user_id = '00000000-0000-4000-8000-000000000122';
select set_config('test.exercise_id',(select id::text from public.exercises where slug = 'cable-lateral-raise'),true);
select set_config('test.old_content',(select current_content_id::text from public.exercises where id = current_setting('test.exercise_id')::uuid),true);
insert into public.exercise_media(content_id,asset_group_id,kind,storage_bucket,storage_path,license_name,camera_angle)
values
  (current_setting('test.old_content')::uuid,gen_random_uuid(),'webm','test-only','revision-front.webm','Original test media','front'),
  (current_setting('test.old_content')::uuid,gen_random_uuid(),'webm','test-only','revision-side.webm','Original test media','side');
update public.exercise_content set kind = 'published_version' where id = current_setting('test.old_content')::uuid;
insert into public.exercise_versions(exercise_id,version_number,content_id) values(current_setting('test.exercise_id')::uuid,1,current_setting('test.old_content')::uuid);
update public.exercises set status = 'published',published_at = now() where id = current_setting('test.exercise_id')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000121',true);
select throws_ok($$select public.revise_public_exercise(current_setting('test.exercise_id')::uuid,current_setting('test.old_content')::uuid,'{"name":"Revised Raise"}','Clarify the setup.')$$,
  'P0001','reviewer role required','ordinary users cannot edit published content');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000122',true);
select set_config('test.new_content',public.revise_public_exercise(current_setting('test.exercise_id')::uuid,current_setting('test.old_content')::uuid,
  '{"name":"Revised Cable Raise","resistance_profile":"unknown","reviewer_notes":"Setup geometry determines resistance."}','Clarify the name and uncertainty.')::text,true);
set constraints all immediate;
select is((select count(*)::integer from public.exercise_versions where exercise_id = current_setting('test.exercise_id')::uuid),2,'revision creates an immutable version');
select is((select name from public.exercise_content where id = current_setting('test.old_content')::uuid),'Cable Lateral Raise','earlier content stays unchanged');
select is((select current_content_id from public.exercises where id = current_setting('test.exercise_id')::uuid),current_setting('test.new_content')::uuid,'canonical identity points to new version');
select is((select count(distinct asset_group_id)::integer from public.exercise_media where content_id = current_setting('test.new_content')::uuid),2,'multiple camera groups remain distinct');
select throws_ok($$select public.revise_public_exercise(current_setting('test.exercise_id')::uuid,current_setting('test.old_content')::uuid,'{"name":"Stale revision"}','Explain another change.')$$,
  'P0001','exercise changed; reload before saving','stale forms cannot overwrite newer corrections');
select throws_ok($$select public.revise_public_exercise(current_setting('test.exercise_id')::uuid,current_setting('test.new_content')::uuid,'{"name":"Revised Cable Raise"}','No actual correction.')$$,
  'P0001','no classifications changed','no-op versions are rejected');
select throws_ok($$select public.revise_public_exercise(current_setting('test.exercise_id')::uuid,current_setting('test.new_content')::uuid,'{"muscles":[]}','Remove all classifications.')$$,
  'P0001','family, primary muscle, and primary joint action are required','required classifications cannot be removed');
select is((select count(*)::integer from public.exercise_versions where exercise_id = current_setting('test.exercise_id')::uuid),2,'failed edits do not leave versions');
select is((select count(*)::integer from public.explore_exercises(search_text => 'Revised Cable Raise')),1,'search refreshes to revised classifications');
set local role postgres;
select is((select count(*)::integer from public.admin_events where object_type = 'exercises' and object_id = current_setting('test.exercise_id')::uuid),1,'canonical correction is audited');
select ok(not has_function_privilege('authenticated','private.apply_content_patch(uuid,jsonb)','EXECUTE'),'normalized patch helper is not directly callable');
select * from finish();
rollback;
