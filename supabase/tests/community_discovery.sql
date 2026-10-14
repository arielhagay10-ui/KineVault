begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
select no_plan();

insert into auth.users(id,email,aud,role) values
  ('00000000-0000-4000-8000-000000000361','rank-owner@example.test','authenticated','authenticated'),
  ('00000000-0000-4000-8000-000000000362','rank-visitor@example.test','authenticated','authenticated'),
  ('00000000-0000-4000-8000-000000000363','rank-other@example.test','authenticated','authenticated'),
  ('00000000-0000-4000-8000-000000000364','rank-reviewer@example.test','authenticated','authenticated');
update public.roles set role = 'reviewer' where user_id = '00000000-0000-4000-8000-000000000364';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000361',true);
select set_config('test.rank_exact',public.publish_private_exercise(public.save_private_metadata('{"name":"Ranking Raise"}'))::text,true);
select set_config('test.rank_verified',public.publish_private_exercise(public.save_private_metadata('{"name":"Ranking Raise Extended"}'))::text,true);
select set_config('test.rank_busy',public.publish_private_exercise(public.save_private_metadata('{"name":"Ranking Popular Raise"}'))::text,true);
select lives_ok('set constraints all immediate','minimal community entries can commit');
select lives_ok($$select public.record_exercise_engagement(current_setting('test.rank_exact')::uuid,'view')$$,'creator view is harmless');
select is((select view_count from public.exercises where id = current_setting('test.rank_exact')::uuid),0,'creator cannot increase own views');
select throws_ok($$select public.record_exercise_engagement(current_setting('test.rank_exact')::uuid,'click')$$,'P0001','invalid engagement kind','unknown event kinds are rejected');
select throws_ok($$select public.record_exercise_engagement(null,'view')$$,'P0001','published exercise required','missing exercise is rejected');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000362',true);
select throws_ok($$select public.record_exercise_engagement(current_setting('test.rank_busy')::uuid,'use')$$,'P0001','copy the exercise before recording use','clients cannot invent a use');
select public.record_exercise_engagement(current_setting('test.rank_busy')::uuid,'view');
select public.record_exercise_engagement(current_setting('test.rank_busy')::uuid,'view');
select is((select view_count from public.exercises where id = current_setting('test.rank_busy')::uuid),1,'repeated visits count once');
select throws_ok($$insert into public.exercise_engagement(user_id,exercise_id,kind) values(auth.uid(),current_setting('test.rank_busy')::uuid,'view')$$,'42501',null,'raw engagement writes are denied');
select set_config('test.rank_copy',public.copy_public_exercise(current_setting('test.rank_busy')::uuid)::text,true);
select public.copy_public_exercise(current_setting('test.rank_busy')::uuid);
select is((select use_count from public.exercises where id = current_setting('test.rank_busy')::uuid),1,'multiple copies by one person count once');
select public.record_exercise_engagement(current_setting('test.rank_busy')::uuid,'use');
select is((select use_count from public.exercises where id = current_setting('test.rank_busy')::uuid),1,'manual use event after copy stays deduplicated');
select is((select count(*)::integer from public.exercise_engagement),2,'viewer sees only own distinct events');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000363',true);
select is((select count(*)::integer from public.exercise_engagement),0,'another account cannot read visit history');
select public.record_exercise_engagement(current_setting('test.rank_busy')::uuid,'view');
select public.copy_public_exercise(current_setting('test.rank_busy')::uuid);
insert into public.favorites(user_id,exercise_id) values(auth.uid(),current_setting('test.rank_busy')::uuid);
select is((select view_count from public.exercises where id = current_setting('test.rank_busy')::uuid),2,'another person increases visitor count');
select is((select use_count from public.exercises where id = current_setting('test.rank_busy')::uuid),2,'another copier increases use count');
select ok((select discovery_score > 0 from public.exercises where id = current_setting('test.rank_busy')::uuid),'real activity improves discovery');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000364',true);
select public.verify_community_exercise(current_setting('test.rank_verified')::uuid,'Checked movement');
select is((select discovery_score from public.exercises where id = current_setting('test.rank_verified')::uuid),6::double precision,'verification gives a finite boost');
select ok((select discovery_score from public.exercises where id = current_setting('test.rank_verified')::uuid) >
  (select discovery_score from public.exercises where id = current_setting('test.rank_exact')::uuid),'otherwise equal verified entry ranks above new unverified entry');
select ok((select discovery_score from public.exercises where id = current_setting('test.rank_busy')::uuid) < 6,'a few visits cannot overwhelm verification');
select throws_ok($$update public.exercises set view_count = 999 where id = current_setting('test.rank_busy')::uuid$$,'42501',null,'reviewers cannot forge counter values');
select is((select exercise_id from public.explore_exercises(search_text=>'Ranking') limit 1),current_setting('test.rank_verified')::uuid,'default catalog favors verified entries');
select is((select exercise_id from public.explore_exercises(search_text=>'Ranking') offset 1 limit 1),current_setting('test.rank_busy')::uuid,'usage ranks otherwise similar community entries');
select is((select exercise_id from public.explore_exercises(search_text=>'Ranking Raise') limit 1),current_setting('test.rank_exact')::uuid,'exact query match outranks unrelated verification and usage');
select is((select array_agg(name) from public.explore_exercises(search_text=>'Ranking',sort_key=>'alphabetical')),
  array['Ranking Popular Raise','Ranking Raise','Ranking Raise Extended'],'explicit alphabetical remains available');
select is((select exercise_id from public.explore_exercises(search_text=>'Ranking',sort_key=>'most_favorited') limit 1),current_setting('test.rank_busy')::uuid,'explicit favorites remains available');

select set_config('test.rank_score',(select discovery_score::text from public.exercises where id=current_setting('test.rank_verified')::uuid),true);
select set_config('test.rank_date',(select published_at::text from public.exercises where id=current_setting('test.rank_verified')::uuid),true);
select is((select array_agg(name) from public.explore_exercises(search_text=>'Ranking',cursor_id=>current_setting('test.rank_verified')::uuid,
  cursor_score=>current_setting('test.rank_score')::double precision,cursor_published_at=>current_setting('test.rank_date')::timestamptz)),
  array['Ranking Popular Raise','Ranking Raise'],'recommendation cursor resumes without duplicate top result');
select is((select count(*)::integer from public.explore_exercises(search_text=>'Ranking',page_size=>1)),2,'recommended pages include one look-ahead row');
select is((select array_agg(name) from public.explore_exercises(search_text=>'Ranking Raise',
  cursor_id=>current_setting('test.rank_exact')::uuid,cursor_score=>0,
  cursor_published_at=>(select published_at from public.exercises where id=current_setting('test.rank_exact')::uuid))),
  array['Ranking Raise Extended','Ranking Popular Raise'],'query cursor crosses from exact match to boosted partial matches');
select throws_ok($$select * from public.explore_exercises(sort_key=>'recommended',cursor_id=>current_setting('test.rank_verified')::uuid,cursor_score=>6)$$,'P0001','invalid cursor','recommendation boundary needs its timestamp');
select throws_ok($$select * from public.explore_exercises(sort_key=>'recommended',cursor_id=>current_setting('test.rank_verified')::uuid,cursor_score=>'NaN'::double precision,cursor_published_at=>now())$$,'P0001','invalid cursor','nonfinite recommendation cursor is rejected');
select public.moderate_public_exercise(current_setting('test.rank_verified')::uuid,'hide','Test removal');
select is((select count(*)::integer from public.explore_exercises(search_text=>'Ranking') where exercise_id=current_setting('test.rank_verified')::uuid),0,'hidden verified entry cannot rank');
select throws_ok($$select public.record_exercise_engagement(current_setting('test.rank_verified')::uuid,'view')$$,'P0001','published exercise required','hidden entries cannot collect engagement');
select public.moderate_public_exercise(current_setting('test.rank_verified')::uuid,'restore','Test restore');
select is((select exercise_id from public.explore_exercises(search_text=>'Ranking') limit 1),current_setting('test.rank_verified')::uuid,'restored entry can rank again');
set local extra_float_digits = 0;
select is((select discovery_score::text::double precision from public.exercises where id=current_setting('test.rank_busy')::uuid),
  (select discovery_score from public.exercises where id=current_setting('test.rank_busy')::uuid),'recommendation score survives JSON float precision');
select is((select array_agg(name) from public.explore_exercises(search_text=>'Ranking',
  cursor_id=>current_setting('test.rank_busy')::uuid,
  cursor_score=>(select discovery_score::text::double precision from public.exercises where id=current_setting('test.rank_busy')::uuid),
  cursor_published_at=>(select published_at from public.exercises where id=current_setting('test.rank_busy')::uuid))),
  array['Ranking Raise'],'rounded JSON cursor excludes its boundary row');
set local extra_float_digits = 1;

set local role anon;
select throws_ok($$select public.record_exercise_engagement(current_setting('test.rank_busy')::uuid,'view')$$,'42501',null,'anonymous callers cannot manufacture visitor counts');
select throws_ok('select * from public.exercise_engagement','42501',null,'anonymous visitors cannot inspect engagement identities');
select is((select exercise_id from public.explore_exercises(search_text=>'Ranking') limit 1),current_setting('test.rank_verified')::uuid,'anonymous public search uses recommendations');
select * from finish();
rollback;
