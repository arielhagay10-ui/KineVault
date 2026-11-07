-- Add one machine to the existing leaf validator; retain its OID and grants.
do $$
declare original text; updated text;
begin
  select prosrc into strict original from pg_catalog.pg_proc
    where oid = 'private.valid_studio_layout_before_pose_driver(jsonb)'::regprocedure;
  updated := replace(original, '''leg-curl-machine'',''shoulder-press-machine''',
    '''leg-curl-machine'',''lateral-raise-machine'',''shoulder-press-machine''');
  if updated = original then raise exception 'Equipment validator changed; review lateral raise migration'; end if;
  execute format('create or replace function private.valid_studio_layout_before_pose_driver(value jsonb) returns boolean language plpgsql immutable set search_path = '''' as %L', updated);
end;
$$;

insert into public.equipment (category_id, slug, name)
select id, 'lateral-raise-machine', 'Lateral Raise Machine'
from public.equipment_categories where slug = 'machine'
on conflict (slug) do nothing;
