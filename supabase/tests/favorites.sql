begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);

insert into public.exercise_media (content_id, asset_group_id, kind, storage_bucket, storage_path, license_name)
select current_content_id, gen_random_uuid(), 'webm', 'test-only', 'favorite.webm', 'Original test render'
from public.exercises where slug = 'dumbbell-lateral-raise';
update public.exercise_content set kind = 'published_version'
where id = (select current_content_id from public.exercises where slug = 'dumbbell-lateral-raise');
insert into public.exercise_versions (exercise_id, version_number, content_id)
select id, 1, current_content_id from public.exercises where slug = 'dumbbell-lateral-raise';
update public.exercises set status = 'published', published_at = now()
where slug = 'dumbbell-lateral-raise';

-- Exercise deferred guards under the caller's role, as a REST commit does.
set constraints all immediate;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-000000000041', 'favorite-owner@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000042', 'favorite-other@example.test', 'authenticated', 'authenticated');

select is((select favorite_count from public.exercises where slug = 'dumbbell-lateral-raise'), 0,
  'newly published exercise starts with no favorites');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000041', true);
set constraints all deferred;
insert into public.favorites (user_id, exercise_id)
select auth.uid(), id from public.exercises where slug = 'dumbbell-lateral-raise';
select lives_ok('set constraints all immediate',
  'a contributor can commit a favorite without reviewer access to versions');
select is((select favorite_count from public.exercises where slug = 'dumbbell-lateral-raise'), 1,
  'saving a favorite increments its public count');
select is((select count(*)::integer from public.favorites where user_id = auth.uid()), 1,
  'owner can read the saved favorite');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000042', true);
select is((select count(*)::integer from public.favorites), 0,
  'another user cannot read the favorite');
delete from public.favorites where exercise_id =
  (select id from public.exercises where slug = 'dumbbell-lateral-raise');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000041', true);
set constraints all deferred;
delete from public.favorites where exercise_id =
  (select id from public.exercises where slug = 'dumbbell-lateral-raise');
select lives_ok('set constraints all immediate', 'a contributor can commit removing a favorite');
select is((select favorite_count from public.exercises where slug = 'dumbbell-lateral-raise'), 0,
  'removing a favorite decrements its public count');

select * from finish();
rollback;
