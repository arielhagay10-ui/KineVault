-- Layouts supplement the existing relational rig, timeline and held equipment.
-- All editing, sharing and snapshot authorization continues through existing APIs.
create or replace function private.valid_studio_transform(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare field text; number numeric;
begin
  if jsonb_typeof(value) is distinct from 'object' then return false; end if;
  foreach field in array array['x','y','z','rotationX','rotationY','rotationZ','scale'] loop
    if jsonb_typeof(value->field) is distinct from 'number' then return false; end if;
    number := (value->>field)::numeric;
    if field = 'scale' then
      if number < 0.5 or number > 2 then return false; end if;
    elsif field like 'rotation%' then
      if number < -180 or number > 180 then return false; end if;
    elsif field = 'y' then
      if number < -3 or number > 10 then return false; end if;
    elsif number < -10 or number > 10 then return false;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function private.valid_studio_layout(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; ids text[] := array[]::text[]; object_id text;
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) is distinct from 'object' then return false; end if;
  if value - array['body','objects'] <> '{}'::jsonb or not private.valid_studio_transform(value->'body') then return false; end if;
  if (value->'body') - array['x','y','z','rotationX','rotationY','rotationZ','scale'] <> '{}'::jsonb then return false; end if;
  if jsonb_typeof(value->'objects') is distinct from 'array' then return false; end if;
  if jsonb_array_length(value->'objects') > 20 then return false; end if;
  for item in select * from jsonb_array_elements(value->'objects') loop
    if not private.valid_studio_transform(item) then return false; end if;
    if item - array['x','y','z','rotationX','rotationY','rotationZ','scale','id','name','slug','attachment','pulleyHeight'] <> '{}'::jsonb then return false; end if;
    if jsonb_typeof(item->'id') is distinct from 'string' or jsonb_typeof(item->'name') is distinct from 'string'
      or jsonb_typeof(item->'slug') is distinct from 'string' or jsonb_typeof(item->'attachment') is distinct from 'string' then return false; end if;
    object_id := item->>'id';
    if object_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or lower(object_id) = any(ids) then return false; end if;
    ids := array_append(ids,lower(object_id));
    if length(btrim(item->>'name')) not between 1 and 60 then return false; end if;
    if item->>'slug' not in ('cable-machine','bench','squat-rack','barbell','dumbbell')
      or item->>'attachment' not in ('none','left','right') then return false; end if;
    if jsonb_typeof(item->'pulleyHeight') is distinct from 'number' then return false; end if;
    if (item->>'pulleyHeight')::numeric not between 0.2 and 2.5 then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function private.valid_studio_transform(jsonb), private.valid_studio_layout(jsonb) from public,anon;
grant execute on function private.valid_studio_transform(jsonb), private.valid_studio_layout(jsonb) to authenticated,service_role;

alter table public.exercise_scenes add column studio_layout jsonb
  check (private.valid_studio_layout(studio_layout));

create or replace function public.save_private_scene(p_private_id uuid,p_scene jsonb)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare scene_id uuid; content_id uuid;
begin
  scene_id := private.save_private_scene_core(p_private_id,p_scene);
  update public.exercise_scenes set motion_style = coalesce(p_scene->>'motionStyle','free'), studio_layout = p_scene->'studio' where id=scene_id;
  select p.content_id into content_id from public.private_exercises p where id=p_private_id and owner_id=auth.uid();
  perform private.replace_scene_annotations(content_id,coalesce(p_scene->'annotations','[]'::jsonb));
  return scene_id;
end;
$$;

alter function private.clone_exercise_content(uuid,public.content_kind,uuid) rename to clone_exercise_content_without_studio;
create function private.clone_exercise_content(source_content_id uuid,target_kind public.content_kind,target_owner_id uuid)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare target_id uuid;
begin
  target_id := private.clone_exercise_content_without_studio(source_content_id,target_kind,target_owner_id);
  update public.exercise_scenes target set studio_layout=source.studio_layout
    from public.exercise_scenes source where source.content_id=source_content_id and target.content_id=target_id;
  return target_id;
end;
$$;
revoke all on function private.clone_exercise_content(uuid,public.content_kind,uuid) from public,anon,authenticated;

do $$
declare signature text; definition text; updated text;
begin
  foreach signature in array array['public.read_render_scene(uuid)','public.read_shared_private_scene(text)','public.read_render_refresh_scene(uuid)'] loop
    definition := pg_get_functiondef(signature::regprocedure);
    updated := replace(definition, '''motionStyle'', scene.motion_style', '''studio'', scene.studio_layout, ''motionStyle'', scene.motion_style');
    updated := replace(updated, '''motionStyle'',s.motion_style', '''studio'',s.studio_layout,''motionStyle'',s.motion_style');
    if updated=definition then raise exception 'scene reader signature changed: %',signature; end if;
    execute updated;
  end loop;
end;
$$;
