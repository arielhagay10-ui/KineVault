-- Extend the existing validators without dropping their OIDs or grants.
do $$
declare original text; updated text;
begin
  select prosrc into strict original from pg_catalog.pg_proc
    where oid = 'private.valid_studio_layout_before_support_planes(jsonb)'::regprocedure;
  updated := replace(original,
    'if contact->>''surface'' <> ''floor'' then return false; end if;',
    'if contact->>''surface'' <> ''floor'' and not (
      contact->>''surface'' in (''self:pelvis'',''self:torso'',''self:left-hip'',''self:right-hip'',''self:left-knee'',''self:right-knee'')
      and region in (''left-hand'',''right-hand'',''left-forearm'',''right-forearm'',''left-elbow'',''right-elbow'')
    ) then return false; end if;');
  if updated = original then raise exception 'Support validator changed; review the self-support migration'; end if;
  execute format('create or replace function private.valid_studio_layout_before_support_planes(value jsonb) returns boolean language plpgsql immutable set search_path = '''' as %L', updated);

  select prosrc into strict original from pg_catalog.pg_proc
    where oid = 'private.valid_studio_layout(jsonb)'::regprocedure;
  updated := replace(original, 'if contact->''objectId'' = ''null''::jsonb and (', 'if contact->>''surface'' = ''floor'' and (');
  if updated = original then raise exception 'Floor validator changed; review the self-support migration'; end if;
  execute format('create or replace function private.valid_studio_layout(value jsonb) returns boolean language plpgsql immutable set search_path = '''' as %L', updated);
end;
$$;
