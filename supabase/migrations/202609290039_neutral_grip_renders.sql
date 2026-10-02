-- Credit the corrected forearm orientation and equipment renderer on new assets.
create or replace function private.credit_anatomy_render()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.kind in ('webm','mp4','poster') and new.license_name = 'KineVault original render' then
    new.license_name := 'CC BY-SA 4.0';
    new.source_credit := 'Z-Anatomy v3 — Gauthier Kervyn and contributors; BodyParts3D © The Database Center for Life Science (CC BY-SA 2.1 Japan). Adapted geometry, materials and posing.';
  end if;
  return new;
end;
$$;
