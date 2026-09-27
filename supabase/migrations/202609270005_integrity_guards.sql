create or replace function private.reject_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;

create trigger immutable_moderation_events
before update or delete on public.moderation_events
for each row execute function private.reject_audit_mutation();

create trigger immutable_exercise_versions
before update or delete on public.exercise_versions
for each row execute function private.reject_audit_mutation();

create or replace function private.protect_content_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.kind in ('submission_original', 'published_version') then
    raise exception 'exercise content snapshot is immutable';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger immutable_content_snapshot
before update or delete on public.exercise_content
for each row execute function private.protect_content_snapshot();

create or replace function private.protect_content_children()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_id uuid;
  target_kind public.content_kind;
begin
  target_id := case when tg_op = 'DELETE' then old.content_id else new.content_id end;
  select kind into target_kind from public.exercise_content where id = target_id;
  if target_kind in ('submission_original', 'published_version') then
    raise exception 'exercise content snapshot children are immutable';
  end if;
  if tg_op = 'UPDATE' and old.content_id is distinct from new.content_id then
    select kind into target_kind from public.exercise_content where id = old.content_id;
    if target_kind in ('submission_original', 'published_version') then
      raise exception 'exercise content snapshot children are immutable';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'exercise_biomechanics', 'exercise_aliases', 'exercise_muscles',
    'exercise_joints', 'exercise_joint_actions', 'exercise_equipment',
    'exercise_attachments', 'exercise_movement_patterns',
    'exercise_scenes', 'exercise_media'
  ] loop
    execute format(
      'create trigger immutable_content_children before insert or update or delete on public.%I for each row execute function private.protect_content_children()',
      table_name
    );
  end loop;
end;
$$;

create or replace function private.enforce_publication_ready()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'published' then
    return new;
  end if;
  if not exists (
    select 1 from public.exercise_content c
    where c.id = new.current_content_id and c.kind = 'published_version'
  ) then
    raise exception 'published exercise must point to a published content version';
  end if;
  if not exists (
    select 1 from public.exercise_versions v
    where v.exercise_id = new.id and v.content_id = new.current_content_id
  ) then
    raise exception 'published exercise must have an immutable version';
  end if;
  if not exists (
    select 1 from public.exercise_media m
    where m.content_id = new.current_content_id and m.kind in ('webm', 'mp4')
  ) then
    raise exception 'published exercise must have a character demonstration';
  end if;
  return new;
end;
$$;

create constraint trigger publication_ready
after insert or update on public.exercises
deferrable initially deferred
for each row execute function private.enforce_publication_ready();

create or replace function private.protect_submission_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id
     or new.original_content_id is distinct from old.original_content_id then
    raise exception 'submission owner and original snapshot cannot change';
  end if;
  return new;
end;
$$;

create trigger immutable_submission_identity
before update on public.exercise_submissions
for each row execute function private.protect_submission_identity();
