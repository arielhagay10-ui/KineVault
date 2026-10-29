-- Tighten only new support contacts; preserve all legacy scene validation.
do $$
declare validator_source text;
begin
  select prosrc into strict validator_source from pg_catalog.pg_proc
    where oid = 'private.valid_studio_layout(jsonb)'::regprocedure;
  execute format('create function private.valid_studio_layout_before_support_planes(value jsonb) returns boolean language plpgsql immutable set search_path = '''' as %L',validator_source);
end;
$$;
revoke all on function private.valid_studio_layout_before_support_planes(jsonb) from public, anon;
grant execute on function private.valid_studio_layout_before_support_planes(jsonb) to authenticated, service_role;

create or replace function private.valid_studio_layout(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare contact jsonb; item jsonb; side text;
begin
  if value is null then return true; end if;
  if not private.valid_studio_layout_before_support_planes(value) then return false; end if;
  for contact in select * from jsonb_array_elements(coalesce(value->'supports','[]'::jsonb)) loop
    if contact->'objectId' = 'null'::jsonb and (
      abs((contact->'point'->>'y')::numeric) > 0.000001
      or abs((contact->'normal'->>'x')::numeric) > 0.000001
      or abs((contact->'normal'->>'y')::numeric - 1) > 0.000001
      or abs((contact->'normal'->>'z')::numeric) > 0.000001
    ) then return false; end if;
    foreach side in array array['left','right'] loop
      if contact->>'region' <> side || '-forearm' then continue; end if;
      for item in select * from jsonb_array_elements(value->'objects') loop
        if item->>'attachment' in (side,'both')
          and not coalesce(item->>'cableAttachment' = 'cuff' and item->>'cuffPosition' = 'upper-arm',false) then return false; end if;
      end loop;
    end loop;
  end loop;
  return true;
end;
$$;
