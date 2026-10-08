begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(44);

insert into public.exercise_aliases (content_id, alias, normalized_alias)
select current_content_id, 'Cable Lateral Raise', 'cable lateral raise'
from public.exercises where slug = 'cross-body-cable-lateral-raise';
do $$ begin
  perform set_config('kinevault.test_unpublished_cursor',
    (select id::text from public.exercises where slug = 'dumbbell-curl'), true);
end $$;

update public.exercise_equipment ee set equipment_id = q.id
from public.exercises e, public.equipment q
where ee.content_id = e.current_content_id
  and e.slug = 'behind-body-cable-lateral-raise'
  and q.slug = 'single-cable';

insert into public.exercise_media (
  content_id, asset_group_id, kind, storage_bucket, storage_path, license_name
)
select e.current_content_id, gen_random_uuid(), 'webm', 'test-only', e.slug || '.webm', 'Original test render'
from public.exercises e
where e.slug in (
  'dumbbell-lateral-raise', 'cable-lateral-raise',
  'behind-body-cable-lateral-raise', 'cross-body-cable-lateral-raise',
  'barbell-romanian-deadlift', 'barbell-bench-press'
);

update public.exercise_content set kind = 'published_version'
where id in (
  select current_content_id from public.exercises
  where slug in (
    'dumbbell-lateral-raise', 'cable-lateral-raise',
    'behind-body-cable-lateral-raise', 'cross-body-cable-lateral-raise',
    'barbell-romanian-deadlift', 'barbell-bench-press'
  )
);
insert into public.exercise_versions (exercise_id, version_number, content_id)
select id, 1, current_content_id from public.exercises
where slug in (
  'dumbbell-lateral-raise', 'cable-lateral-raise',
  'behind-body-cable-lateral-raise', 'cross-body-cable-lateral-raise',
  'barbell-romanian-deadlift', 'barbell-bench-press'
);
update public.exercises set status = 'published', published_at = now()
where slug in (
  'dumbbell-lateral-raise', 'cable-lateral-raise',
  'behind-body-cable-lateral-raise', 'cross-body-cable-lateral-raise',
  'barbell-romanian-deadlift', 'barbell-bench-press'
);

select is((select count(*)::integer from public.exercise_search), 6,
  'only published exercises receive search documents');
select is((select count(*)::integer from public.explore_exercises(
  joint_action_slugs => array['shoulder-abduction'],
  equipment_slugs => array['cable']
)), 3, 'joint action and equipment filters intersect');
select is((select count(*)::integer from public.explore_exercises(
  joint_action_slugs => array['shoulder-abduction', 'scapular-upward-rotation'],
  equipment_slugs => array['cable']
)), 3, 'multiple joint actions all match');
select is((select count(*)::integer from public.explore_exercises(
  equipment_slugs => array['cable', 'dumbbell']
)), 0, 'multiple equipment values all match');
select is((select count(*)::integer from public.explore_exercises(
  muscle_slugs => array['lateral-deltoid'],
  joint_action_slugs => array['shoulder-abduction'],
  equipment_slugs => array['cable']
)), 3, 'muscle, action, and equipment filters combine');
select is((select count(*)::integer from public.explore_exercises(search_text => 'RDL')), 1,
  'search matches aliases');
select is((select count(*)::integer from public.explore_exercises(
  resistance_profiles => array['ascending']::public.resistance_profile[]
)), 1, 'resistance profile is filterable');
select is((select count(*)::integer from public.explore_exercises(
  primary_muscle_slugs => array['lateral-deltoid']
)), 4, 'primary muscle role is filterable');
select is((select count(*)::integer from public.explore_exercises(
  secondary_muscle_slugs => array['triceps-brachii']
)), 1, 'secondary muscle role is filterable');
select is((select count(*)::integer from public.explore_exercises(
  stabilizer_muscle_slugs => array['lateral-deltoid']
)), 0, 'stabilizer muscle role is distinct');
select is((select count(*)::integer from public.explore_exercises(
  family_slugs => array['lateral-raise']
)), 4, 'exercise families are filterable');
select is((select count(*)::integer from public.explore_exercises(
  movement_pattern_slugs => array['isolation']
)), 4, 'movement patterns are filterable');
select is((select count(*)::integer from public.explore_exercises(
  plane_slugs => array['frontal']
)), 4, 'plane of motion is filterable');
select is((select count(*)::integer from public.explore_exercises(
  mechanic_values => array['isolation']::public.exercise_mechanic[]
)), 4, 'compound and isolation are filterable');
select is((select count(*)::integer from public.explore_exercises(
  force_type_values => array['pull']::public.force_type[]
)), 5, 'force type is filterable');
select is((select count(*)::integer from public.explore_exercises(
  laterality_values => array['unilateral']::public.laterality[]
)), 3, 'laterality is filterable');
select is((select count(*)::integer from public.explore_exercises(
  equipment_category_slugs => array['cable']
)), 3, 'equipment category is filterable');
select is((select count(*)::integer from public.explore_exercises(
  attachment_slugs => array['d-handle']
)), 3, 'attachments are filterable separately');
select is((select count(*)::integer from public.explore_exercises(
  resistance_source_slugs => array['cable']
)), 3, 'resistance source is filterable');
select is((select count(*)::integer from public.explore_exercises(
  resistance_profiles => array['ascending', 'unknown']::public.resistance_profile[]
)), 0, 'multiple resistance profiles use ALL semantics');
select is((select count(*)::integer from public.explore_exercises(
  peak_resistance_positions => array['end']::public.peak_resistance_position[]
)), 1, 'peak resistance position is filterable');
select is((select count(*)::integer from public.explore_exercises(
  body_position_slugs => array['standing']
)), 5, 'body position is filterable');
select is((select count(*)::integer from public.explore_exercises(
  difficulty_values => array['intermediate']::public.exercise_difficulty[]
)), 6, 'difficulty is filterable');

set local role anon;
select is((select count(*)::integer from public.explore_exercises(
  joint_action_slugs => array['shoulder-abduction'],
  equipment_slugs => array['cable']
)), 3, 'anonymous visitors can search approved demonstrations');
select is((select count(*)::integer from public.explore_exercises(family_slugs => array['curl'])),0,'public-only RPC excludes unreviewed family candidates');
select is((select count(*)::integer from public.explore_exercises(equipment_slugs => array[$$cable' OR true)--$$])),0,'filter values cannot inject SQL');
select lives_ok($$select * from public.explore_exercises(search_text => 'quote''; select auth.users; --')$$,'search text remains a literal value');
select is((select count(*)::integer from public.explore_exercises(page_size => 2)),3,'page query returns only one look-ahead row');
select throws_ok($$select * from public.explore_exercises(cursor_id => '00000000-0000-4000-8000-000000000001')$$,
  'P0001','invalid cursor','incomplete cursors are rejected');

select is((select slug from public.explore_exercises(search_text => 'Cable Lateral Raise') limit 1),
  'cable-lateral-raise', 'exact name precedes related alphabetical matches');
select is((select slug from public.explore_exercises(search_text => '  CABLE-LATERAL RAISE  ') limit 1),
  'cable-lateral-raise', 'exact ranking normalizes case and punctuation');
select is((select slug from public.explore_exercises(search_text => 'Cable Lateral Raise') offset 1 limit 1),
  'cross-body-cable-lateral-raise', 'exact alias precedes related names after the exact name');
select is((select slug from public.explore_exercises(search_text => 'Romanian Deadlift') limit 1),
  'barbell-romanian-deadlift', 'exact alias is searchable');
select is((select slug from public.explore_exercises(search_text => 'Cable Lateral Raise',
  equipment_slugs => array['single-cable']) limit 1),
  'behind-body-cable-lateral-raise', 'ranking preserves combined filters');
select is((select array_agg(page.slug) from public.explore_exercises(search_text => 'Cable Lateral Raise',
  equipment_slugs => array['cable'],
  cursor_name => 'cable lateral raise', cursor_id => (select id from public.exercises where slug = 'cable-lateral-raise')) page),
  array['cross-body-cable-lateral-raise','behind-body-cable-lateral-raise'],
  'cursor after exact name includes alphabetically earlier related results');
select is((select array_agg(page.slug) from public.explore_exercises(search_text => 'Cable Lateral Raise',
  equipment_slugs => array['cable'],
  cursor_name => 'cross body cable lateral raise', cursor_id => (select id from public.exercises where slug = 'cross-body-cable-lateral-raise')) page),
  array['behind-body-cable-lateral-raise'], 'cursor after alias crosses to related results without duplicates');
select is((select count(*)::integer from public.explore_exercises(search_text => 'Cable Lateral Raise',
  equipment_slugs => array['cable'],
  cursor_name => 'behind body cable lateral raise', cursor_id => (select id from public.exercises where slug = 'behind-body-cable-lateral-raise'))),
  0, 'cursor after final related match returns no duplicate exact results');
select is((select array_agg(page.slug) from public.explore_exercises(search_text => 'Cable Lateral Raise', equipment_slugs => array['cable'], sort_key => 'newest') page),
  (select array_agg(e.slug order by e.published_at desc,e.id desc) from public.exercises e where e.status = 'published' and e.slug like '%cable-lateral-raise'),
  'explicit newest sorting keeps publication order during search');
select is((select array_agg(page.slug) from public.explore_exercises(search_text => 'Cable Lateral Raise', equipment_slugs => array['cable'], sort_key => 'most_favorited') page),
  (select array_agg(e.slug order by e.favorite_count desc,e.id desc) from public.exercises e where e.status = 'published' and e.slug like '%cable-lateral-raise'),
  'explicit favorite sorting keeps favorite order during search');
select is((select count(*)::integer from public.explore_exercises(search_text => 'Dumbbell Curl') where slug = 'dumbbell-curl'),
  0, 'exact search cannot expose an unpublished exercise');
select is((select array_agg(page.slug) from public.explore_exercises() page),
  array['barbell-bench-press','barbell-romanian-deadlift','behind-body-cable-lateral-raise',
    'cable-lateral-raise','cross-body-cable-lateral-raise','dumbbell-lateral-raise'],
  'unsearched catalog keeps alphabetical order');
select is((select count(*)::integer from public.explore_exercises(search_text => 'Cable Lateral Raise', page_size => 1)),
  2, 'ranked pages retain exactly one look-ahead row');
select throws_ok($$select * from public.explore_exercises(search_text => 'Cable Lateral Raise',
  cursor_name => 'dumbbell curl', cursor_id => current_setting('kinevault.test_unpublished_cursor')::uuid)$$,
  'P0001','invalid cursor','ranked cursor cannot refer to an unpublished exercise');

reset role;
insert into public.exercise_aliases (content_id, alias, normalized_alias)
select current_content_id, 'Dumbbell Curl Variation', 'dumbbell curl variation'
from public.exercises where slug = 'barbell-curl';
insert into public.exercise_media (content_id, asset_group_id, kind, storage_bucket, storage_path, license_name)
select current_content_id, gen_random_uuid(), 'webm', 'test-only', slug || '.webm', 'Original test render'
from public.exercises where slug in ('barbell-curl','dumbbell-curl');
update public.exercise_content set kind = 'published_version'
where id in (select current_content_id from public.exercises where slug in ('barbell-curl','dumbbell-curl'));
insert into public.exercise_versions (exercise_id, version_number, content_id)
select id, 1, current_content_id from public.exercises where slug in ('barbell-curl','dumbbell-curl');
update public.exercises set status = 'published', published_at = now() where slug in ('barbell-curl','dumbbell-curl');
set local role anon;
select is((select slug from public.explore_exercises(search_text => 'Dumbbell Curl') limit 1),
  'dumbbell-curl', 'Dumbbell Curl search places the approved exact exercise first');

select * from finish();
rollback;
