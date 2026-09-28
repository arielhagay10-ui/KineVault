-- Original seed candidates keep stable identities while following normal review.
alter table public.private_exercises add column catalog_candidate_id uuid references public.exercises(id) on delete restrict;
alter table public.exercise_submissions add column catalog_candidate_id uuid references public.exercises(id) on delete restrict;
create unique index private_candidate_owner_idx on public.private_exercises(owner_id,catalog_candidate_id) where catalog_candidate_id is not null;
create index submissions_catalog_candidate_idx on public.exercise_submissions(catalog_candidate_id) where catalog_candidate_id is not null;

create function private.protect_candidate_source()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'private_exercises' then
    if tg_op = 'UPDATE' then
      if new.catalog_candidate_id is distinct from old.catalog_candidate_id then raise exception 'candidate source is immutable'; end if;
      return new;
    end if;
    if new.catalog_candidate_id is not null then
      if not private.is_reviewer() then raise exception 'reviewer role required'; end if;
      if not exists(select 1 from public.exercises where id = new.catalog_candidate_id and status = 'pending_media' and created_by is null)
        then raise exception 'unpublished original candidate required'; end if;
    end if;
  else
    if tg_op = 'UPDATE' then
      if new.catalog_candidate_id is distinct from old.catalog_candidate_id then raise exception 'candidate source is immutable'; end if;
    else
      select p.catalog_candidate_id into new.catalog_candidate_id from public.private_exercises p
      where p.id = new.source_private_exercise_id and p.owner_id = new.owner_id;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.protect_candidate_source() from public,anon,authenticated;
create trigger private_candidate_source before insert or update on public.private_exercises for each row execute function private.protect_candidate_source();
create trigger submission_candidate_source before insert or update on public.exercise_submissions for each row execute function private.protect_candidate_source();

create function public.prepare_catalog_candidate(p_exercise_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target public.exercises%rowtype; draft_id uuid; content_id uuid;
begin
  if not private.is_reviewer() then raise exception 'reviewer role required'; end if;
  select * into target from public.exercises where id = p_exercise_id for update;
  if target.id is null or target.status <> 'pending_media' or target.created_by is not null then
    raise exception 'unpublished original candidate required';
  end if;
  select id into draft_id from public.private_exercises where catalog_candidate_id = target.id and owner_id = auth.uid();
  if draft_id is not null then return draft_id; end if;
  content_id := private.clone_exercise_content(target.current_content_id,'private_draft',auth.uid());
  insert into public.private_exercises(owner_id,content_id,copied_from_exercise_id,catalog_candidate_id)
  values(auth.uid(),content_id,target.id,target.id) returning id into draft_id;
  return draft_id;
end;
$$;
revoke all on function public.prepare_catalog_candidate(uuid) from public;
grant execute on function public.prepare_catalog_candidate(uuid) to authenticated;

drop function public.approve_submission(uuid,text,text,uuid,text);
create function public.approve_submission(
  p_submission_id uuid, p_slug text, p_relation text default 'new',
  p_related_exercise_id uuid default null, p_comment text default null, p_candidate_exercise_id uuid default null
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  submission public.exercise_submissions%rowtype;
  published_id uuid := gen_random_uuid();
  target_content_id uuid;
  target_scene_id uuid;
  candidate public.exercises%rowtype;
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
  if p_candidate_exercise_id is not null then
    if submission.catalog_candidate_id is distinct from p_candidate_exercise_id then raise exception 'candidate does not match submission source'; end if;
    select * into candidate from public.exercises where id = p_candidate_exercise_id for update;
    if candidate.status is distinct from 'pending_media' or candidate.created_by is not null
      or exists(select 1 from public.exercise_versions where exercise_id = candidate.id) then
      raise exception 'catalog candidate is already published or unavailable';
    end if;
    if candidate.slug <> p_slug then raise exception 'catalog candidate must keep its stable slug'; end if;
    published_id := candidate.id;
  end if;
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
  if p_candidate_exercise_id is null then
    insert into public.exercises(id,slug,current_content_id,status,created_by,reviewed_by,published_at)
    values(published_id,p_slug,target_content_id,'pending_media',submission.owner_id,auth.uid(),now());
  else
    update public.exercises set current_content_id = target_content_id,created_by = submission.owner_id,
      reviewed_by = auth.uid(),published_at = now(),updated_at = now() where id = published_id;
  end if;
  insert into public.exercise_versions(exercise_id,version_number,content_id,source_submission_id,approved_by)
  values(published_id,1,target_content_id,p_submission_id,auth.uid());
  if p_relation = 'variation' then
    insert into public.exercise_relations(source_exercise_id,target_exercise_id,relation_type)
    values(published_id,p_related_exercise_id,'variation_of') on conflict(source_exercise_id,target_exercise_id,relation_type) do nothing;
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
revoke all on function public.approve_submission(uuid,text,text,uuid,text,uuid) from public;
grant execute on function public.approve_submission(uuid,text,text,uuid,text,uuid) to authenticated;
