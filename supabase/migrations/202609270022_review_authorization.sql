create or replace function private.can_read_content(target_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.exercise_content
    where id = target_id and kind = 'private_draft' and owner_id = (select auth.uid())
  ) or exists (
    select 1 from public.exercises
    where current_content_id = target_id and status = 'published'
  ) or (
    (select private.is_reviewer()) and (
      exists (select 1 from public.exercises where current_content_id = target_id)
      or exists (select 1 from public.exercise_versions where content_id = target_id)
    )
  ) or exists (
    select 1 from public.private_exercises
    where content_id = target_id and owner_id = (select auth.uid())
  ) or exists (
    select 1 from public.exercise_submissions
    where owner_id = (select auth.uid())
      and (original_content_id = target_id or editorial_content_id = target_id)
  ) or (
    (select private.is_reviewer()) and exists (
      select 1 from public.exercise_submissions
      where original_content_id = target_id or editorial_content_id = target_id
    )
  );
$$;

-- Reviewer mutations must pass through role-checked, audited RPCs.
create or replace function private.can_edit_content(target_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.exercise_content
    where id = target_id and kind = 'private_draft' and owner_id = (select auth.uid())
  );
$$;
alter policy content_update on public.exercise_content
  using ((select private.can_edit_content(id)))
  with check (kind = 'private_draft' and owner_id = (select auth.uid()));

create function public.retry_submission_render(p_submission_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare target_job public.render_jobs%rowtype;
begin
  perform private.assert_submission_reviewer(p_submission_id);
  select job.* into target_job from public.render_jobs job
    join public.exercise_scenes scene on scene.id = job.scene_id
    join public.exercise_submissions submission on submission.original_content_id = scene.content_id
  where submission.id = p_submission_id and submission.status in ('submitted','in_review')
  order by job.queued_at desc limit 1 for update of job;
  if not found or target_job.status <> 'failed' then raise exception 'render job is not failed'; end if;
  update public.render_jobs set status = 'queued',attempt_count = 0,error_code = null,
    started_at = null,completed_at = null,queued_at = now() where id = target_job.id;
  insert into public.moderation_events(submission_id,actor_id,action,from_status,to_status,comment)
  select id,auth.uid(),'edit',status,status,'Retry failed demonstration render.'
  from public.exercise_submissions where id = p_submission_id;
end;
$$;
revoke all on function public.retry_submission_render(uuid) from public;
grant execute on function public.retry_submission_render(uuid) to authenticated;
