create or replace function private.valid_studio_layout(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; frame jsonb; ids text[] := array[]::text[]; hands text[] := array[]::text[];
  object_id text; hand text; previous_time integer; frame_time numeric;
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) is distinct from 'object' then return false; end if;
  if value - array['body','objects'] <> '{}'::jsonb or not private.valid_studio_transform(value->'body') then return false; end if;
  if (value->'body') - array['x','y','z','rotationX','rotationY','rotationZ','scale'] <> '{}'::jsonb then return false; end if;
  if jsonb_typeof(value->'objects') is distinct from 'array' then return false; end if;
  if jsonb_array_length(value->'objects') > 20 then return false; end if;
  for item in select * from jsonb_array_elements(value->'objects') loop
    if not private.valid_studio_transform(item) then return false; end if;
    if item - array['x','y','z','rotationX','rotationY','rotationZ','scale','id','name','slug','attachment','pulleyHeight','frames'] <> '{}'::jsonb then return false; end if;
    if jsonb_typeof(item->'id') is distinct from 'string' or jsonb_typeof(item->'name') is distinct from 'string'
      or jsonb_typeof(item->'slug') is distinct from 'string' or jsonb_typeof(item->'attachment') is distinct from 'string' then return false; end if;
    object_id := item->>'id';
    if object_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or lower(object_id) = any(ids) then return false; end if;
    ids := array_append(ids,lower(object_id));
    if length(btrim(item->>'name')) not between 1 and 60 then return false; end if;
    if item->>'slug' not in ('cable-machine','bench','squat-rack','barbell','dumbbell')
      or item->>'attachment' not in ('none','left','right','both') then return false; end if;
    if item->>'attachment' <> 'none' and item->>'slug' not in ('barbell','dumbbell','cable-machine')
      or item->>'attachment' = 'both' and item->>'slug' <> 'barbell' then return false; end if;
    foreach hand in array array['left','right'] loop
      if item->>'attachment' in (hand,'both') then
        if hand = any(hands) then return false; end if;
        hands := array_append(hands,hand);
      end if;
    end loop;
    if jsonb_typeof(item->'pulleyHeight') is distinct from 'number' then return false; end if;
    if (item->>'pulleyHeight')::numeric not between 0.2 and 2.5 then return false; end if;
    if item ? 'frames' then
      if jsonb_typeof(item->'frames') is distinct from 'array' then return false; end if;
      if jsonb_array_length(item->'frames') not between 1 and 24 then return false; end if;
      previous_time := -1;
      for frame in select * from jsonb_array_elements(item->'frames') loop
        if not private.valid_studio_transform(frame) or frame - array['x','y','z','rotationX','rotationY','rotationZ','scale','timeMs'] <> '{}'::jsonb then return false; end if;
        if jsonb_typeof(frame->'timeMs') is distinct from 'number' then return false; end if;
        frame_time := (frame->>'timeMs')::numeric;
        if frame_time <> trunc(frame_time) or frame_time <= previous_time or frame_time > 60000 or previous_time = -1 and frame_time <> 0 then return false; end if;
        previous_time := frame_time::integer;
      end loop;
    end if;
  end loop;
  return true;
end;
$$;

-- Keep layout timing valid even for direct table writes under existing RLS.
alter table public.exercise_scenes add constraint studio_frames_within_duration check (
  not jsonb_path_exists(studio_layout, '$.objects[*].frames[*] ? (@.timeMs > $duration)', jsonb_build_object('duration',duration_ms))
);

-- Creating the draft and its first scene is one transaction. Viewing the new
-- workshop does not create an empty draft; failed saves create no orphan.
create function public.create_workshop_exercise(p_scene jsonb)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare draft_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  draft_id := public.save_private_exercise(p_name => 'Untitled exercise');
  perform public.save_private_scene(draft_id,p_scene);
  return draft_id;
end;
$$;
revoke all on function public.create_workshop_exercise(jsonb) from public,anon;
grant execute on function public.create_workshop_exercise(jsonb) to authenticated;
