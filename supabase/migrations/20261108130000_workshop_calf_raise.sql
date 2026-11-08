-- Add the standing calf raise machine to the existing leaf validator; retain its OID and grants.
do $$
declare
  original text; updated text;
  anchor constant text := '''lateral-raise-machine'',''shoulder-press-machine''';
begin
  select prosrc into strict original from pg_catalog.pg_proc
    where oid = 'private.valid_studio_layout_before_pose_driver(jsonb)'::regprocedure;
  -- The slug, attachment, both-hands, machine and frame travel lists each name the lateral raise once.
  if (length(original) - length(replace(original, anchor, ''))) / length(anchor) <> 5 then
    raise exception 'Equipment validator changed; review calf raise migration';
  end if;
  updated := replace(original, anchor, '''lateral-raise-machine'',''calf-raise-machine'',''shoulder-press-machine''');
  execute format('create or replace function private.valid_studio_layout_before_pose_driver(value jsonb) returns boolean language plpgsql immutable set search_path = '''' as %L', updated);
end;
$$;

insert into public.equipment (category_id, slug, name)
select id, 'calf-raise-machine', 'Calf Raise Machine'
from public.equipment_categories where slug = 'machine'
on conflict (slug) do nothing;
