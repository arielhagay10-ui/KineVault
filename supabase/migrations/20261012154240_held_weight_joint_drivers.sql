-- Extend the existing JSON validator without rewriting saved scenes or changing
-- the CHECK constraint's function identity. All legacy fields remain validated.
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
      if coalesce(item->>'slug','') not in ('dumbbell','barbell','kettlebell')
        or jsonb_typeof(item->'poseDriver') is distinct from 'string'
        or item->>'poseDriver' not in ('arm','weight','left-arm','right-arm') then return false; end if;
    end if;
    objects := objects || jsonb_build_array(item - 'poseDriver');
  end loop;
  return private.valid_studio_layout_before_pose_driver(jsonb_set(value, '{objects}', objects));
end;
$$;
