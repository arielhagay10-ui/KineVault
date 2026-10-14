begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users(id,email,aud,role) values
  ('00000000-0000-4000-8000-000000000371','provenance-owner@example.test','authenticated','authenticated'),
  ('00000000-0000-4000-8000-000000000372','provenance-copier@example.test','authenticated','authenticated');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000371',true);
select set_config('test.provenance_target',public.publish_private_exercise(public.save_private_metadata('{"name":"Provenance target"}'))::text,true);
select set_config('test.provenance_other',public.publish_private_exercise(public.save_private_metadata('{"name":"Other provenance target"}'))::text,true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000372',true);
select set_config('test.provenance_draft',public.save_private_metadata('{"name":"Unrelated private draft"}')::text,true);
select throws_ok($$update public.private_exercises set copied_from_exercise_id = current_setting('test.provenance_target')::uuid
  where id = current_setting('test.provenance_draft')::uuid$$,'P0001','copy provenance is maintained internally','ordinary drafts cannot forge public copy provenance');
select throws_ok($$select public.record_exercise_engagement(current_setting('test.provenance_target')::uuid,'use')$$,
  'P0001','copy the exercise before recording use','failed provenance forgery cannot fabricate a use');
insert into public.exercise_content(id,kind,owner_id,name)
  values('00000000-0000-4000-8000-000000000373','private_draft',auth.uid(),'Direct private draft');
select throws_ok($$insert into public.private_exercises(owner_id,content_id,copied_from_exercise_id)
  values(auth.uid(),'00000000-0000-4000-8000-000000000373',current_setting('test.provenance_target')::uuid)$$,
  'P0001','copy provenance is maintained internally','direct inserts cannot invent copy provenance or trigger usage');
select is((select use_count from public.exercises where id = current_setting('test.provenance_target')::uuid),0,'forgery attempts do not increase use count');
select lives_ok($$insert into public.private_exercises(owner_id,content_id)
  values(auth.uid(),'00000000-0000-4000-8000-000000000373')$$,'ordinary private inserts remain allowed');
select set_config('test.provenance_copy',public.copy_public_exercise(current_setting('test.provenance_target')::uuid)::text,true);
select is((select copied_from_exercise_id from public.private_exercises where id = current_setting('test.provenance_copy')::uuid),current_setting('test.provenance_target')::uuid,'trusted copy RPC retains provenance');
select is((select use_count from public.exercises where id = current_setting('test.provenance_target')::uuid),1,'legitimate copy records one use');
select set_config('test.provenance_duplicate',public.duplicate_private_exercise(current_setting('test.provenance_copy')::uuid)::text,true);
select is((select copied_from_exercise_id from public.private_exercises where id = current_setting('test.provenance_duplicate')::uuid),current_setting('test.provenance_target')::uuid,'trusted duplicate preserves source attribution');
select is((select use_count from public.exercises where id = current_setting('test.provenance_target')::uuid),1,'duplicate remains one use per person');
select throws_ok($$update public.private_exercises set copied_from_exercise_id = current_setting('test.provenance_other')::uuid
  where id = current_setting('test.provenance_copy')::uuid$$,'P0001','copy provenance is maintained internally','clients cannot redirect legitimate copy attribution');
select throws_ok($$update public.private_exercises set copied_from_exercise_id = null
  where id = current_setting('test.provenance_copy')::uuid$$,'P0001','copy provenance is maintained internally','clients cannot erase legitimate copy attribution');
select lives_ok($$update public.private_exercises set copied_from_exercise_id = current_setting('test.provenance_target')::uuid
  where id = current_setting('test.provenance_copy')::uuid$$,'unchanged provenance updates remain harmless');
select lives_ok($$select public.save_private_metadata('{"name":"Edited copied draft"}',current_setting('test.provenance_copy')::uuid)$$,'copy metadata remains editable');
select lives_ok('set constraints all immediate','provenance protection preserves normal transaction commits');
select * from finish();
rollback;
