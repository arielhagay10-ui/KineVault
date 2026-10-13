-- Keep the prior JSON contract intact and add only the optional dumbbell driver.
-- Copy the old implementation, then replace the original function in place so
-- exercise_scenes' CHECK constraint keeps calling the same function OID.
do $$
declare validator_source text;
begin
  select prosrc into strict validator_source
  from pg_catalog.pg_proc
  where oid = 'private.valid_studio_layout(jsonb)'::regprocedure;
  execute format(
    'create function private.valid_studio_layout_before_pose_driver(value jsonb) returns boolean language plpgsql immutable set search_path = '''' as %L',
    validator_source
  );
end;
$$;

revoke all on function private.valid_studio_layout_before_pose_driver(jsonb) from public, anon;
grant execute on function private.valid_studio_layout_before_pose_driver(jsonb) to authenticated, service_role;

create or replace function private.valid_studio_layout(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; objects jsonb := '[]'::jsonb;
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) is distinct from 'object'
    or jsonb_typeof(value->'objects') is distinct from 'array' then return false; end if;
  for item in select * from jsonb_array_elements(value->'objects') loop
    if jsonb_typeof(item) is distinct from 'object' then return false; end if;
    if item ? 'poseDriver' then
      if item->>'slug' is distinct from 'dumbbell'
        or jsonb_typeof(item->'poseDriver') is distinct from 'string'
        or item->>'poseDriver' not in ('arm','weight') then return false; end if;
    end if;
    objects := objects || jsonb_build_array(item - 'poseDriver');
  end loop;
  -- Legacy bench/rack contacts remain readable. The application removes those
  -- obsolete contacts before validation and saving; this migration changes no rows.
  return private.valid_studio_layout_before_pose_driver(jsonb_set(value, '{objects}', objects));
end;
$$;
