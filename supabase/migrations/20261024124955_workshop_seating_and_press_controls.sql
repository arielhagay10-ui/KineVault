do $$
declare original text;
begin
  select prosrc into strict original from pg_catalog.pg_proc
    where oid = 'private.valid_studio_layout(jsonb)'::regprocedure;
  execute format('create function private.valid_studio_layout_before_seating(value jsonb) returns boolean language plpgsql immutable set search_path = '''' as %L', original);
end;
$$;
revoke all on function private.valid_studio_layout_before_seating(jsonb) from public, anon;
grant execute on function private.valid_studio_layout_before_seating(jsonb) to authenticated, service_role;

create or replace function private.valid_studio_layout(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; clean_item jsonb; frame jsonb; frames jsonb; settings jsonb; field text;
  seated boolean; press boolean; objects jsonb := '[]'::jsonb;
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) is distinct from 'object' or jsonb_typeof(value->'objects') is distinct from 'array' then return false; end if;
  for item in select * from jsonb_array_elements(value->'objects') loop
    if jsonb_typeof(item) is distinct from 'object' then return false; end if;
    seated := coalesce(item->>'slug' in ('bench','row-machine','shoulder-press-machine','lat-pulldown-machine','cable-row-machine','pec-deck','leg-press'), false);
    press := coalesce(item->>'slug' = 'shoulder-press-machine', false);
    if item ? 'seatFootSupport' then
      if not seated or jsonb_typeof(item->'seatFootSupport') is distinct from 'boolean' then return false; end if;
      if item->>'slug' = 'leg-press' and item->'seatFootSupport' = 'false'::jsonb then return false; end if;
    end if;
    if item ? 'pressGrip' and (not press or jsonb_typeof(item->'pressGrip') is distinct from 'string' or item->>'pressGrip' not in ('wide','neutral')) then return false; end if;
    -- Validate both object defaults and every frame before removing extension fields.
    if item ? 'frames' and jsonb_typeof(item->'frames') is distinct from 'array' then return false; end if;
    for settings in select * from jsonb_array_elements(jsonb_build_array(item) || coalesce(item->'frames', '[]'::jsonb)) loop
      if jsonb_typeof(settings) is distinct from 'object' then return false; end if;
      foreach field in array array['seatOffsetX','seatOffsetZ'] loop
        if settings ? field then
          if not seated or jsonb_typeof(settings->field) is distinct from 'number' then return false; end if;
          if abs((settings->>field)::numeric) > (case field when 'seatOffsetX' then .1 else .12 end) then return false; end if;
        end if;
      end loop;
      if press then
        foreach field in array array['machinePositionLeft','machinePositionRight'] loop
          if settings ? field then
            if jsonb_typeof(settings->field) is distinct from 'number' then return false; end if;
            if (settings->>field)::numeric not between 0 and 1 then return false; end if;
          end if;
        end loop;
      end if;
    end loop;
    clean_item := item - array['seatOffsetX','seatOffsetZ','seatFootSupport','pressGrip'];
    if press then clean_item := clean_item - array['machinePositionLeft','machinePositionRight']; end if;
    if item ? 'frames' then
      frames := '[]'::jsonb;
      for frame in select * from jsonb_array_elements(item->'frames') loop
        frame := frame - array['seatOffsetX','seatOffsetZ'];
        if press then frame := frame - array['machinePositionLeft','machinePositionRight']; end if;
        frames := frames || jsonb_build_array(frame);
      end loop;
      clean_item := jsonb_set(clean_item, '{frames}', frames);
    end if;
    if press and item->'machineUse' = 'true'::jsonb then
      if jsonb_typeof(item->'attachment') is distinct from 'string' or item->>'attachment' not in ('none','left','right','both') then return false; end if;
      if exists (select 1 from jsonb_array_elements(value->'objects') other
        where other->>'id' is distinct from item->>'id' and other->>'attachment' is distinct from 'none') then return false; end if;
      clean_item := jsonb_set(clean_item, '{attachment}', '"none"'::jsonb);
    end if;
    objects := objects || jsonb_build_array(clean_item);
  end loop;
  return private.valid_studio_layout_before_seating(jsonb_set(value, '{objects}', objects));
end;
$$;
