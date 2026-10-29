-- Preserve the existing validator OID, grants, and checks for legacy fields.
do $$
declare validator_source text;
begin
  select prosrc into strict validator_source from pg_catalog.pg_proc
    where oid = 'private.valid_studio_layout(jsonb)'::regprocedure;
  execute format('create function private.valid_studio_layout_before_supports(value jsonb) returns boolean language plpgsql immutable set search_path = '''' as %L', validator_source);
end;
$$;
revoke all on function private.valid_studio_layout_before_supports(jsonb) from public, anon;
grant execute on function private.valid_studio_layout_before_supports(jsonb) to authenticated, service_role;

create or replace function private.valid_studio_layout(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  contact jsonb; item jsonb; support_object jsonb; field text; vector text; region text; side text;
  regions text[] := array[]::text[]; number numeric; squared_length numeric;
begin
  if value is null then return true; end if;
  if not private.valid_studio_layout_before_supports(value - 'supports') then return false; end if;
  if not (value ? 'supports') then return true; end if;
  if jsonb_typeof(value->'supports') is distinct from 'array' then return false; end if;
  if jsonb_array_length(value->'supports') > 13 then return false; end if;
  if jsonb_array_length(value->'supports') > 0 and value ? 'seating' then return false; end if;
  for contact in select * from jsonb_array_elements(value->'supports') loop
    if jsonb_typeof(contact) is distinct from 'object'
      or contact - array['region','objectId','surface','point','normal','turn'] <> '{}'::jsonb
      or not (contact ?& array['region','objectId','surface','point','normal','turn']) then return false; end if;
    if jsonb_typeof(contact->'region') is distinct from 'string'
      or jsonb_typeof(contact->'surface') is distinct from 'string' then return false; end if;
    region := contact->>'region';
    if region not in ('left-hand','right-hand','left-forearm','right-forearm','left-elbow','right-elbow','left-knee','right-knee','left-foot','right-foot','pelvis','chest','back')
      or region = any(regions) then return false; end if;
    regions := array_append(regions,region);
    if contact->'objectId' = 'null'::jsonb then
      if contact->>'surface' <> 'floor' then return false; end if;
    else
      if jsonb_typeof(contact->'objectId') is distinct from 'string' then return false; end if;
      select object into support_object from jsonb_array_elements(value->'objects') object where object->>'id' = contact->>'objectId';
      if support_object is null then return false; end if;
      if support_object->>'attachment' <> 'none' and support_object->>'slug' in ('dumbbell','barbell','kettlebell') then return false; end if;
      if support_object->>'slug' = 'bench' then
        if contact->>'surface' not in ('seat','pad') then return false; end if;
      elsif contact->>'surface' <> 'body' then return false;
      end if;
    end if;
    foreach vector in array array['point','normal'] loop
      if jsonb_typeof(contact->vector) is distinct from 'object'
        or (contact->vector) - array['x','y','z'] <> '{}'::jsonb then return false; end if;
      squared_length := 0;
      foreach field in array array['x','y','z'] loop
        if jsonb_typeof(contact->vector->field) is distinct from 'number' then return false; end if;
        number := (contact->vector->>field)::numeric;
        if number not between -10 and 10 or vector = 'normal' and number not between -1 and 1 then return false; end if;
        squared_length := squared_length + number * number;
      end loop;
      if vector = 'normal' and abs(squared_length - 1) > 0.001 then return false; end if;
    end loop;
    if jsonb_typeof(contact->'turn') is distinct from 'number' or (contact->>'turn')::numeric not between -180 and 180 then return false; end if;
    for item in select * from jsonb_array_elements(value->'objects') loop
      if item->'machineUse' = 'true'::jsonb then return false; end if;
      foreach side in array array['left','right'] loop
        if region = side || '-hand' and item->>'attachment' in (side,'both')
          and not coalesce(item->>'cableAttachment' = 'cuff' and item->>'cuffPosition' = 'upper-arm',false) then return false; end if;
        if region in (side || '-hand',side || '-forearm',side || '-elbow') and (item->'elbowLocks') ? side then return false; end if;
      end loop;
    end loop;
  end loop;
  return true;
end;
$$;
