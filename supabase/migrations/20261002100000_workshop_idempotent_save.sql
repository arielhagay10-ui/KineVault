-- Client-generated UUIDs survive lost responses. Existing drafts still use the
-- owner-checked scene and metadata commands; no classifications are reset.
drop function public.save_workshop_draft(jsonb,text,uuid);
create function public.save_workshop_draft(
  p_scene jsonb, p_name text, p_private_id uuid default null,
  p_create_if_missing boolean default false
)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare
  actor uuid := auth.uid();
  draft_id uuid := p_private_id;
  target_content_id uuid;
begin
  if actor is null then raise exception 'authentication required'; end if;
  if p_name is null or length(btrim(p_name)) not between 2 and 160 then
    raise exception 'exercise name must contain 2 to 160 characters';
  end if;
  if draft_id is null then
    draft_id := public.create_workshop_exercise(p_scene);
  else
    -- Serialize retries for the same identity, including simultaneous first requests.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(draft_id::text, 0));
    select pe.content_id into target_content_id from public.private_exercises pe
      where pe.id = draft_id and pe.owner_id = actor for update;
    if target_content_id is null and p_create_if_missing then
      target_content_id := gen_random_uuid();
      insert into public.exercise_content (id,kind,owner_id,name,created_by)
        values (target_content_id,'private_draft',actor,btrim(p_name),actor);
      -- RLS and the primary key reject a UUID belonging to any other owner.
      insert into public.private_exercises (id,owner_id,content_id)
        values (draft_id,actor,target_content_id);
      insert into public.exercise_biomechanics (content_id,resistance_profile)
        values (target_content_id,'unknown');
    end if;
    perform public.save_private_scene(draft_id, p_scene);
  end if;
  perform public.save_private_metadata(jsonb_build_object('name',btrim(p_name)),draft_id);
  return draft_id;
end;
$$;
revoke all on function public.save_workshop_draft(jsonb,text,uuid,boolean) from public,anon;
grant execute on function public.save_workshop_draft(jsonb,text,uuid,boolean) to authenticated;
