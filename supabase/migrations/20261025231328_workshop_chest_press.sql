-- Reuse the seated press contract without changing the stored equipment slug.
do $$
declare original text;
begin
  select prosrc into strict original from pg_catalog.pg_proc
    where oid = 'private.valid_studio_layout(jsonb)'::regprocedure;
  execute format('create function private.valid_studio_layout_before_chest_press(value jsonb) returns boolean language plpgsql immutable set search_path = '''' as %L', original);
end;
$$;
revoke all on function private.valid_studio_layout_before_chest_press(jsonb) from public, anon;
grant execute on function private.valid_studio_layout_before_chest_press(jsonb) to authenticated, service_role;

create or replace function private.valid_studio_layout(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; objects jsonb := '[]'::jsonb;
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) is distinct from 'object' or jsonb_typeof(value->'objects') is distinct from 'array' then return false; end if;
  for item in select * from jsonb_array_elements(value->'objects') loop
    if item->>'slug' = 'chest-press-machine' then
      if item ? 'pressGrip' and (jsonb_typeof(item->'pressGrip') is distinct from 'string' or item->>'pressGrip' not in ('wide','angled','neutral')) then return false; end if;
      item := jsonb_set(item, '{slug}', '"shoulder-press-machine"'::jsonb);
      if item->>'pressGrip' = 'angled' then item := jsonb_set(item, '{pressGrip}', '"wide"'::jsonb); end if;
    end if;
    objects := objects || jsonb_build_array(item);
  end loop;
  return private.valid_studio_layout_before_chest_press(jsonb_set(value, '{objects}', objects));
end;
$$;

insert into public.equipment (category_id, slug, name)
select id, 'chest-press-machine', 'Converging Chest Press'
from public.equipment_categories where slug = 'machine'
on conflict (slug) do nothing;
