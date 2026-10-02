-- Save name and motion atomically through the existing owner-checked APIs.
create function public.save_workshop_draft(p_scene jsonb, p_name text, p_private_id uuid default null)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare draft_id uuid := p_private_id;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_name is null or length(btrim(p_name)) < 2 or length(btrim(p_name)) > 160 then
    raise exception 'exercise name must contain 2 to 160 characters';
  end if;
  if draft_id is null then
    draft_id := public.create_workshop_exercise(p_scene);
  else
    perform public.save_private_scene(draft_id, p_scene);
  end if;
  perform public.save_private_metadata(jsonb_build_object('name', btrim(p_name)), draft_id);
  return draft_id;
end;
$$;
revoke all on function public.save_workshop_draft(jsonb,text,uuid) from public,anon;
grant execute on function public.save_workshop_draft(jsonb,text,uuid) to authenticated;
