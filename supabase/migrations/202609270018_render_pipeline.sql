insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('exercise-private', 'exercise-private', false, 52428800,
    array['video/webm', 'video/mp4', 'image/webp']),
  ('exercise-public', 'exercise-public', true, 52428800,
    array['video/webm', 'video/mp4', 'image/webp'])
on conflict (id) do nothing;


create policy private_exercise_media_read on storage.objects
for select to authenticated using (
  bucket_id = 'exercise-private'
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
  and exists (
    select 1 from public.exercise_submissions submission
    where submission.id = ((storage.foldername(name))[1])::uuid
      and (submission.owner_id = (select auth.uid()) or (select private.is_reviewer()))
  )
);

drop trigger immutable_content_children on public.exercise_media;
create function private.protect_exercise_media_snapshot()
returns trigger language plpgsql set search_path = '' as $$
declare target_kind public.content_kind;
begin
  select kind into target_kind from public.exercise_content
  where id = case when tg_op = 'DELETE' then old.content_id else new.content_id end;
  if target_kind = 'submission_original' and tg_op = 'INSERT'
    and new.storage_bucket = 'exercise-private'
    and new.kind in ('webm', 'mp4', 'poster')
    and exists (select 1 from public.exercise_scenes scene
      where scene.id = new.scene_id and scene.content_id = new.content_id) then
    return new;
  end if;
  if target_kind in ('submission_original', 'published_version') then
    raise exception 'exercise media snapshot is immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger immutable_exercise_media_snapshot
before insert or update or delete on public.exercise_media
for each row execute function private.protect_exercise_media_snapshot();

create function public.claim_render_job()
returns table (
  job_id uuid, scene_id uuid, content_id uuid,
  submission_id uuid, duration_ms integer, camera_angle public.camera_angle
)
language plpgsql volatile security definer set search_path = '' as $$
declare claimed_job public.render_jobs%rowtype;
begin
  update public.render_jobs set status = 'queued', queued_at = now(),
    error_code = 'worker_timeout'
  where status = 'running' and started_at < now() - interval '10 minutes'
    and attempt_count < 3;
  update public.render_jobs set status = 'failed', completed_at = now(),
    error_code = 'worker_timeout'
  where status = 'running' and started_at < now() - interval '10 minutes'
    and attempt_count >= 3;

  select * into claimed_job from public.render_jobs job
  where job.status = 'queued' and job.queued_at <= now()
  order by job.queued_at, job.id
  for update skip locked limit 1;
  if claimed_job.id is null then return; end if;
  update public.render_jobs set status = 'running', started_at = now(),
    attempt_count = attempt_count + 1, error_code = null
  where id = claimed_job.id;
  return query
  select claimed_job.id, scene.id, scene.content_id, submission.id,
    scene.duration_ms, scene.default_camera_angle
  from public.exercise_scenes scene
  join public.exercise_submissions submission
    on submission.original_content_id = scene.content_id
  where scene.id = claimed_job.scene_id;
end;
$$;
revoke all on function public.claim_render_job() from public, anon, authenticated;
grant execute on function public.claim_render_job() to service_role;

create function public.read_render_scene(p_job_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'durationMs', scene.duration_ms,
    'cameraAngle', scene.default_camera_angle,
    'rigVersion', rig.version,
    'equipment', (
      select jsonb_build_object(
        'slug', asset.slug, 'x', placed.position_x, 'y', placed.position_y,
        'z', placed.position_z, 'scale', placed.scale
      ) from public.scene_equipment placed
      join public.equipment_assets asset on asset.id = placed.asset_id
      where placed.scene_id = scene.id order by placed.id limit 1
    ),
    'keyframes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'timeMs', frame.position_ms,
        'poses', coalesce((
          select jsonb_agg(jsonb_build_object(
            'slug', rig_joint.slug, 'x', pose.rotation_x,
            'y', pose.rotation_y, 'z', pose.rotation_z, 'w', pose.rotation_w
          ) order by rig_joint.slug)
          from public.motion_joint_poses pose
          join public.rig_joints rig_joint on rig_joint.id = pose.rig_joint_id
          where pose.keyframe_id = frame.id
        ), '[]'::jsonb)
      ) order by frame.position_ms)
      from public.motion_keyframes frame where frame.scene_id = scene.id
    ), '[]'::jsonb)
  )
  from public.render_jobs job
  join public.exercise_scenes scene on scene.id = job.scene_id
  join public.rigs rig on rig.id = scene.rig_id
  where job.id = p_job_id and job.status = 'running';
$$;
revoke all on function public.read_render_scene(uuid) from public, anon, authenticated;
grant execute on function public.read_render_scene(uuid) to service_role;

create function public.complete_render_job(
  p_job_id uuid, p_asset_group_id uuid,
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
  if target_job.id is null or target_job.status <> 'running' then
    raise exception 'render job is not running';
  end if;
  select scene.content_id, submission.id, scene.default_camera_angle
  into target_content_id, target_submission_id, target_camera
  from public.exercise_scenes scene
  join public.exercise_submissions submission
    on submission.original_content_id = scene.content_id
  where scene.id = target_job.scene_id;
  if target_submission_id is null then raise exception 'render job has no submission'; end if;
  if p_webm_path <> target_submission_id::text || '/' || p_job_id::text || '/demo.webm'
    or p_mp4_path <> target_submission_id::text || '/' || p_job_id::text || '/demo.mp4'
    or p_poster_path <> target_submission_id::text || '/' || p_job_id::text || '/poster.webp' then
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
revoke all on function public.complete_render_job(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.complete_render_job(uuid, uuid, text, text, text) to service_role;

create function public.fail_render_job(p_job_id uuid, p_error_code text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare attempt integer;
begin
  select attempt_count into attempt from public.render_jobs
  where id = p_job_id and status = 'running' for update;
  if attempt is null then raise exception 'render job is not running'; end if;
  if p_error_code !~ '^[a-z][a-z0-9_]{1,50}$' then raise exception 'invalid error code'; end if;
  update public.render_jobs set
    status = case when attempt >= 3 then 'failed'::public.render_status
      else 'queued'::public.render_status end,
    queued_at = case when attempt >= 3 then queued_at
      else now() + attempt * interval '30 seconds' end,
    completed_at = case when attempt >= 3 then now() else null end,
    error_code = p_error_code
  where id = p_job_id;
end;
$$;
revoke all on function public.fail_render_job(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_render_job(uuid, text) to service_role;
