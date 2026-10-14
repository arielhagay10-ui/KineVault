-- Community publication freezes content immediately; verification is a separate decision.
alter table public.exercises add column verified_at timestamptz;
update public.exercises set verified_at = published_at where status = 'published';
revoke update (verified_at) on public.exercises from anon, authenticated;

create table public.exercise_publications (
  id uuid primary key default gen_random_uuid(),
  source_private_exercise_id uuid unique references public.private_exercises(id) on delete set null,
  exercise_id uuid not null unique references public.exercises(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index exercise_publications_owner_idx on public.exercise_publications(owner_id, created_at desc);
alter table public.exercise_publications enable row level security;
revoke all on public.exercise_publications from public, anon, authenticated;
grant select on public.exercise_publications to authenticated;
create policy publications_read on public.exercise_publications for select to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_reviewer()));

create table public.exercise_reports (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  reporter_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check (length(btrim(reason)) between 1 and 2000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete restrict,
  check ((status = 'open' and resolved_at is null and resolved_by is null)
    or (status = 'resolved' and resolved_at is not null and resolved_by is not null))
);
create unique index exercise_reports_open_idx on public.exercise_reports(reporter_id, exercise_id) where status = 'open';
create index exercise_reports_exercise_idx on public.exercise_reports(exercise_id, status, created_at);
create index exercise_reports_resolved_by_idx on public.exercise_reports(resolved_by) where resolved_by is not null;
alter table public.exercise_reports enable row level security;
revoke all on public.exercise_reports from public, anon, authenticated;
grant select on public.exercise_reports to authenticated;
create policy reports_read on public.exercise_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select private.is_reviewer()));

create table public.exercise_moderation_events (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('publish', 'verify', 'hide', 'restore', 'unverify', 'resolve_reports')),
  from_status public.publication_status,
  to_status public.publication_status not null,
  comment text check (length(comment) <= 2000),
  created_at timestamptz not null default now()
);
create index exercise_moderation_events_exercise_idx on public.exercise_moderation_events(exercise_id, created_at);
create index exercise_moderation_events_actor_idx on public.exercise_moderation_events(actor_id);
alter table public.exercise_moderation_events enable row level security;
revoke all on public.exercise_moderation_events from public, anon, authenticated;
grant select on public.exercise_moderation_events to authenticated;
create policy exercise_moderation_read on public.exercise_moderation_events for select to authenticated
  using ((select private.is_reviewer()));
create trigger immutable_exercise_moderation_events before update or delete on public.exercise_moderation_events
  for each row execute function private.reject_audit_mutation();

-- A legacy reviewed publication receives verification when its approved version goes live.
create function private.mark_reviewed_publication_verified()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published'
    and (tg_op = 'INSERT' or old.status = 'pending_media' or old.current_content_id is distinct from new.current_content_id)
    and exists (select 1 from public.exercise_versions v
      where v.exercise_id = new.id and v.content_id = new.current_content_id and v.approved_by is not null) then
    new.verified_at := coalesce(new.verified_at, new.published_at, now());
  end if;
  return new;
end;
$$;
revoke all on function private.mark_reviewed_publication_verified() from public, anon, authenticated;
create trigger mark_reviewed_publication_verified before insert or update of status, current_content_id on public.exercises
  for each row execute function private.mark_reviewed_publication_verified();

-- Deferred checks need version access even when the committing caller is a contributor.
create or replace function private.enforce_publication_ready()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status
    and new.current_content_id is not distinct from old.current_content_id then return new; end if;
  if new.status <> 'published' then return new; end if;
  if not exists (select 1 from public.exercise_content c
    where c.id = new.current_content_id and c.kind = 'published_version') then
    raise exception 'published exercise must point to a published content version';
  end if;
  if not exists (select 1 from public.exercise_versions v
    where v.exercise_id = new.id and v.content_id = new.current_content_id) then
    raise exception 'published exercise must have an immutable version';
  end if;
  if not exists (select 1 from public.exercise_publications p
      join public.exercise_versions v on v.exercise_id = p.exercise_id
      where p.exercise_id = new.id and v.content_id = new.current_content_id and v.approved_by is null)
    and not exists (select 1 from public.exercise_media m
      where m.content_id = new.current_content_id and m.kind in ('webm', 'mp4')) then
    raise exception 'published exercise must have a character demonstration';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_publication_ready() from public, anon, authenticated;

create function public.publish_private_exercise(p_private_id uuid)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  source public.private_exercises%rowtype;
  published_id uuid;
  snapshot_id uuid;
  exercise_name text;
  exercise_slug text;
begin
  if actor is null then raise exception 'authentication required'; end if;
  -- Serialize publication requests for a source, including concurrent retries.
  select * into source from public.private_exercises where id = p_private_id and owner_id = actor for update;
  if not found then raise exception 'private exercise not found'; end if;
  select exercise_id into published_id from public.exercise_publications where source_private_exercise_id = source.id;
  if found then return published_id; end if;
  -- Also prevent direct metadata updates while the snapshot is being cloned.
  select name into exercise_name from public.exercise_content
    where id = source.content_id and kind = 'private_draft' and owner_id = actor for update;
  if not found then raise exception 'private exercise not found'; end if;
  if length(btrim(exercise_name)) not between 2 and 160 or exercise_name !~ '[^[:space:]]'
    or lower(btrim(exercise_name)) = 'untitled exercise' then raise exception 'exercise name required'; end if;
  published_id := gen_random_uuid();
  exercise_slug := trim(both '-' from regexp_replace(lower(btrim(exercise_name)), '[^a-z0-9]+', '-', 'g'));
  exercise_slug := coalesce(nullif(exercise_slug, ''), 'exercise') || '-' || published_id::text;
  snapshot_id := private.clone_exercise_content(source.content_id, 'submission_editorial', null);
  -- The clone contains metadata and source motion only; private media paths are never copied.
  update public.exercise_content set kind = 'published_version' where id = snapshot_id;
  insert into public.exercises(id, slug, current_content_id, created_by, published_at)
    values (published_id, exercise_slug, snapshot_id, actor, now());
  insert into public.exercise_versions(exercise_id, version_number, content_id)
    values (published_id, 1, snapshot_id);
  insert into public.exercise_publications(source_private_exercise_id, exercise_id, owner_id)
    values (source.id, published_id, actor);
  update public.exercises set status = 'published' where id = published_id;
  insert into public.exercise_moderation_events(exercise_id, actor_id, action, to_status)
    values (published_id, actor, 'publish', 'published');
  return published_id;
end;
$$;
revoke all on function public.publish_private_exercise(uuid) from public, anon;
grant execute on function public.publish_private_exercise(uuid) to authenticated;

create function public.verify_community_exercise(p_exercise_id uuid, p_comment text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_reviewer() then raise exception 'reviewer role required'; end if;
  if length(p_comment) > 2000 then raise exception 'comment is too long'; end if;
  perform 1 from public.exercises where id = p_exercise_id and status = 'published' for update;
  if not found then raise exception 'exercise is not published'; end if;
  update public.exercises set verified_at = coalesce(verified_at, now()), reviewed_by = auth.uid(), updated_at = now()
    where id = p_exercise_id;
  insert into public.exercise_moderation_events(exercise_id, actor_id, action, from_status, to_status, comment)
    values (p_exercise_id, auth.uid(), 'verify', 'published', 'published', nullif(btrim(p_comment), ''));
end;
$$;
revoke all on function public.verify_community_exercise(uuid, text) from public, anon;
grant execute on function public.verify_community_exercise(uuid, text) to authenticated;

create function public.report_public_exercise(p_exercise_id uuid, p_reason text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare report_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 2000 or p_reason !~ '[^[:space:]]' then raise exception 'report reason required (1-2000 characters)'; end if;
  perform 1 from public.exercises where id = p_exercise_id and status = 'published' for share;
  if not found then raise exception 'exercise is not published'; end if;
  insert into public.exercise_reports(exercise_id, reporter_id, reason)
    values (p_exercise_id, auth.uid(), btrim(p_reason))
    on conflict (reporter_id, exercise_id) where status = 'open' do nothing
    returning id into report_id;
  if report_id is null then
    select id into report_id from public.exercise_reports
      where reporter_id = auth.uid() and exercise_id = p_exercise_id and status = 'open';
  end if;
  return report_id;
end;
$$;
revoke all on function public.report_public_exercise(uuid, text) from public, anon;
grant execute on function public.report_public_exercise(uuid, text) to authenticated;

create function public.moderate_public_exercise(p_exercise_id uuid, p_action text, p_comment text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare target public.exercises%rowtype;
begin
  if auth.uid() is null or not private.is_reviewer() then raise exception 'reviewer role required'; end if;
  if p_action is null or p_action not in ('hide', 'restore', 'unverify', 'resolve_reports') then raise exception 'invalid moderation action'; end if;
  if p_comment is null or length(btrim(p_comment)) not between 1 and 2000 or p_comment !~ '[^[:space:]]' then raise exception 'moderation comment required (1-2000 characters)'; end if;
  select * into target from public.exercises where id = p_exercise_id for update;
  if not found then raise exception 'exercise not found'; end if;
  if p_action = 'restore' then
    if target.status <> 'withdrawn'
      or not exists (select 1 from public.exercise_moderation_events where exercise_id = target.id and action = 'hide'
        and from_status = 'published' and to_status = 'withdrawn') then
      raise exception 'exercise is not hidden';
    end if;
    update public.exercises set status = 'published', updated_at = now() where id = target.id;
  elsif p_action = 'hide' then
    if target.status <> 'published' then raise exception 'exercise is not published'; end if;
    update public.exercises set status = 'withdrawn', updated_at = now() where id = target.id;
  elsif p_action = 'unverify' then
    if target.status not in ('published', 'withdrawn') then raise exception 'exercise is not published'; end if;
    update public.exercises set verified_at = null, reviewed_by = null, updated_at = now() where id = target.id;
  else
    update public.exercise_reports set status = 'resolved', resolved_at = now(), resolved_by = auth.uid()
      where exercise_id = target.id and status = 'open';
  end if;
  insert into public.exercise_moderation_events(exercise_id, actor_id, action, from_status, to_status, comment)
    select target.id, auth.uid(), p_action, target.status, status, btrim(p_comment) from public.exercises where id = target.id;
end;
$$;
revoke all on function public.moderate_public_exercise(uuid, text, text) from public, anon;
grant execute on function public.moderate_public_exercise(uuid, text, text) to authenticated;
