begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
select plan(11);
insert into auth.users(id,email,aud,role) values
  ('00000000-0000-4000-8000-000000000141','metadata-owner@example.test','authenticated','authenticated'),
  ('00000000-0000-4000-8000-000000000142','metadata-other@example.test','authenticated','authenticated');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000141',true);
select set_config('test.private_id',public.save_private_metadata('{"name":"Detailed private raise","family":"lateral-raise",
  "muscles":[{"slug":"lateral-deltoid","role":"primary"}],"joint_actions":[{"slug":"shoulder-abduction","role":"primary"},{"slug":"scapular-upward-rotation","role":"secondary"}],
  "equipment":[{"slug":"cable","role":"required"}],"attachments":["d-handle"],"movement_patterns":["isolation"],
  "setup_instructions":"Stand beside the cable.","execution_instructions":"Raise the upper arm.","laterality":"unilateral","resistance_profile":"unknown"}')::text,true);
select is((select c.setup_instructions from public.exercise_content c join public.private_exercises p on p.content_id=c.id where p.id=current_setting('test.private_id')::uuid),
  'Stand beside the cable.','owner instructions persist');
select is((select count(*)::integer from public.exercise_attachments a join public.private_exercises p on p.content_id=a.content_id where p.id=current_setting('test.private_id')::uuid),1,'attachment is normalized');
select is((select ea.role::text from public.exercise_joint_actions ea join public.private_exercises p on p.content_id=ea.content_id
  join public.joint_actions ja on ja.id=ea.joint_action_id where p.id=current_setting('test.private_id')::uuid and ja.slug='scapular-upward-rotation'),'secondary','supporting action role persists');
select lives_ok($$select public.save_private_metadata('{"name":"Detailed private raise"}',current_setting('test.private_id')::uuid)$$,'unchanged private save is valid');
select throws_ok($$select public.save_private_metadata('{"name":"Changed","attachments":["unknown-handle"]}',current_setting('test.private_id')::uuid)$$,
  'P0001','unknown taxonomy value','unknown taxonomy rolls back complete save');
select is((select c.name from public.exercise_content c join public.private_exercises p on p.content_id=c.id where p.id=current_setting('test.private_id')::uuid),'Detailed private raise','failed save preserves draft');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000142',true);
select throws_ok($$select public.save_private_metadata('{"name":"Taken"}',current_setting('test.private_id')::uuid)$$,'P0001','private exercise not found','another owner cannot save metadata');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000141',true);
select public.save_private_metadata('{"aliases":["Alternate raise"]}',current_setting('test.private_id')::uuid);
select throws_ok($$select public.save_private_metadata('{"aliases":["Same alias","SAME ALIAS"]}',current_setting('test.private_id')::uuid)$$,
 '23505',null,'duplicate normalized aliases roll back');
select is((select alias from public.exercise_aliases a join public.private_exercises p on p.content_id=a.content_id where p.id=current_setting('test.private_id')::uuid),
 'Alternate raise','failed alias save retains prior aliases');
select public.replace_private_share(current_setting('test.private_id')::uuid,repeat('c',64));
set local role anon;
select is(public.read_shared_private_metadata(repeat('c',64))->>'execution_instructions','Raise the upper arm.','active link includes instructions');
select is(public.read_shared_private_metadata(repeat('d',64)),null::jsonb,'unknown link exposes no metadata');
select * from finish();
rollback;
