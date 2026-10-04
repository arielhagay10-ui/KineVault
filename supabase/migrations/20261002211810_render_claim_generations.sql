-- Pause old workers before deployment; restart them with claim-aware RPC arguments.
-- Previously running attempts cannot complete without their new claim identifier.
alter table public.render_jobs add column claim_id uuid;

drop function public.claim_render_job();
drop function public.complete_render_job(uuid, uuid, text, text, text);
drop function public.fail_render_job(uuid, text);

create function public.claim_render_job()
returns table (
  job_id uuid, scene_id uuid, content_id uuid,
  submission_id uuid, duration_ms integer, camera_angle public.camera_angle, claim_id uuid
)
language plpgsql volatile security definer set search_path = '' as $$
declare claimed_job public.render_jobs%rowtype;
begin
  update public.render_jobs set status = 'queued', queued_at = clock_timestamp(),
    error_code = 'worker_timeout', claim_id = null
  where status = 'running' and started_at < clock_timestamp() - interval '10 minutes'
    and attempt_count < 3;
  update public.render_jobs set status = 'failed', completed_at = clock_timestamp(),
    error_code = 'worker_timeout', claim_id = null
  where status = 'running' and started_at < clock_timestamp() - interval '10 minutes'
    and attempt_count >= 3;

  select * into claimed_job from public.render_jobs job
  where job.status = 'queued' and job.queued_at <= clock_timestamp()
  order by job.queued_at, job.id
  for update skip locked limit 1;
  if claimed_job.id is null then return; end if;
  update public.render_jobs set status = 'running', started_at = clock_timestamp(),
    attempt_count = attempt_count + 1, error_code = null, claim_id = gen_random_uuid(), completed_at = null
  where id = claimed_job.id returning * into claimed_job;
  return query
  select claimed_job.id, scene.id, scene.content_id, submission.id,
    scene.duration_ms, scene.default_camera_angle, claimed_job.claim_id
  from public.exercise_scenes scene
  join public.exercise_submissions submission
    on submission.original_content_id = scene.content_id
  where scene.id = claimed_job.scene_id;
end;
$$;
revoke all on function public.claim_render_job() from public, anon, authenticated;
grant execute on function public.claim_render_job() to service_role;

create function public.complete_render_job(
  p_job_id uuid, p_claim_id uuid, p_asset_group_id uuid,
  p_webm_path text, p_mp4_path text, p_poster_path text
)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare target_job public.render_jobs%rowtype;
declare target_content_id uuid;
declare target_submission_id uuid;
declare target_camera public.camera_angle;
declare created_media_id uuid;
begin
  select * into target_job from public.render_jobs where id = p_job_id for update;
  if target_job.id is null or target_job.status <> 'running'
    or p_claim_id is null or target_job.claim_id is distinct from p_claim_id
    or target_job.started_at is null
    or target_job.started_at <= clock_timestamp() - interval '10 minutes' then
    raise exception 'render claim is expired or no longer current';
  end if;
  select scene.content_id, submission.id, scene.default_camera_angle
  into target_content_id, target_submission_id, target_camera
  from public.exercise_scenes scene
  join public.exercise_submissions submission
    on submission.original_content_id = scene.content_id
  where scene.id = target_job.scene_id;
  if target_submission_id is null then raise exception 'render job has no submission'; end if;
  if p_webm_path is distinct from target_submission_id::text || '/' || p_job_id::text || '/' || p_claim_id::text || '/demo.webm'
    or p_mp4_path is distinct from target_submission_id::text || '/' || p_job_id::text || '/' || p_claim_id::text || '/demo.mp4'
    or p_poster_path is distinct from target_submission_id::text || '/' || p_job_id::text || '/' || p_claim_id::text || '/poster.webp' then
    raise exception 'render paths do not match the job';
  end if;
  if not exists (select 1 from storage.objects
    where bucket_id = 'exercise-private' and name = p_webm_path)
    or not exists (select 1 from storage.objects
      where bucket_id = 'exercise-private' and name = p_mp4_path)
    or not exists (select 1 from storage.objects
      where bucket_id = 'exercise-private' and name = p_poster_path) then
    raise exception 'render outputs are missing from private storage';
  end if;
  for created_media_id in
    insert into public.exercise_media (
      content_id, scene_id, asset_group_id, kind, storage_bucket,
      storage_path, camera_angle, license_name, source_credit
    ) values
      (target_content_id, target_job.scene_id, p_asset_group_id, 'webm',
       'exercise-private', p_webm_path, target_camera, 'KineVault original render', null),
      (target_content_id, target_job.scene_id, p_asset_group_id, 'mp4',
       'exercise-private', p_mp4_path, target_camera, 'KineVault original render', null),
      (target_content_id, target_job.scene_id, p_asset_group_id, 'poster',
       'exercise-private', p_poster_path, target_camera, 'KineVault original render', null)
    returning id
  loop
    insert into public.submission_media (submission_id, media_id)
    values (target_submission_id, created_media_id);
  end loop;
  update public.render_jobs set status = 'succeeded', completed_at = now()
  where id = p_job_id;
end;
$$;
revoke all on function public.complete_render_job(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.complete_render_job(uuid, uuid, uuid, text, text, text) to service_role;

create function public.fail_render_job(p_job_id uuid, p_claim_id uuid, p_error_code text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare attempt integer;
begin
  select attempt_count into attempt from public.render_jobs
  where id = p_job_id and status = 'running' and claim_id = p_claim_id
    and started_at > clock_timestamp() - interval '10 minutes' for update;
  if attempt is null then raise exception 'render claim is expired or no longer current'; end if;
  if p_error_code !~ '^[a-z][a-z0-9_]{1,50}$' then raise exception 'invalid error code'; end if;
  update public.render_jobs set
    status = case when attempt >= 3 then 'failed'::public.render_status
      else 'queued'::public.render_status end,
    queued_at = case when attempt >= 3 then queued_at
      else now() + attempt * interval '30 seconds' end,
    completed_at = case when attempt >= 3 then now() else null end,
    error_code = p_error_code, claim_id = null
  where id = p_job_id;
end;
$$;
revoke all on function public.fail_render_job(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.fail_render_job(uuid, uuid, text) to service_role;
