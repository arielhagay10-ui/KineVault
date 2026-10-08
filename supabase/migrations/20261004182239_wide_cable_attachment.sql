-- Accept the wide-grip lat cable bar while preserving layout validation and ownership checks.
create or replace function private.valid_studio_layout(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; frame jsonb; point jsonb; settings jsonb; ids text[] := array[]::text[]; hands text[] := array[]::text[];
  object_id text; hand text; site text; field text; previous_time integer; frame_time numeric;
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) is distinct from 'object' then return false; end if;
  if value - array['body','objects','presentation','seating','frontalPlane'] <> '{}'::jsonb or not private.valid_studio_transform(value->'body') then return false; end if;
  if (value->'body') - array['x','y','z','rotationX','rotationY','rotationZ','scale'] <> '{}'::jsonb then return false; end if;
  if value ? 'frontalPlane' and jsonb_typeof(value->'frontalPlane') is distinct from 'boolean' then return false; end if;
  if value ? 'presentation' then
    settings := value->'presentation';
    if jsonb_typeof(settings) is distinct from 'object' or settings - array['highlight','isolate','view'] <> '{}'::jsonb then return false; end if;
    if jsonb_typeof(settings->'highlight') is distinct from 'string' or length(settings->>'highlight') not between 1 and 200
      or settings->>'highlight' !~ '^(none|group:[a-z]+|mesh:[^\r\n]+)$'
      or jsonb_typeof(settings->'isolate') is distinct from 'boolean'
      or jsonb_typeof(settings->'view') is distinct from 'string' or settings->>'view' not in ('front','side','three_quarter','back') then return false; end if;
  end if;
  if jsonb_typeof(value->'objects') is distinct from 'array' then return false; end if;
  if jsonb_array_length(value->'objects') > 20 then return false; end if;
  if value ? 'seating' then
    settings := value->'seating';
    if jsonb_typeof(settings) is distinct from 'object' or settings - array['benchId','facing'] <> '{}'::jsonb
      or jsonb_typeof(settings->'benchId') is distinct from 'string'
      or jsonb_typeof(settings->'facing') is distinct from 'string' or settings->>'facing' not in ('front','left','right','back','supine','prone') then return false; end if;
    if not exists (select 1 from jsonb_array_elements(value->'objects') b where b->>'id' = settings->>'benchId' and b->>'slug' = 'bench') then return false; end if;
  end if;
  for item in select * from jsonb_array_elements(value->'objects') loop
    if not private.valid_studio_transform(item) then return false; end if;
    if item - array['x','y','z','rotationX','rotationY','rotationZ','scale','id','name','slug','attachment','pulleyHeight','frames','benchAngle','elbowLocks','cableAttachment','cuffPosition','shoulderAlignment','machineHandleHeight','machinePosition','machineUse','machineGrip','machineMode','machinePalm','machineElbowPath'] <> '{}'::jsonb then return false; end if;
    if jsonb_typeof(item->'id') is distinct from 'string' or jsonb_typeof(item->'name') is distinct from 'string'
      or jsonb_typeof(item->'slug') is distinct from 'string' or jsonb_typeof(item->'attachment') is distinct from 'string' then return false; end if;
    object_id := item->>'id';
    if object_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or lower(object_id) = any(ids) then return false; end if;
    ids := array_append(ids,lower(object_id));
    if length(btrim(item->>'name')) not between 1 and 60 then return false; end if;
    if item->>'slug' not in ('cable-machine','bench','squat-rack','barbell','dumbbell','kettlebell','lat-pulldown-machine','smith-machine','leg-press','cable-row-machine','pec-deck')
      or item->>'attachment' not in ('none','left','right','both') then return false; end if;
    if item->>'attachment' <> 'none' and item->>'slug' not in ('barbell','dumbbell','kettlebell','cable-machine')
      or item->>'attachment' = 'both' and item->>'slug' not in ('barbell','kettlebell') and not (item->>'slug' = 'cable-machine' and coalesce(item->>'cableAttachment','d-handle') not in ('d-handle','cuff')) then return false; end if;
    foreach hand in array array['left','right'] loop
      if item->>'attachment' in (hand,'both') then
        site := hand || '-' || case when item->>'slug' = 'cable-machine' and item->>'cableAttachment' = 'cuff' then coalesce(item->>'cuffPosition','wrist') else 'hand' end;
        if site = any(hands) then return false; end if;
        hands := array_append(hands,site);
      end if;
    end loop;
    if jsonb_typeof(item->'pulleyHeight') is distinct from 'number' then return false; end if;
    if (item->>'pulleyHeight')::numeric not between 0.2 and 3.2 then return false; end if;
    if item ? 'cableAttachment' then
      if item->>'slug' <> 'cable-machine' or jsonb_typeof(item->'cableAttachment') is distinct from 'string'
        or item->>'cableAttachment' not in ('d-handle','rope','straight-bar','angled-bar','lat-bar','v-bar','cuff') then return false; end if;
    end if;
    if item ? 'cuffPosition' then
      if item->>'slug' <> 'cable-machine'
        or jsonb_typeof(item->'cuffPosition') is distinct from 'string' or item->>'cuffPosition' not in ('wrist','upper-arm') then return false; end if;
    end if;
    if item ? 'shoulderAlignment' then
      if item->>'slug' <> 'cable-machine' or jsonb_typeof(item->'shoulderAlignment') is distinct from 'string'
        or item->>'shoulderAlignment' not in ('left','right') then return false; end if;
    end if;
    if item ? 'benchAngle' then
      if item->>'slug' <> 'bench' or jsonb_typeof(item->'benchAngle') is distinct from 'number' then return false; end if;
      if (item->>'benchAngle')::numeric not between 0 and 85 then return false; end if;
    end if;
    if item ? 'elbowLocks' then
      if jsonb_typeof(item->'elbowLocks') is distinct from 'object' or (item->'elbowLocks') - array['left','right'] <> '{}'::jsonb then return false; end if;
      foreach hand in array array['left','right'] loop
        if (item->'elbowLocks') ? hand then
          if item->>'slug' not in ('barbell','dumbbell','kettlebell') or item->>'attachment' not in (hand,'both') then return false; end if;
          point := item->'elbowLocks'->hand;
          if jsonb_typeof(point) is distinct from 'object' or point - array['x','y','z'] <> '{}'::jsonb then return false; end if;
          foreach field in array array['x','y','z'] loop
            if jsonb_typeof(point->field) is distinct from 'number' then return false; end if;
            if (point->>field)::numeric > 10 or (point->>field)::numeric < (case when field='y' then -3 else -10 end) then return false; end if;
          end loop;
        end if;
      end loop;
    end if;
    if item ? 'machineHandleHeight' then
      if item->>'slug' <> 'cable-row-machine' or jsonb_typeof(item->'machineHandleHeight') is distinct from 'number' then return false; end if;
      if (item->>'machineHandleHeight')::numeric not between 0.7 and 1.85 then return false; end if;
    end if;
    if item ? 'machinePalm' then
      if item->>'slug' not in ('cable-row-machine','pec-deck') or jsonb_typeof(item->'machinePalm') is distinct from 'string'
        or item->>'machinePalm' not in ('inward','outward') then return false; end if;
    end if;
    if item ? 'machineElbowPath' then
      if item->>'slug' not in ('cable-row-machine','pec-deck') or jsonb_typeof(item->'machineElbowPath') is distinct from 'string'
        or item->>'machineElbowPath' not in ('beside-body','shoulder-height') then return false; end if;
    end if;
    if item ? 'machineMode' then
      if item->>'slug' <> 'pec-deck' or jsonb_typeof(item->'machineMode') is distinct from 'string'
        or item->>'machineMode' not in ('regular','reverse') then return false; end if;
    end if;
    if item ? 'machineGrip' then
      if item->>'slug' <> 'lat-pulldown-machine' or jsonb_typeof(item->'machineGrip') is distinct from 'string'
        or item->>'machineGrip' not in ('supinated','pronated') then return false; end if;
    end if;
    if item ? 'machinePosition' or item ? 'machineUse' then
      if item->>'slug' not in ('lat-pulldown-machine','smith-machine','leg-press','cable-row-machine','pec-deck') then return false; end if;
      if item ? 'machinePosition' then
        if jsonb_typeof(item->'machinePosition') is distinct from 'number' then return false; end if;
        if (item->>'machinePosition')::numeric not between 0 and 1 then return false; end if;
      end if;
      if item ? 'machineUse' and jsonb_typeof(item->'machineUse') is distinct from 'boolean' then return false; end if;
    end if;
    if item ? 'frames' then
      if jsonb_typeof(item->'frames') is distinct from 'array' then return false; end if;
      if jsonb_array_length(item->'frames') not between 1 and 24 then return false; end if;
      previous_time := -1;
      for frame in select * from jsonb_array_elements(item->'frames') loop
        if not private.valid_studio_transform(frame) or frame - array['x','y','z','rotationX','rotationY','rotationZ','scale','timeMs','machinePosition','machineHandleHeight'] <> '{}'::jsonb then return false; end if;
        if frame ? 'machineHandleHeight' then
          if item->>'slug' <> 'cable-row-machine' or jsonb_typeof(frame->'machineHandleHeight') is distinct from 'number' then return false; end if;
          if (frame->>'machineHandleHeight')::numeric not between 0.7 and 1.85 then return false; end if;
        end if;
        if frame ? 'machinePosition' then
          if item->>'slug' not in ('lat-pulldown-machine','smith-machine','leg-press','cable-row-machine','pec-deck') or jsonb_typeof(frame->'machinePosition') is distinct from 'number' then return false; end if;
          if (frame->>'machinePosition')::numeric not between 0 and 1 then return false; end if;
        end if;
        if jsonb_typeof(frame->'timeMs') is distinct from 'number' then return false; end if;
        frame_time := (frame->>'timeMs')::numeric;
        if frame_time <> trunc(frame_time) or frame_time <= previous_time or frame_time > 60000 or previous_time = -1 and frame_time <> 0 then return false; end if;
        previous_time := frame_time::integer;
      end loop;
    end if;
  end loop;
  if (select count(*) from jsonb_array_elements(value->'objects') o where o->'machineUse' = 'true'::jsonb) > 1 then return false; end if;
  if exists (select 1 from jsonb_array_elements(value->'objects') o where o->'machineUse' = 'true'::jsonb)
    and (value ? 'seating' or exists (select 1 from jsonb_array_elements(value->'objects') o where o->>'attachment' <> 'none')) then return false; end if;
  return true;
end;
$$;
