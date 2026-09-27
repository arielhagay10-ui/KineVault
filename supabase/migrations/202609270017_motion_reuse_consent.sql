alter function public.copy_public_exercise(uuid) rename to copy_public_exercise_unchecked;
alter function public.copy_public_exercise_unchecked(uuid) set schema private;
revoke all on function private.copy_public_exercise_unchecked(uuid) from public, anon, authenticated;

create function public.copy_public_exercise(p_exercise_id uuid)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  source_content_id uuid;
  source_submission_id uuid;
  may_copy_motion boolean;
  copied_private_id uuid;
  copied_content_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select current_content_id into source_content_id
  from public.exercises where id = p_exercise_id and status = 'published';
  if source_content_id is null then raise exception 'published exercise not found'; end if;
  select version.source_submission_id into source_submission_id
  from public.exercise_versions version where version.content_id = source_content_id;
  may_copy_motion := source_submission_id is null or exists (
    select 1 from public.exercise_submissions
    where id = source_submission_id and allow_motion_reuse
  );
  copied_private_id := private.copy_public_exercise_unchecked(p_exercise_id);
  if not may_copy_motion then
    select content_id into copied_content_id from public.private_exercises
    where id = copied_private_id and owner_id = auth.uid();
    delete from public.exercise_scenes where content_id = copied_content_id;
  end if;
  return copied_private_id;
end;
$$;

revoke all on function public.copy_public_exercise(uuid) from public;
grant execute on function public.copy_public_exercise(uuid) to authenticated;
