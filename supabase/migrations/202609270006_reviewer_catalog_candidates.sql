create or replace function private.can_read_content(target_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.exercise_content
    where id = target_id and kind = 'private_draft' and owner_id = (select auth.uid())
  ) or exists (
    select 1 from public.exercises
    where current_content_id = target_id and status = 'published'
  ) or (
    (select private.is_reviewer()) and exists (
      select 1 from public.exercises where current_content_id = target_id
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
