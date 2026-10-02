-- Preserve frozen media and their storage objects while serving a newer render.
create table public.media_render_replacements (
  storage_bucket text not null check (storage_bucket in ('exercise-private','exercise-public')),
  original_path text not null,
  replacement_path text not null,
  renderer_version text not null check (renderer_version ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  license_name text not null default 'CC BY-SA 4.0',
  source_credit text not null default 'Z-Anatomy — Gauthier Kervyn and contributors; BodyParts3D © The Database Center for Life Science (CC BY-SA 2.1 Japan). Adapted geometry, materials and posing.',
  created_at timestamptz not null default now(),
  primary key (storage_bucket,original_path,renderer_version),
  unique (storage_bucket,replacement_path)
);
alter table public.media_render_replacements enable row level security;
grant select on public.media_render_replacements to anon,authenticated;
create policy public_render_replacements_read on public.media_render_replacements for select to anon,authenticated
using (storage_bucket = 'exercise-public' and exists (
  select 1 from public.exercise_media m join public.exercises e on e.current_content_id = m.content_id
  where m.storage_bucket = media_render_replacements.storage_bucket and m.storage_path = original_path and e.status = 'published'
));
create policy private_render_replacements_read on public.media_render_replacements for select to authenticated
using (storage_bucket = 'exercise-private' and exists (
  select 1 from public.exercise_media m where m.storage_bucket = media_render_replacements.storage_bucket and m.storage_path = original_path
));

create policy public_render_replacement_read on storage.objects for select to anon,authenticated
using (bucket_id = 'exercise-public' and exists (
  select 1 from public.media_render_replacements r
  join public.exercise_media m on m.storage_bucket = r.storage_bucket and m.storage_path = r.original_path
  join public.exercises e on e.current_content_id = m.content_id
  where r.storage_bucket = bucket_id and r.replacement_path = name and e.status = 'published'
));

create function public.list_render_refresh_targets(p_renderer_version text)
returns table (asset_group_id uuid,scene_id uuid,assets jsonb)
language sql stable security definer set search_path = '' as $$
  select m.asset_group_id,min(m.scene_id::text)::uuid,
    jsonb_agg(jsonb_build_object('kind',m.kind,'bucket',m.storage_bucket,'path',m.storage_path) order by m.kind)
  from public.exercise_media m
  where m.kind in ('webm','mp4','poster') and m.scene_id is not null
  group by m.asset_group_id
  having count(*) = 3 and count(distinct m.kind) = 3
    and not bool_and(exists(select 1 from public.media_render_replacements r
      where r.storage_bucket = m.storage_bucket and r.original_path = m.storage_path and r.renderer_version = p_renderer_version));
$$;
revoke all on function public.list_render_refresh_targets(text) from public,anon,authenticated;
grant execute on function public.list_render_refresh_targets(text) to service_role;

create function public.read_render_refresh_scene(p_asset_group_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('durationMs',s.duration_ms,'cameraAngle',s.default_camera_angle,
    'equipment',(select jsonb_build_object('slug',a.slug,'x',p.position_x,'y',p.position_y,'z',p.position_z,'scale',p.scale)
      from public.scene_equipment p join public.equipment_assets a on a.id = p.asset_id where p.scene_id = s.id order by p.id limit 1),
    'keyframes',coalesce((select jsonb_agg(jsonb_build_object('timeMs',f.position_ms,'poses',
      coalesce((select jsonb_agg(jsonb_build_object('slug',j.slug,'x',p.rotation_x,'y',p.rotation_y,'z',p.rotation_z,'w',p.rotation_w) order by j.slug)
        from public.motion_joint_poses p join public.rig_joints j on j.id = p.rig_joint_id where p.keyframe_id = f.id),'[]'::jsonb)) order by f.position_ms)
      from public.motion_keyframes f where f.scene_id = s.id),'[]'::jsonb))
  from public.exercise_scenes s where s.id = (select m.scene_id from public.exercise_media m where m.asset_group_id = p_asset_group_id order by m.id limit 1);
$$;
revoke all on function public.read_render_refresh_scene(uuid) from public,anon,authenticated;
grant execute on function public.read_render_refresh_scene(uuid) to service_role;

create function public.register_render_replacements(p_asset_group_id uuid,p_renderer_version text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare m public.exercise_media%rowtype; destination text;
begin
  if p_renderer_version !~ '^[a-z0-9][a-z0-9-]{1,60}$' then raise exception 'invalid renderer version'; end if;
  if (select count(*) from public.exercise_media where asset_group_id = p_asset_group_id and kind in ('webm','mp4','poster')) <> 3 then
    raise exception 'complete media group required';
  end if;
  for m in select * from public.exercise_media where asset_group_id = p_asset_group_id and kind in ('webm','mp4','poster') loop
    destination := regexp_replace(m.storage_path,'/([^/]+)$','/' || p_renderer_version || '/\1');
    if not exists(select 1 from storage.objects where bucket_id = m.storage_bucket and name = destination) then
      raise exception 'replacement media object missing';
    end if;
    insert into public.media_render_replacements(storage_bucket,original_path,replacement_path,renderer_version)
    values(m.storage_bucket,m.storage_path,destination,p_renderer_version) on conflict do nothing;
  end loop;
end;
$$;
revoke all on function public.register_render_replacements(uuid,text) from public,anon,authenticated;
grant execute on function public.register_render_replacements(uuid,text) to service_role;

-- New renders also carry the model's actual license rather than "original render".
create function private.credit_anatomy_render()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.kind in ('webm','mp4','poster') and new.license_name = 'KineVault original render' then
    new.license_name := 'CC BY-SA 4.0';
    new.source_credit := 'Z-Anatomy v2 — Gauthier Kervyn and contributors; BodyParts3D © The Database Center for Life Science (CC BY-SA 2.1 Japan). Adapted geometry, materials and posing.';
  end if;
  return new;
end;
$$;
revoke all on function private.credit_anatomy_render() from public,anon,authenticated;
create trigger credit_anatomy_render before insert on public.exercise_media
for each row execute function private.credit_anatomy_render();
