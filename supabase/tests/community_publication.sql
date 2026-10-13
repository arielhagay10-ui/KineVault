begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id,email,aud,role) values
  ('00000000-0000-4000-8000-000000000351','community-owner@example.test','authenticated','authenticated'),
  ('00000000-0000-4000-8000-000000000352','community-other@example.test','authenticated','authenticated'),
  ('00000000-0000-4000-8000-000000000353','community-reviewer@example.test','authenticated','authenticated');
update public.roles set role = 'reviewer' where user_id = '00000000-0000-4000-8000-000000000353';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000351',true);
select set_config('test.community_private',public.save_private_metadata('{"name":"Community motion","setup_instructions":"Original setup"}')::text,true);
select set_config('test.community_source',(select content_id::text from public.private_exercises where id = current_setting('test.community_private')::uuid),true);
select public.save_private_scene(current_setting('test.community_private')::uuid,
  '{"durationMs":1000,"cameraAngle":"front","equipment":null,"keyframes":[{"timeMs":0,"poses":{}},{"timeMs":1000,"poses":{}}],"studio":{"body":{"x":0,"y":0,"z":0,"rotationX":0,"rotationY":0,"rotationZ":0,"scale":1},"objects":[],"presentation":{"highlight":"group:abs","isolate":false,"view":"front"}}}');
set local role postgres;
insert into public.exercise_media(content_id,scene_id,asset_group_id,kind,storage_bucket,storage_path,license_name)
  select c.id,s.id,gen_random_uuid(),'webm','exercise-private','community-test/private.webm','Original'
  from public.exercise_content c join public.exercise_scenes s on s.content_id = c.id
  where c.id = current_setting('test.community_source')::uuid;
insert into storage.objects(bucket_id,name) values ('exercise-private','community-test/private.webm');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000352',true);
select throws_ok($$select public.publish_private_exercise(current_setting('test.community_private')::uuid)$$,
  'P0001','private exercise not found','foreign owners cannot publish a draft');
select is((select count(*)::integer from public.exercise_publications),0,'foreign attempt creates no mapping');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.publish_private_exercise(current_setting('test.community_private')::uuid)$$,
  'P0001','authentication required','missing identity cannot publish');
set local role anon;
select throws_ok($$select public.publish_private_exercise(current_setting('test.community_private')::uuid)$$,
  '42501',null,'anonymous callers cannot publish');
select throws_ok($$select public.report_public_exercise(gen_random_uuid(),'Concern')$$,
  '42501',null,'anonymous callers cannot report');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000351',true);
select set_config('test.community_exercise',public.publish_private_exercise(current_setting('test.community_private')::uuid)::text,true);
select lives_ok('set constraints all immediate','contributor commits publication without reviewer version access');
select set_config('test.community_snapshot',(select current_content_id::text from public.exercises where id = current_setting('test.community_exercise')::uuid),true);
select is(public.publish_private_exercise(current_setting('test.community_private')::uuid),current_setting('test.community_exercise')::uuid,'repeated publication returns the same exercise');
select is((select count(*)::integer from public.exercise_publications where source_private_exercise_id = current_setting('test.community_private')::uuid),1,'one source has one publication');
select is((select verified_at from public.exercises where id = current_setting('test.community_exercise')::uuid),null::timestamptz,'community publication begins unverified');
select is((select reviewed_by from public.exercises where id = current_setting('test.community_exercise')::uuid),null::uuid,'community publication does not impersonate a reviewer');
select isnt(current_setting('test.community_snapshot'),current_setting('test.community_source'),'publication creates a separate snapshot');
select is((select kind::text from public.exercise_content where id = current_setting('test.community_source')::uuid),'private_draft','original remains private');
select is((select count(*)::integer from public.exercise_media where content_id = current_setting('test.community_snapshot')::uuid),0,'private media references are not copied');
select is((select count(*)::integer from public.exercise_muscles where content_id = current_setting('test.community_snapshot')::uuid),0,'anatomy classifications are optional');
select is((select count(*)::integer from public.exercise_submissions where source_private_exercise_id = current_setting('test.community_private')::uuid),0,'immediate publication requires no submission');
select is((select studio_layout->'presentation'->>'highlight' from public.exercise_scenes where content_id = current_setting('test.community_snapshot')::uuid),'group:abs','scene presentation survives snapshot');
select is((select count(*)::integer from public.motion_keyframes f join public.exercise_scenes s on s.id = f.scene_id where s.content_id = current_setting('test.community_snapshot')::uuid),2,'snapshot includes playable motion');
select public.save_private_metadata('{"name":"Edited privately","setup_instructions":"Later setup"}',current_setting('test.community_private')::uuid);
select is((select name from public.exercise_content where id = current_setting('test.community_snapshot')::uuid),'Community motion','later private edits cannot change the snapshot');
select is((select setup_instructions from public.exercise_content where id = current_setting('test.community_snapshot')::uuid),'Original setup','snapshot instructions stay frozen');
select ok(not has_column_privilege('authenticated','public.exercises','verified_at','UPDATE'),'clients lack verification update permission');
select throws_ok($$update public.exercises set verified_at = now() where id = current_setting('test.community_exercise')::uuid$$,'42501',null,'contributors cannot edit verification directly');
select throws_ok($$select public.verify_community_exercise(current_setting('test.community_exercise')::uuid)$$,'P0001','reviewer role required','contributors cannot verify themselves');
select throws_ok($$select public.moderate_public_exercise(current_setting('test.community_exercise')::uuid,'hide','Concern')$$,'P0001','reviewer role required','contributors cannot moderate');
select is((select count(*)::integer from public.exercise_moderation_events where exercise_id = current_setting('test.community_exercise')::uuid),0,'moderation audit is reviewer-only');
select set_config('test.community_report',public.report_public_exercise(current_setting('test.community_exercise')::uuid,'Needs review')::text,true);
select is(public.report_public_exercise(current_setting('test.community_exercise')::uuid,'Duplicate concern'),current_setting('test.community_report')::uuid,'duplicate open reports return the original ID');
select throws_ok($$select public.report_public_exercise(current_setting('test.community_exercise')::uuid,'   ')$$,'P0001','report reason required (1-2000 characters)','blank reports are rejected');
select throws_ok($$select public.report_public_exercise(current_setting('test.community_exercise')::uuid,E'\n\t')$$,'P0001','report reason required (1-2000 characters)','whitespace-only reports are rejected');
select throws_ok($$select public.report_public_exercise(current_setting('test.community_exercise')::uuid,repeat('x',2001))$$,'P0001','report reason required (1-2000 characters)','oversized reports are rejected');
select throws_ok($$insert into public.exercise_reports(exercise_id,reporter_id,reason) values(current_setting('test.community_exercise')::uuid,auth.uid(),'Bypass')$$,'42501',null,'reports require the checked RPC');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000352',true);
select is((select count(*)::integer from public.exercise_publications),0,'another user cannot see source mapping');
select is((select count(*)::integer from public.exercise_reports),0,'another user cannot see reports');
set local role anon;
select is((select count(*)::integer from public.exercise_content where id = current_setting('test.community_source')::uuid),0,'private source is hidden from visitors');
select is((select count(*)::integer from public.exercise_content where id = current_setting('test.community_snapshot')::uuid),1,'visitors can read the published snapshot');
select is((select count(*)::integer from public.exercise_scenes where content_id = current_setting('test.community_snapshot')::uuid),1,'published source motion is public');
select is((select count(*)::integer from storage.objects where bucket_id = 'exercise-private' and name = 'community-test/private.webm'),0,'private media remains unsignable');
select throws_ok('select * from public.exercise_reports','42501',null,'anonymous visitors cannot read reports');
set local role postgres;
select is((select count(*)::integer from public.exercise_versions where exercise_id = current_setting('test.community_exercise')::uuid and approved_by is null),1,'community version records no fabricated approval');
select throws_ok($$update public.exercise_content set name = 'Mutated' where id = current_setting('test.community_snapshot')::uuid$$,'P0001','exercise content snapshot is immutable','content snapshot is immutable even for privileged writes');
select throws_ok($$delete from public.exercise_versions where exercise_id = current_setting('test.community_exercise')::uuid$$,'P0001','exercise_versions is append-only','version history is immutable');
select throws_ok($$update public.exercise_scenes set duration_ms = 1500 where content_id = current_setting('test.community_snapshot')::uuid$$,'P0001','exercise content snapshot children are immutable','published source scene is immutable');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000353',true);
select lives_ok($$select public.verify_community_exercise(current_setting('test.community_exercise')::uuid,'Reviewed source motion')$$,'reviewer verifies a visible community exercise without rendered assets');
select ok((select verified_at is not null and reviewed_by = auth.uid() from public.exercises where id = current_setting('test.community_exercise')::uuid),'verification records time and reviewer');
select set_config('test.community_verified',(select verified_at::text from public.exercises where id = current_setting('test.community_exercise')::uuid),true);
select public.verify_community_exercise(current_setting('test.community_exercise')::uuid);
select is((select verified_at::text from public.exercises where id = current_setting('test.community_exercise')::uuid),current_setting('test.community_verified'),'repeat verification preserves its first timestamp');
select throws_ok($$select public.moderate_public_exercise(current_setting('test.community_exercise')::uuid,'hide',' ')$$,'P0001','moderation comment required (1-2000 characters)','moderation requires an audit reason');
select public.moderate_public_exercise(current_setting('test.community_exercise')::uuid,'hide','Reported motion needs correction');
select throws_ok($$select public.verify_community_exercise(current_setting('test.community_exercise')::uuid)$$,'P0001','exercise is not published','hidden exercise cannot be verified');
select throws_ok($$select public.report_public_exercise(current_setting('test.community_exercise')::uuid,'Hidden concern')$$,'P0001','exercise is not published','hidden exercise cannot receive new reports');
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select is((select count(*)::integer from public.exercises where id = current_setting('test.community_exercise')::uuid),0,'hide removes public exercise visibility');
select is((select count(*)::integer from public.exercise_content where id = current_setting('test.community_snapshot')::uuid),0,'hide removes public snapshot visibility');
select is((select count(*)::integer from public.exercise_scenes where content_id = current_setting('test.community_snapshot')::uuid),0,'hide removes public source motion visibility');
select is((select count(*)::integer from public.exercise_search where exercise_id = current_setting('test.community_exercise')::uuid),0,'hide removes search visibility');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000353',true);
select public.moderate_public_exercise(current_setting('test.community_exercise')::uuid,'unverify','Withdraw verification');
select public.moderate_public_exercise(current_setting('test.community_exercise')::uuid,'resolve_reports','Reviewed report');
select is((select status from public.exercise_reports where id = current_setting('test.community_report')::uuid),'resolved','reviewer resolves open reports');
select public.moderate_public_exercise(current_setting('test.community_exercise')::uuid,'restore','Restore public source');
select is((select status::text from public.exercises where id = current_setting('test.community_exercise')::uuid),'published','reviewer restores hidden community exercise');
select is((select verified_at from public.exercises where id = current_setting('test.community_exercise')::uuid),null::timestamptz,'restoration preserves revoked verification');
select throws_ok($$select public.moderate_public_exercise((select id from public.exercises where status = 'pending_media' limit 1),'restore','Bypass review')$$,'P0001','exercise is not hidden','pending catalog candidates cannot use restore to publish');
select ok((select count(*) >= 7 from public.exercise_moderation_events where exercise_id = current_setting('test.community_exercise')::uuid),'publication and moderation decisions are audited');
set local role postgres;
select throws_ok($$delete from public.exercise_moderation_events where exercise_id = current_setting('test.community_exercise')::uuid$$,'P0001','exercise_moderation_events is append-only','moderation audit cannot be erased');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000351',true);
select lives_ok($$select public.delete_private_exercise(current_setting('test.community_private')::uuid)$$,'published source draft remains independently deletable');
select is((select source_private_exercise_id from public.exercise_publications where exercise_id = current_setting('test.community_exercise')::uuid),null::uuid,'deleting the source retains the publication mapping');
select is((select name from public.exercise_content where id = current_setting('test.community_snapshot')::uuid),'Community motion','deleting the draft retains the published snapshot');
select set_config('test.community_no_scene',public.save_private_metadata('{"name":"Metadata only exercise"}')::text,true);
select lives_ok($$select public.publish_private_exercise(current_setting('test.community_no_scene')::uuid)$$,'a named exercise can publish without a scene');
select set_config('test.community_untitled',public.save_private_metadata('{"name":"  uNtItLeD ExErCiSe  "}')::text,true);
select throws_ok($$select public.publish_private_exercise(current_setting('test.community_untitled')::uuid)$$,
  'P0001','exercise name required','placeholder names are rejected after trimming regardless of case');
set local role postgres;
select set_config('test.reviewed_snapshot',private.clone_exercise_content(
  (select content_id from public.private_exercises where id = current_setting('test.community_no_scene')::uuid),'submission_editorial',null)::text,true);
select set_config('test.reviewed_exercise',gen_random_uuid()::text,true);
update public.exercise_content set kind = 'published_version' where id = current_setting('test.reviewed_snapshot')::uuid;
insert into public.exercises(id,slug,current_content_id,published_at)
  values(current_setting('test.reviewed_exercise')::uuid,'community-test-reviewed-gate',current_setting('test.reviewed_snapshot')::uuid,now());
insert into public.exercise_versions(exercise_id,version_number,content_id,approved_by)
  values(current_setting('test.reviewed_exercise')::uuid,1,current_setting('test.reviewed_snapshot')::uuid,'00000000-0000-4000-8000-000000000353');
select throws_ok($$update public.exercises set status = 'published' where id = current_setting('test.reviewed_exercise')::uuid$$,
  'P0001','published exercise must have a character demonstration','reviewed publication retains its demonstration gate');
select set_config('test.legacy_snapshot',private.clone_exercise_content(
  (select content_id from public.private_exercises where id = current_setting('test.community_no_scene')::uuid),'submission_editorial',null)::text,true);
select set_config('test.legacy_exercise',gen_random_uuid()::text,true);
insert into public.exercise_media(content_id,asset_group_id,kind,storage_bucket,storage_path,license_name)
  values(current_setting('test.legacy_snapshot')::uuid,gen_random_uuid(),'webm','exercise-public','community-test/reviewed.webm','Original');
update public.exercise_content set kind = 'published_version' where id = current_setting('test.legacy_snapshot')::uuid;
insert into public.exercises(id,slug,current_content_id,published_at)
  values(current_setting('test.legacy_exercise')::uuid,'community-test-reviewed-verified',current_setting('test.legacy_snapshot')::uuid,now());
insert into public.exercise_versions(exercise_id,version_number,content_id,approved_by)
  values(current_setting('test.legacy_exercise')::uuid,1,current_setting('test.legacy_snapshot')::uuid,'00000000-0000-4000-8000-000000000353');
update public.exercises set status = 'published' where id = current_setting('test.legacy_exercise')::uuid;
select ok((select verified_at is not null from public.exercises where id = current_setting('test.legacy_exercise')::uuid),'legacy approved publication automatically receives verification');
-- Legacy publications have no community mapping and must remain restorable after moderation.
update public.exercises set status = 'withdrawn' where id = current_setting('test.reviewed_exercise')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000353',true);
select throws_ok($$select public.moderate_public_exercise(current_setting('test.reviewed_exercise')::uuid,'restore','Bypass review')$$,
  'P0001','exercise is not hidden','unmoderated withdrawn records cannot be restored');
select public.moderate_public_exercise(current_setting('test.legacy_exercise')::uuid,'unverify','Withdraw old approval');
select public.moderate_public_exercise(current_setting('test.legacy_exercise')::uuid,'hide','Review revised motion');
select lives_ok($$select public.moderate_public_exercise(current_setting('test.legacy_exercise')::uuid,'restore','Restore without verification')$$,'legacy published records with a prior hide event can be restored');
select is((select verified_at from public.exercises where id = current_setting('test.legacy_exercise')::uuid),null::timestamptz,'restoring an approved legacy version preserves explicitly revoked verification');
select * from finish();
rollback;
