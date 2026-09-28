-- Runs only in the temporary database created by scripts/test-database.mjs.
set statement_timeout = '60s';
create temporary table benchmark_rows as
select i,gen_random_uuid() exercise_id,gen_random_uuid() content_id,source.current_content_id source_content_id
from generate_series(1,50000) i
join (select current_content_id,row_number() over(order by slug) n from public.exercises) source on source.n = (i % 20)+1;
insert into public.exercise_content(id,kind,name,family_id,short_description,difficulty,exercise_type,mechanic,force_type,laterality)
select row.content_id,'submission_editorial','Load Case ' || lpad(row.i::text,5,'0') || ' ' || c.name,
  c.family_id,c.short_description,c.difficulty,c.exercise_type,c.mechanic,c.force_type,c.laterality
from benchmark_rows row join public.exercise_content c on c.id = row.source_content_id;
insert into public.exercise_muscles(content_id,muscle_id,role)
select row.content_id,r.muscle_id,r.role from benchmark_rows row join public.exercise_muscles r on r.content_id = row.source_content_id;
insert into public.exercise_joints(content_id,joint_id,role)
select row.content_id,r.joint_id,r.role from benchmark_rows row join public.exercise_joints r on r.content_id = row.source_content_id;
insert into public.exercise_joint_actions(content_id,joint_action_id,role)
select row.content_id,r.joint_action_id,r.role from benchmark_rows row join public.exercise_joint_actions r on r.content_id = row.source_content_id;
insert into public.exercise_equipment(content_id,equipment_id,role)
select row.content_id,r.equipment_id,r.role from benchmark_rows row join public.exercise_equipment r on r.content_id = row.source_content_id;
insert into public.exercise_attachments(content_id,attachment_id)
select row.content_id,r.attachment_id from benchmark_rows row join public.exercise_attachments r on r.content_id = row.source_content_id;
insert into public.exercise_movement_patterns(content_id,movement_pattern_id)
select row.content_id,r.movement_pattern_id from benchmark_rows row join public.exercise_movement_patterns r on r.content_id = row.source_content_id;
insert into public.exercise_aliases(content_id,alias,normalized_alias)
select row.content_id,'Benchmark alias ' || row.i,'benchmark alias ' || row.i from benchmark_rows row where row.i % 3 = 0;
insert into public.exercise_biomechanics(content_id,body_position_id,plane_id,resistance_source_id,resistance_profile,peak_resistance_position,classification_confidence)
select row.content_id,r.body_position_id,r.plane_id,r.resistance_source_id,r.resistance_profile,r.peak_resistance_position,r.classification_confidence
from benchmark_rows row join public.exercise_biomechanics r on r.content_id = row.source_content_id;
insert into public.exercise_media(content_id,asset_group_id,kind,storage_bucket,storage_path,license_name)
select content_id,gen_random_uuid(),'webm','benchmark-only',exercise_id::text || '.webm','Synthetic benchmark metadata' from benchmark_rows;
update public.exercise_content set kind = 'published_version' where id in(select content_id from benchmark_rows);
insert into public.exercises(id,slug,current_content_id,status,favorite_count,published_at)
select exercise_id,'benchmark-' || i,content_id,'pending_media',i % 400,now() - i * interval '1 minute' from benchmark_rows;
insert into public.exercise_versions(exercise_id,version_number,content_id)
select exercise_id,1,content_id from benchmark_rows;
update public.exercises set status = 'published' where id in(select exercise_id from benchmark_rows);
analyze;
set statement_timeout = '15s';
load 'auto_explain';
set auto_explain.log_min_duration = '100ms';
set auto_explain.log_nested_statements = on;
set auto_explain.log_analyze = on;
set auto_explain.log_buffers = on;
set auto_explain.log_level = 'log';
set client_min_messages = 'log';
set role anon;
\echo CASE alphabetical
explain(analyze,buffers,format json) select * from public.explore_exercises(page_size => 24);
\echo CASE joint_and_cable
explain(analyze,buffers,format json) select * from public.explore_exercises(joint_action_slugs => array['shoulder-abduction'],equipment_slugs => array['cable']);
\echo CASE multiple_actions
explain(analyze,buffers,format json) select * from public.explore_exercises(joint_action_slugs => array['hip-extension','knee-extension'],mechanic_values => array['compound']::public.exercise_mechanic[]);
\echo CASE combined_anatomy
explain(analyze,buffers,format json) select * from public.explore_exercises(primary_muscle_slugs => array['lateral-deltoid'],joint_action_slugs => array['shoulder-abduction'],equipment_slugs => array['cable'],resistance_profiles => array['unknown']::public.resistance_profile[]);
\echo CASE search_alias
explain(analyze,buffers,format json) select * from public.explore_exercises(search_text => 'benchmark alias 49998');
\echo CASE fuzzy_name
explain(analyze,buffers,format json) select * from public.explore_exercises(search_text => 'Load Case 12345 Cable Lateral Rais');
\echo CASE newest
explain(analyze,buffers,format json) select * from public.explore_exercises(sort_key => 'newest');
\echo CASE favorites
explain(analyze,buffers,format json) select * from public.explore_exercises(sort_key => 'most_favorited');
\echo CASE no_matches
explain(analyze,buffers,format json) select * from public.explore_exercises(joint_action_slugs => array['shoulder-abduction'],equipment_slugs => array['barbell']);

reset role;
insert into auth.users(id,email,aud,role) values ('00000000-0000-4000-8000-000000000161','benchmark-owner@example.test','authenticated','authenticated');
select set_config('benchmark.alias',(select c.name from benchmark_rows r join public.exercise_content c on c.id=r.content_id where r.i=12345),false);
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000161',false);
select set_config('benchmark.private_id',public.save_private_metadata(jsonb_build_object('name','Original author label','aliases',jsonb_build_array(current_setting('benchmark.alias'))))::text,false);
\echo CASE duplicate_with_alias
explain(analyze,buffers,format json) select * from public.find_exercise_duplicates(current_setting('benchmark.private_id')::uuid);
