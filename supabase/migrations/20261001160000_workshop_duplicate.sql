-- Reuse the complete content clone, keeping its privileged implementation private.
create function public.duplicate_private_exercise(p_private_id uuid)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  source public.private_exercises%rowtype;
  target_content_id uuid;
  target_private_id uuid := gen_random_uuid();
begin
  if actor is null then raise exception 'authentication required'; end if;
  select * into source from public.private_exercises
    where id = p_private_id and owner_id = actor for update;
  if not found then raise exception 'private exercise not found'; end if;
  target_content_id := private.clone_exercise_content(source.content_id,'private_draft',actor);
  update public.exercise_content set name = left(name,153) || ' (copy)', created_by = actor
    where id = target_content_id;
  -- A template starts independently; never reuse candidate identity or share links.
  insert into public.private_exercises(id,owner_id,content_id,copied_from_exercise_id)
    values(target_private_id,actor,target_content_id,source.copied_from_exercise_id);
  return target_private_id;
end;
$$;
revoke all on function public.duplicate_private_exercise(uuid) from public,anon;
grant execute on function public.duplicate_private_exercise(uuid) to authenticated;
