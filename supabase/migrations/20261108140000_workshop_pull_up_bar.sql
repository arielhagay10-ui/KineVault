-- Check the hanging pull-up bar, then reuse the rack contract for its stored fields.
-- The top-level validator keeps its OID and grants; the previous body moves to a new function.
do $$
declare original text;
begin
  select prosrc into strict original from pg_catalog.pg_proc
    where oid = 'private.valid_studio_layout(jsonb)'::regprocedure;
  if position('private.valid_studio_layout_before_chest_press(' in original) = 0 then
    raise exception 'Studio layout validator changed; review pull-up bar migration';
  end if;
  execute format('create function private.valid_studio_layout_before_pull_up_bar(value jsonb) returns boolean language plpgsql immutable set search_path = '''' as %L', original);
end;
$$;
revoke all on function private.valid_studio_layout_before_pull_up_bar(jsonb) from public, anon;
grant execute on function private.valid_studio_layout_before_pull_up_bar(jsonb) to authenticated, service_role;

create or replace function private.valid_studio_layout(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; objects jsonb := '[]'::jsonb; hanging boolean := false;
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) is distinct from 'object' or jsonb_typeof(value->'objects') is distinct from 'array' then return false; end if;
  for item in select * from jsonb_array_elements(value->'objects') loop
    if item->>'slug' = 'pull-up-bar' then
      -- Both hands hang the figure from the bar; one hand cannot hold it.
      if jsonb_typeof(item->'attachment') is distinct from 'string' or item->>'attachment' not in ('none','both') then return false; end if;
      hanging := hanging or item->>'attachment' = 'both';
      item := jsonb_set(item, '{slug}', '"squat-rack"'::jsonb);
    end if;
    objects := objects || jsonb_build_array(item);
  end loop;
  if hanging and (value ? 'seating'
    or jsonb_typeof(value->'supports') = 'array' and jsonb_array_length(value->'supports') > 0
    or exists (select 1 from jsonb_array_elements(value->'objects') machine where machine->'machineUse' = 'true'::jsonb)) then return false; end if;
  return private.valid_studio_layout_before_pull_up_bar(jsonb_set(value, '{objects}', objects));
end;
$$;

insert into public.equipment_categories (slug, name)
values ('bodyweight', 'Bodyweight')
on conflict (slug) do nothing;

insert into public.equipment (category_id, slug, name)
select id, 'pull-up-bar', 'Pull-Up Bar'
from public.equipment_categories where slug = 'bodyweight'
on conflict (slug) do nothing;
