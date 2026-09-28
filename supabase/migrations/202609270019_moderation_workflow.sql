alter table public.exercise_submissions
  add column assigned_reviewer_id uuid references auth.users(id) on delete set null;
create index exercise_submissions_reviewer_queue_idx
  on public.exercise_submissions (assigned_reviewer_id, status, submitted_at)
  where status in ('submitted', 'in_review', 'changes_requested');

create table public.moderation_field_changes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.moderation_events(id) on delete restrict,
  field_name text not null check (field_name in (
    'name', 'description', 'family', 'muscles', 'joints', 'joint_actions',
    'equipment', 'resistance_profile', 'body_position', 'movement_patterns',
    'attachments', 'media', 'relationship', 'grip', 'stance', 'plane',
    'resistance_source', 'peak_resistance_position', 'classification_confidence',
    'reviewer_notes', 'difficulty', 'exercise_type', 'mechanic', 'force_type',
    'laterality', 'setup_instructions', 'execution_instructions', 'form_cues',
    'common_mistakes', 'safety_notes', 'range_of_motion_notes'
  )),
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);
create index moderation_field_changes_event_idx on public.moderation_field_changes (event_id);
create trigger immutable_moderation_field_changes
before update or delete on public.moderation_field_changes
for each row execute function private.reject_audit_mutation();
alter table public.moderation_field_changes enable row level security;
revoke all on public.moderation_field_changes from anon, authenticated;
grant select on public.moderation_field_changes to authenticated;
create policy moderation_field_changes_read on public.moderation_field_changes
for select to authenticated using (
  exists (select 1 from public.moderation_events event
    where event.id = event_id and (select private.can_read_submission(event.submission_id)))
);

create function private.assert_submission_reviewer(p_submission_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
declare assigned uuid;
begin
  if auth.uid() is null or not (select private.is_reviewer()) then
    raise exception 'reviewer role required';
  end if;
  select assigned_reviewer_id into assigned from public.exercise_submissions
  where id = p_submission_id;
  if not found then raise exception 'submission not found'; end if;
  if assigned is not null and assigned <> auth.uid()
    and not (select private.is_admin()) then
    raise exception 'submission assigned to another reviewer';
  end if;
end;
$$;
revoke all on function private.assert_submission_reviewer(uuid) from public, anon, authenticated;

create function public.begin_submission_review(p_submission_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare target public.exercise_submissions%rowtype;
begin
  perform private.assert_submission_reviewer(p_submission_id);
  select * into target from public.exercise_submissions
  where id = p_submission_id for update;
  if target.status <> 'submitted' then raise exception 'submission is not awaiting review'; end if;
  if target.editorial_content_id is null then
    target.editorial_content_id := private.clone_exercise_content(
      target.original_content_id, 'submission_editorial', null);
  end if;
  update public.exercise_submissions set status = 'in_review',
    assigned_reviewer_id = auth.uid(),
    editorial_content_id = target.editorial_content_id, updated_at = now()
  where id = p_submission_id;
  insert into public.moderation_events (
    submission_id, actor_id, action, from_status, to_status
  ) values (p_submission_id, auth.uid(), 'begin_review', 'submitted', 'in_review');
end;
$$;
revoke all on function public.begin_submission_review(uuid) from public;
grant execute on function public.begin_submission_review(uuid) to authenticated;

create function public.request_submission_changes(
  p_submission_id uuid, p_reason public.moderation_reason, p_comment text
)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare previous public.submission_status;
begin
  perform private.assert_submission_reviewer(p_submission_id);
  select status into previous from public.exercise_submissions
  where id = p_submission_id for update;
  if previous <> 'in_review' then raise exception 'submission must be in review'; end if;
  if p_reason is null or length(btrim(coalesce(p_comment, ''))) < 5
    or length(p_comment) > 2000 then raise exception 'a reason and useful comment are required'; end if;
  update public.exercise_submissions set status = 'changes_requested', updated_at = now()
  where id = p_submission_id;
  insert into public.moderation_reviews (submission_id, reviewer_id, action, reason, comment)
  values (p_submission_id, auth.uid(), 'request_changes', p_reason, btrim(p_comment));
  insert into public.moderation_events (
    submission_id, actor_id, action, from_status, to_status, reason, comment
  ) values (p_submission_id, auth.uid(), 'request_changes', previous,
    'changes_requested', p_reason, btrim(p_comment));
end;
$$;
revoke all on function public.request_submission_changes(uuid, public.moderation_reason, text) from public;
grant execute on function public.request_submission_changes(uuid, public.moderation_reason, text) to authenticated;

create function public.reject_submission(
  p_submission_id uuid, p_reason public.moderation_reason, p_comment text
)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare previous public.submission_status;
begin
  perform private.assert_submission_reviewer(p_submission_id);
  select status into previous from public.exercise_submissions
  where id = p_submission_id for update;
  if previous <> 'in_review' then raise exception 'submission must be in review'; end if;
  if p_reason is null or length(btrim(coalesce(p_comment, ''))) < 5
    or length(p_comment) > 2000 then raise exception 'a reason and useful comment are required'; end if;
  update public.exercise_submissions set status = 'rejected', updated_at = now()
  where id = p_submission_id;
  insert into public.moderation_reviews (submission_id, reviewer_id, action, reason, comment)
  values (p_submission_id, auth.uid(), 'reject', p_reason, btrim(p_comment));
  insert into public.moderation_events (
    submission_id, actor_id, action, from_status, to_status, reason, comment
  ) values (p_submission_id, auth.uid(), 'reject', previous,
    'rejected', p_reason, btrim(p_comment));
end;
$$;
revoke all on function public.reject_submission(uuid, public.moderation_reason, text) from public;
grant execute on function public.reject_submission(uuid, public.moderation_reason, text) to authenticated;
