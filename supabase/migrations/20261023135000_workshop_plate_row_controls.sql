do $$
declare original text;
begin
  select prosrc into strict original from pg_catalog.pg_proc
    where oid = 'private.valid_studio_layout(jsonb)'::regprocedure;
  execute format('create function private.valid_studio_layout_before_plate_row(value jsonb) returns boolean language plpgsql immutable set search_path = '''' as %L', original);
end;
$$;
revoke all on function private.valid_studio_layout_before_plate_row(jsonb) from public, anon;
grant execute on function private.valid_studio_layout_before_plate_row(jsonb) to authenticated, service_role;

create or replace function private.valid_studio_layout(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; clean_item jsonb; frame jsonb; frames jsonb; field text;
  objects jsonb := '[]'::jsonb;
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) is distinct from 'object' or jsonb_typeof(value->'objects') is distinct from 'array' then return false; end if;
  for item in select * from jsonb_array_elements(value->'objects') loop
    if jsonb_typeof(item) is distinct from 'object' then return false; end if;
    if item ?| array['rowSeatHeight','rowGrip','rowFootSupport','machinePositionLeft','machinePositionRight'] and item->>'slug' is distinct from 'row-machine' then return false; end if;
    if item ? 'rowSeatHeight' then
      if jsonb_typeof(item->'rowSeatHeight') is distinct from 'number' then return false; end if;
      if (item->>'rowSeatHeight')::numeric not between .56 and .78 then return false; end if;
    end if;
    if item ? 'rowGrip' and (jsonb_typeof(item->'rowGrip') is distinct from 'string' or item->>'rowGrip' not in ('neutral','wide')) then return false; end if;
    if item ? 'rowFootSupport' and jsonb_typeof(item->'rowFootSupport') is distinct from 'boolean' then return false; end if;
    foreach field in array array['machinePositionLeft','machinePositionRight'] loop
      if item ? field then
        if jsonb_typeof(item->field) is distinct from 'number' then return false; end if;
        if (item->>field)::numeric not between 0 and 1 then return false; end if;
      end if;
    end loop;
    clean_item := item - array['rowSeatHeight','rowGrip','rowFootSupport','machinePositionLeft','machinePositionRight'];
    if item ? 'frames' then
      if jsonb_typeof(item->'frames') is distinct from 'array' then return false; end if;
      frames := '[]'::jsonb;
      for frame in select * from jsonb_array_elements(item->'frames') loop
        if jsonb_typeof(frame) is distinct from 'object' then return false; end if;
        foreach field in array array['machinePositionLeft','machinePositionRight'] loop
          if frame ? field then
            if item->>'slug' is distinct from 'row-machine' or jsonb_typeof(frame->field) is distinct from 'number' then return false; end if;
            if (frame->>field)::numeric not between 0 and 1 then return false; end if;
          end if;
        end loop;
        frames := frames || jsonb_build_array(frame - array['machinePositionLeft','machinePositionRight']);
      end loop;
      clean_item := jsonb_set(clean_item, '{frames}', frames);
    end if;
    if item->>'slug' = 'row-machine' and item->'machineUse' = 'true'::jsonb then
      if exists (select 1 from jsonb_array_elements(value->'objects') other
        where other->>'id' is distinct from item->>'id' and other->>'attachment' is distinct from 'none') then return false; end if;
      if item->>'attachment' not in ('none','left','right','both') or jsonb_typeof(item->'attachment') is distinct from 'string' then return false; end if;
      clean_item := jsonb_set(clean_item, '{attachment}', '"none"'::jsonb);
    end if;
    objects := objects || jsonb_build_array(clean_item);
  end loop;
  return private.valid_studio_layout_before_plate_row(jsonb_set(value, '{objects}', objects));
end;
$$;
