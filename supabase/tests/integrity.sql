begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
set constraints all immediate;
select plan(5);

update public.exercise_content
set kind = 'published_version'
where id = (select current_content_id from public.exercises where slug = 'barbell-bench-press');
insert into public.exercise_versions (exercise_id, version_number, content_id)
select id, 1, current_content_id from public.exercises where slug = 'barbell-bench-press';

select throws_ok(
  $$update public.exercises set status = 'published', published_at = now() where slug = 'barbell-bench-press'$$,
  'P0001', 'published exercise must have a character demonstration',
  'publication cannot bypass the media requirement'
);
select throws_ok(
  $$update public.exercise_content set name = 'Changed' where id = (select current_content_id from public.exercises where slug = 'barbell-bench-press')$$,
  'P0001', 'exercise content snapshot is immutable',
  'published content cannot be edited in place'
);
select throws_ok(
  $$delete from public.exercise_muscles where content_id = (select current_content_id from public.exercises where slug = 'barbell-bench-press')$$,
  'P0001', 'exercise content snapshot children are immutable',
  'published classifications cannot be removed in place'
);
select throws_ok(
  $$insert into public.exercise_relations (source_exercise_id, target_exercise_id, relation_type)
    select parent.id, child.id, 'variation_of'
    from public.exercises parent, public.exercises child
    where parent.slug = 'cable-lateral-raise' and child.slug = 'behind-body-cable-lateral-raise'$$,
  'P0001', 'variation relationship would create a cycle',
  'variation tree rejects cycles'
);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-000000000011', 'moderator@example.test', 'authenticated', 'authenticated');
insert into public.exercise_content (id, kind, owner_id, name) values
  ('10000000-0000-4000-8000-000000000011', 'submission_original', '00000000-0000-4000-8000-000000000011', 'Audit Example');
insert into public.exercise_submissions (id, owner_id, original_content_id, status) values
  ('20000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000011', 'submitted');
insert into public.moderation_events (id, submission_id, actor_id, action, to_status) values
  ('30000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000011', 'submit', 'submitted');
select throws_ok(
  $$update public.moderation_events set comment = 'Changed' where id = '30000000-0000-4000-8000-000000000011'$$,
  'P0001', 'moderation_events is append-only',
  'moderation history is append-only'
);

select * from finish();
rollback;
