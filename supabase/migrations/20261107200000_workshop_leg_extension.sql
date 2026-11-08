-- Add one machine to the existing leaf validator; retain its OID and grants.
do $$
declare original text; updated text;
begin
  select prosrc into strict original from pg_catalog.pg_proc
    where oid = 'private.valid_studio_layout_before_pose_driver(jsonb)'::regprocedure;
  updated := replace(original, '''t-bar-row-machine'',''shoulder-press-machine''',
    '''t-bar-row-machine'',''leg-extension-machine'',''shoulder-press-machine''');
  if updated = original then raise exception 'Equipment validator changed; review leg extension migration'; end if;
  execute format('create or replace function private.valid_studio_layout_before_pose_driver(value jsonb) returns boolean language plpgsql immutable set search_path = '''' as %L', updated);
end;
$$;

insert into public.equipment (category_id, slug, name)
select id, 'leg-extension-machine', 'Leg Extension Machine'
from public.equipment_categories where slug = 'machine'
on conflict (slug) do nothing;
