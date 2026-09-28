begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
select plan(13);
insert into auth.users(id,email,aud,role) values
  ('00000000-0000-4000-8000-000000000131','annotation-owner@example.test','authenticated','authenticated'),
  ('00000000-0000-4000-8000-000000000132','annotation-reviewer@example.test','authenticated','authenticated');
update public.roles set role = 'reviewer' where user_id = '00000000-0000-4000-8000-000000000132';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000131',true);
select set_config('test.private_id',public.save_private_exercise(p_name => 'Annotated Raise',p_family_slug => 'lateral-raise',
  p_primary_muscle_slugs => array['lateral-deltoid'],p_joint_action_slugs => array['shoulder-abduction'])::text,true);
select set_config('test.scene_id',public.save_private_scene(current_setting('test.private_id')::uuid,
  '{"durationMs":1000,"cameraAngle":"front","equipment":null,"keyframes":[{"timeMs":0,"poses":{"left-shoulder":{"z":0}}},{"timeMs":1000,"poses":{"left-shoulder":{"z":-70}}}],"annotations":[{"startMs":0,"endMs":500,"label":"Raise","jointAction":"shoulder-abduction","note":"Move the upper arm away from the torso."}]}'::jsonb)::text,true);
select is((select count(*)::integer from public.motion_phase_annotations where scene_id = current_setting('test.scene_id')::uuid),1,'notes persist in relational rows');
select is((select j.slug from public.motion_phase_annotations a join public.joint_actions j on j.id = a.joint_action_id where a.scene_id = current_setting('test.scene_id')::uuid),'shoulder-abduction','annotation links to normalized action');
select throws_ok($$select public.save_private_scene(current_setting('test.private_id')::uuid,
  '{"durationMs":1000,"cameraAngle":"front","equipment":null,"keyframes":[{"timeMs":0,"poses":{}},{"timeMs":1000,"poses":{}}],"annotations":[{"startMs":0,"endMs":1500,"label":"Outside bounds","jointAction":null,"note":null}]}')$$,
  'P0001','annotation outside scene bounds','notes cannot exceed the clip duration');
select throws_ok($$select public.save_private_scene(current_setting('test.private_id')::uuid,
  '{"durationMs":1000,"cameraAngle":"front","equipment":null,"keyframes":[{"timeMs":0,"poses":{}},{"timeMs":1000,"poses":{}}],"annotations":[{"startMs":0,"endMs":500,"label":"Wrong action","jointAction":"hip-extension","note":null}]}')$$,
  'P0001','annotation action must belong to the exercise','notes cannot introduce unclassified actions');
select is((select label from public.motion_phase_annotations where scene_id = current_setting('test.scene_id')::uuid),'Raise','failed saves retain original notes');
select throws_ok($$insert into public.motion_phase_annotations(scene_id,start_ms,end_ms,label)
  values(current_setting('test.scene_id')::uuid,0,2000,'Direct bad timing')$$,
  'P0001','annotation outside scene bounds','direct inserts obey clip bounds');
select throws_ok($$do $body$ begin
  update public.exercise_scenes set duration_ms=250 where id=current_setting('test.scene_id')::uuid;
  set constraints scene_annotation_integrity immediate;
end $body$;$$,'P0001','update movement notes before removing their action or shortening the scene','shorter scenes cannot leave notes outside bounds');
select throws_ok($$do $body$ begin
  delete from public.exercise_joint_actions where content_id=(select content_id from public.private_exercises where id=current_setting('test.private_id')::uuid);
  set constraints action_annotation_integrity immediate;
end $body$;$$,'P0001','update movement notes before removing their action or shortening the scene','action changes cannot leave misleading note links');
select public.replace_private_share(current_setting('test.private_id')::uuid,repeat('a',64));
set local role anon;
select is(jsonb_array_length(public.read_shared_private_scene(repeat('a',64))->'annotations'),1,'view-link visitors receive notes without broad scene access');
set local role authenticated;
select set_config('test.submission_id',public.submit_private_exercise(current_setting('test.private_id')::uuid,'new')::text,true);
select throws_ok($$select public.edit_submission_annotations(current_setting('test.submission_id')::uuid,'[]','Remove a movement cue.')$$,
  'P0001','reviewer role required','contributors cannot alter reviewed notes');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000132',true);
select public.begin_submission_review(current_setting('test.submission_id')::uuid);
select public.edit_submission_annotations(current_setting('test.submission_id')::uuid,
  '[{"startMs":0,"endMs":500,"label":"Concentric phase","jointAction":"shoulder-abduction","note":"Reviewed educational cue."}]','Clarify the movement phase.');
select is((select count(*)::integer from public.moderation_field_changes where field_name = 'motion_annotations'),1,'reviewed note corrections are audited');
select is((select a.label from public.motion_phase_annotations a join public.exercise_scenes s on s.id = a.scene_id
  join public.exercise_submissions sub on sub.original_content_id = s.content_id where sub.id = current_setting('test.submission_id')::uuid),'Raise','submitted notes remain immutable');
select is((select a.label from public.motion_phase_annotations a join public.exercise_scenes s on s.id = a.scene_id
  join public.exercise_submissions sub on sub.editorial_content_id = s.content_id where sub.id = current_setting('test.submission_id')::uuid),'Concentric phase','editorial notes change independently');
select * from finish();
rollback;
