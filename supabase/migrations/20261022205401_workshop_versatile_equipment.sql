-- Extend the leaf validator while preserving its OID, grants and existing checks.
do $$
declare original text; updated text;
begin
  select prosrc into strict original from pg_catalog.pg_proc
    where oid = 'private.valid_studio_layout_before_pose_driver(jsonb)'::regprocedure;
  updated := replace(original,
    '(''cable-machine'',''bench'',''squat-rack'',''barbell'',''dumbbell'',''kettlebell'',''lat-pulldown-machine'',''smith-machine'',''leg-press'',''cable-row-machine'',''pec-deck'')',
    '(''cable-machine'',''bench'',''squat-rack'',''barbell'',''dumbbell'',''kettlebell'',''lat-pulldown-machine'',''smith-machine'',''leg-press'',''cable-row-machine'',''pec-deck'',''row-machine'',''shoulder-press-machine'',''stool'',''plyo-box'',''resistance-band'')');
  if updated = original then raise exception 'Equipment slug validator changed; review migration'; end if;
  updated := replace(updated,
    '(''lat-pulldown-machine'',''smith-machine'',''leg-press'',''cable-row-machine'',''pec-deck'')',
    '(''lat-pulldown-machine'',''smith-machine'',''leg-press'',''cable-row-machine'',''pec-deck'',''row-machine'',''shoulder-press-machine'')');
  updated := replace(updated,
    '(''barbell'',''dumbbell'',''kettlebell'',''bench'',''squat-rack'',''cable-machine'',''cable-row-machine'')',
    '(''barbell'',''dumbbell'',''kettlebell'',''bench'',''squat-rack'',''cable-machine'',''cable-row-machine'',''lat-pulldown-machine'',''smith-machine'',''leg-press'',''pec-deck'',''row-machine'',''shoulder-press-machine'')');
  updated := replace(updated,
    '(''barbell'',''dumbbell'',''kettlebell'',''bench'',''squat-rack'')',
    '(''barbell'',''dumbbell'',''kettlebell'',''bench'',''squat-rack'',''lat-pulldown-machine'',''smith-machine'',''leg-press'',''pec-deck'',''row-machine'',''shoulder-press-machine'')');
  execute format('create or replace function private.valid_studio_layout_before_pose_driver(value jsonb) returns boolean language plpgsql immutable set search_path = '''' as %L', updated);
  select prosrc into strict original from pg_catalog.pg_proc
    where oid = 'private.valid_studio_layout(jsonb)'::regprocedure;
  execute format('create function private.valid_studio_layout_before_equipment_expansion(value jsonb) returns boolean language plpgsql immutable set search_path = '''' as %L', original);
end;
$$;
revoke all on function private.valid_studio_layout_before_equipment_expansion(jsonb) from public, anon;
grant execute on function private.valid_studio_layout_before_equipment_expansion(jsonb) to authenticated, service_role;

create or replace function private.valid_studio_layout(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; settings jsonb; anchor jsonb; point jsonb; field text; endpoint text;
  objects jsonb := '[]'::jsonb;
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) is distinct from 'object' or jsonb_typeof(value->'objects') is distinct from 'array' then return false; end if;
  if value ? 'supports' and jsonb_typeof(value->'supports') is distinct from 'array' then return false; end if;
  if jsonb_array_length(value->'objects') > 20 then return false; end if;
  for item in select * from jsonb_array_elements(value->'objects') loop
    if jsonb_typeof(item) is distinct from 'object' then return false; end if;
    if item ? 'machineRange' then
      settings := item->'machineRange';
      if item->>'slug' <> 'smith-machine' or jsonb_typeof(settings) is distinct from 'object'
        or settings - array['min','max'] <> '{}'::jsonb
        or jsonb_typeof(settings->'min') is distinct from 'number'
        or jsonb_typeof(settings->'max') is distinct from 'number' then return false; end if;
      if (settings->>'min')::numeric not between .3 and 3.05
        or (settings->>'max')::numeric not between .3 and 3.05
        or (settings->>'max')::numeric - (settings->>'min')::numeric < .1 then return false; end if;
    end if;
    if item ? 'band' then
      settings := item->'band';
      if item->>'slug' <> 'resistance-band' or jsonb_typeof(settings) is distinct from 'object'
        or settings - array['start','end','length'] <> '{}'::jsonb
        or jsonb_typeof(settings->'length') is distinct from 'number' then return false; end if;
      if (settings->>'length')::numeric not between .2 and 6 then return false; end if;
      foreach endpoint in array array['start','end'] loop
        anchor := settings->endpoint;
        if jsonb_typeof(anchor) is distinct from 'object' or anchor - array['target','objectId','point'] <> '{}'::jsonb
          or jsonb_typeof(anchor->'target') is distinct from 'string'
          or anchor->>'target' not in ('fixed','equipment','left-hand','right-hand','left-foot','right-foot','pelvis') then return false; end if;
        if anchor->>'target' = 'equipment' then
          if jsonb_typeof(anchor->'objectId') is distinct from 'string' or not exists (
            select 1 from jsonb_array_elements(value->'objects') target
            where target->>'id' = anchor->>'objectId' and target->>'id' <> item->>'id' and target->>'slug' <> 'resistance-band'
          ) then return false; end if;
        elsif anchor ? 'objectId' then return false;
        end if;
        point := anchor->'point';
        if jsonb_typeof(point) is distinct from 'object' or point - array['x','y','z'] <> '{}'::jsonb then return false; end if;
        foreach field in array array['x','y','z'] loop
          if jsonb_typeof(point->field) is distinct from 'number' then return false; end if;
          if (point->>field)::numeric not between -10 and 10 then return false; end if;
        end loop;
      end loop;
    end if;
    if item->>'slug' = 'resistance-band' and exists (
      select 1 from jsonb_array_elements(coalesce(value->'supports','[]'::jsonb)) contact where contact->>'objectId' = item->>'id'
    ) then return false; end if;
    objects := objects || jsonb_build_array(item - array['machineRange','band']);
  end loop;
  return private.valid_studio_layout_before_equipment_expansion(jsonb_set(value, '{objects}', objects));
end;
$$;

insert into public.equipment_categories (slug, name) values
  ('machine', 'Machine'), ('support', 'Support'), ('resistance-band', 'Resistance Band')
on conflict (slug) do nothing;
insert into public.equipment (category_id, slug, name)
select category.id, item.slug, item.name from public.equipment_categories category
cross join (values
  ('row-machine','Plate-loaded Row','machine'), ('shoulder-press-machine','Shoulder Press','machine'),
  ('stool','Stool','support'), ('plyo-box','Plyo Box','support'), ('resistance-band','Resistance Band','resistance-band')
) item(slug,name,category_slug)
where category.slug = item.category_slug
on conflict (slug) do nothing;
