do $$
declare original text;
begin
  select prosrc into strict original from pg_catalog.pg_proc where oid = 'private.valid_studio_layout(jsonb)'::regprocedure;
  execute format('create function private.valid_studio_layout_before_t_bar_contacts(value jsonb) returns boolean language plpgsql immutable set search_path = '''' as %L', original);
end;
$$;
revoke all on function private.valid_studio_layout_before_t_bar_contacts(jsonb) from public, anon;
grant execute on function private.valid_studio_layout_before_t_bar_contacts(jsonb) to authenticated, service_role;

create or replace function private.valid_studio_layout(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; clean_item jsonb; objects jsonb := '[]'::jsonb;
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) is distinct from 'object' or jsonb_typeof(value->'objects') is distinct from 'array' then return false; end if;
  for item in select * from jsonb_array_elements(value->'objects') loop
    if jsonb_typeof(item) is distinct from 'object' then return false; end if;
    clean_item := item;
    if item->>'slug' = 't-bar-row-machine' then
      if item ? 'rowGrip' and (jsonb_typeof(item->'rowGrip') is distinct from 'string' or item->>'rowGrip' not in ('neutral','wide')) then return false; end if;
      if item ? 'rowFootSupport' and jsonb_typeof(item->'rowFootSupport') is distinct from 'boolean' then return false; end if;
      clean_item := item - array['rowGrip','rowFootSupport'];
      if item->'machineUse' = 'true'::jsonb then
        if jsonb_typeof(item->'attachment') is distinct from 'string' or item->>'attachment' not in ('none','left','right','both') then return false; end if;
        if exists (select 1 from jsonb_array_elements(value->'objects') other where other->>'id' is distinct from item->>'id' and other->>'attachment' is distinct from 'none') then return false; end if;
        clean_item := jsonb_set(clean_item, '{attachment}', '"none"'::jsonb);
      end if;
    end if;
    objects := objects || jsonb_build_array(clean_item);
  end loop;
  return private.valid_studio_layout_before_t_bar_contacts(jsonb_set(value, '{objects}', objects));
end;
$$;
