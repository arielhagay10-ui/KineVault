create or replace function private.enforce_publication_ready()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Counter updates do not change publication readiness. At deferred commit,
  -- contributors cannot read the reviewer-only immutable version history.
  if tg_op = 'UPDATE'
     and new.status is not distinct from old.status
     and new.current_content_id is not distinct from old.current_content_id then
    return new;
  end if;
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
