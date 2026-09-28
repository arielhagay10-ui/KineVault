-- Published versions may share one immutable Storage object. The object path is
-- unique within a rendered asset group, while each content version keeps its own metadata.
alter table public.exercise_media drop constraint exercise_media_storage_bucket_storage_path_key;
create index exercise_media_storage_object_idx on public.exercise_media(storage_bucket,storage_path);
alter table public.exercise_scenes add column motion_source_submission_id uuid
  references public.exercise_submissions(id) on delete restrict;

create function public.approve_submission(
  p_submission_id uuid, p_slug text, p_relation text default 'new',
  p_related_exercise_id uuid default null, p_comment text default null
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  submission public.exercise_submissions%rowtype;
  published_id uuid := gen_random_uuid();
  target_content_id uuid;
  target_scene_id uuid;
  item record;
  extension text;
  object_path text;
begin
  perform private.assert_submission_reviewer(p_submission_id);
  select * into submission from public.exercise_submissions where id = p_submission_id for update;
  if submission.status <> 'in_review' or submission.editorial_content_id is null then
    raise exception 'submission must be in review';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug) > 120 then
    raise exception 'invalid public slug';
  end if;
  if p_relation not in ('new','variation') or
    (p_relation = 'new' and p_related_exercise_id is not null) or
    (p_relation = 'variation' and p_related_exercise_id is null) then
    raise exception 'invalid publication relationship';
  end if;
  if p_related_exercise_id is not null and not exists (
    select 1 from public.exercises where id = p_related_exercise_id and status = 'published'
  ) then raise exception 'related exercise is not published'; end if;
  if length(coalesce(p_comment,'')) > 2000 then raise exception 'review comment is too long'; end if;
  if not exists (select 1 from public.exercise_content where id = submission.editorial_content_id and family_id is not null)
    or not exists (select 1 from public.exercise_muscles where content_id = submission.editorial_content_id and role = 'primary')
    or not exists (select 1 from public.exercise_joint_actions where content_id = submission.editorial_content_id and role = 'primary') then
    raise exception 'family, primary muscle, and primary joint action are required';
  end if;
  if (select count(distinct kind) from public.exercise_media
    where content_id = submission.original_content_id and storage_bucket = 'exercise-private'
      and kind in ('webm','mp4','poster')) <> 3 then
    raise exception 'rendered demonstration is incomplete';
  end if;
  for item in select * from public.exercise_media
    where content_id = submission.original_content_id and storage_bucket = 'exercise-private'
      and kind in ('webm','mp4','poster') loop
    extension := case item.kind when 'poster' then 'webp' else item.kind::text end;
    object_path := 'submissions/' || p_submission_id::text || '/demo.' || extension;
    if not exists (select 1 from storage.objects where bucket_id = 'exercise-public' and name = object_path) then
      raise exception 'public media object missing: %', item.kind;
    end if;
  end loop;
  target_content_id := private.clone_exercise_content(submission.editorial_content_id,'submission_editorial',null);
  select scene.id into target_scene_id from public.exercise_scenes scene where scene.content_id = target_content_id;
  update public.exercise_scenes set motion_source_submission_id = p_submission_id where id = target_scene_id;
  for item in select * from public.exercise_media
    where content_id = submission.original_content_id and storage_bucket = 'exercise-private'
      and kind in ('webm','mp4','poster') loop
    extension := case item.kind when 'poster' then 'webp' else item.kind::text end;
    insert into public.exercise_media(content_id,scene_id,asset_group_id,kind,storage_bucket,
      storage_path,camera_angle,character_presentation,license_name,source_credit)
    values(target_content_id,target_scene_id,p_submission_id,item.kind,'exercise-public',
      'submissions/' || p_submission_id::text || '/demo.' || extension,
      item.camera_angle,item.character_presentation,item.license_name,item.source_credit);
  end loop;
  update public.exercise_content set kind = 'published_version' where id = target_content_id;
  insert into public.exercises(id,slug,current_content_id,status,created_by,reviewed_by,published_at)
  values(published_id,p_slug,target_content_id,'pending_media',submission.owner_id,auth.uid(),now());
  insert into public.exercise_versions(exercise_id,version_number,content_id,source_submission_id,approved_by)
  values(published_id,1,target_content_id,p_submission_id,auth.uid());
  if p_relation = 'variation' then
    insert into public.exercise_relations(source_exercise_id,target_exercise_id,relation_type)
    values(published_id,p_related_exercise_id,'variation_of');
  end if;
  update public.exercises set status = 'published' where id = published_id;
  update public.exercise_submissions set status = 'approved', related_exercise_id = p_related_exercise_id,
    duplicate_disposition = p_relation, updated_at = now() where id = p_submission_id;
  insert into public.moderation_reviews(submission_id,reviewer_id,action,comment)
  values(p_submission_id,auth.uid(),'approve',nullif(btrim(p_comment),''));
  insert into public.moderation_events(submission_id,actor_id,action,from_status,to_status,comment)
  values(p_submission_id,auth.uid(),'approve','in_review','approved',nullif(btrim(p_comment),''));
  return published_id;
end;
$$;
revoke all on function public.approve_submission(uuid,text,text,uuid,text) from public;
grant execute on function public.approve_submission(uuid,text,text,uuid,text) to authenticated;

create function public.merge_submission(
  p_submission_id uuid, p_exercise_id uuid, p_comment text
)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  submission public.exercise_submissions%rowtype;
  target public.exercises%rowtype;
  target_content_id uuid;
  target_scene_id uuid;
  item record;
  next_version integer;
  submitted_name text;
  normalized_name text;
  current_name text;
  group_id uuid := gen_random_uuid();
begin
  perform private.assert_submission_reviewer(p_submission_id);
  select * into submission from public.exercise_submissions where id = p_submission_id for update;
  if submission.status <> 'in_review' then raise exception 'submission must be in review'; end if;
  select * into target from public.exercises where id = p_exercise_id and status = 'published' for update;
  if not found then raise exception 'merge target is not published'; end if;
  if length(btrim(coalesce(p_comment,''))) < 5 or length(p_comment) > 2000 then
    raise exception 'a useful merge reason is required';
  end if;
  select name into submitted_name from public.exercise_content where id = submission.original_content_id;
  select name into current_name from public.exercise_content where id = target.current_content_id;
  normalized_name := lower(regexp_replace(btrim(submitted_name),'[^[:alnum:]]+',' ','g'));
  target_content_id := private.clone_exercise_content(target.current_content_id,'submission_editorial',null);
  select scene.id into target_scene_id from public.exercise_scenes scene where scene.content_id = target_content_id;
  update public.exercise_scenes set motion_source_submission_id = coalesce(
    (select original.motion_source_submission_id from public.exercise_scenes original where original.content_id = target.current_content_id),
    (select version.source_submission_id from public.exercise_versions version where version.content_id = target.current_content_id)
  ) where id = target_scene_id;
  if normalized_name <> lower(regexp_replace(btrim(current_name),'[^[:alnum:]]+',' ','g')) then
    insert into public.exercise_aliases(content_id,alias,normalized_alias)
    values(target_content_id,submitted_name,normalized_name)
    on conflict(content_id,normalized_alias) do nothing;
  end if;
  for item in select * from public.exercise_media where content_id = target.current_content_id loop
    insert into public.exercise_media(content_id,scene_id,asset_group_id,kind,storage_bucket,
      storage_path,camera_angle,character_presentation,license_name,source_credit)
    values(target_content_id,target_scene_id,group_id,item.kind,item.storage_bucket,item.storage_path,
      item.camera_angle,item.character_presentation,item.license_name,item.source_credit);
  end loop;
  update public.exercise_content set kind = 'published_version' where id = target_content_id;
  select coalesce(max(version_number),0)+1 into next_version from public.exercise_versions where exercise_id = p_exercise_id;
  insert into public.exercise_versions(exercise_id,version_number,content_id,source_submission_id,approved_by)
  values(p_exercise_id,next_version,target_content_id,p_submission_id,auth.uid());
  update public.exercises set current_content_id = target_content_id,reviewed_by = auth.uid(),updated_at = now()
  where id = p_exercise_id;
  update public.exercise_submissions set status = 'merged',merged_into_exercise_id = p_exercise_id,updated_at = now()
  where id = p_submission_id;
  insert into public.moderation_reviews(submission_id,reviewer_id,action,reason,comment)
  values(p_submission_id,auth.uid(),'merge','duplicate',btrim(p_comment));
  insert into public.moderation_events(submission_id,actor_id,action,from_status,to_status,reason,comment)
  values(p_submission_id,auth.uid(),'merge','in_review','merged','duplicate',btrim(p_comment));
end;
$$;
revoke all on function public.merge_submission(uuid,uuid,text) from public;
grant execute on function public.merge_submission(uuid,uuid,text) to authenticated;
