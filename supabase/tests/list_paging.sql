begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(5);

insert into auth.users(id,email,aud,role) values
  ('00000000-0000-4000-8000-000000000541','paging-owner@example.test','authenticated','authenticated'),
  ('00000000-0000-4000-8000-000000000542','paging-other@example.test','authenticated','authenticated');
create temporary table paging_fixtures as
select n, gen_random_uuid() as content_id, gen_random_uuid() as exercise_id from generate_series(1,55) n;
insert into public.exercise_content(id,kind,name)
select content_id,'catalog_candidate','Paging fixture ' || n from paging_fixtures;
insert into public.exercise_media(content_id,asset_group_id,kind,storage_bucket,storage_path,license_name)
select content_id,gen_random_uuid(),'webm','test-only','paging-' || n || '.webm','Original test render' from paging_fixtures;
update public.exercise_content set kind='published_version' where id in (select content_id from paging_fixtures);
insert into public.exercises(id,slug,current_content_id)
select exercise_id,'paging-fixture-' || n,content_id from paging_fixtures;
insert into public.exercise_versions(exercise_id,version_number,content_id)
select exercise_id,1,content_id from paging_fixtures;
update public.exercises set status='published',published_at=now() where id in (select exercise_id from paging_fixtures);
set constraints all immediate;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000541',true);
insert into public.favorites(user_id,exercise_id)
select auth.uid(),id from public.exercises where slug like 'paging-fixture-%';
select is((select count(*)::integer from public.favorites where user_id=auth.uid()),55,
  'favorite total counts all records independently of the visible page');
select is((select count(*)::integer from (select exercise_id from public.favorites where user_id=auth.uid()
  order by created_at desc,exercise_id limit 24 offset 0) page),24,'first favorite page is bounded');
select is((select count(*)::integer from (select exercise_id from public.favorites where user_id=auth.uid()
  order by created_at desc,exercise_id limit 24 offset 24) page),24,'second favorite page is reachable');
select is((select count(*)::integer from (select exercise_id from public.favorites where user_id=auth.uid()
  order by created_at desc,exercise_id limit 24 offset 48) page),7,'records beyond the former 50-row cap are reachable');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000542',true);
select is((select count(*)::integer from public.favorites),0,'paging and totals still enforce favorite ownership');
select * from finish();
rollback;
