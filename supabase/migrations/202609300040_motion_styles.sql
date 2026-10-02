alter table public.exercise_scenes add column motion_style text not null default 'free'
  check (motion_style in ('free','squat','hinge','row','split-squat','bench-press'));

create or replace function public.save_private_scene(p_private_id uuid,p_scene jsonb)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare scene_id uuid; content_id uuid;
begin
  scene_id := private.save_private_scene_core(p_private_id,p_scene);
  update public.exercise_scenes set motion_style = coalesce(p_scene->>'motionStyle','free') where id=scene_id;
  select p.content_id into content_id from public.private_exercises p where id=p_private_id and owner_id=auth.uid();
  perform private.replace_scene_annotations(content_id,coalesce(p_scene->'annotations','[]'::jsonb));
  return scene_id;
end;
$$;

alter function private.clone_exercise_content(uuid,public.content_kind,uuid) rename to clone_exercise_content_without_style;
create function private.clone_exercise_content(source_content_id uuid,target_kind public.content_kind,target_owner_id uuid)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare target_id uuid;
begin
  target_id := private.clone_exercise_content_without_style(source_content_id,target_kind,target_owner_id);
  update public.exercise_scenes target set motion_style=source.motion_style
    from public.exercise_scenes source where source.content_id=source_content_id and target.content_id=target_id;
  return target_id;
end;
$$;
revoke all on function private.clone_exercise_content(uuid,public.content_kind,uuid) from public,anon,authenticated;

-- Extend existing authorized readers without changing their access predicates.
do $$
declare signature text; definition text; updated text;
begin
  foreach signature in array array['public.read_render_scene(uuid)','public.read_shared_private_scene(text)','public.read_render_refresh_scene(uuid)'] loop
    definition := pg_get_functiondef(signature::regprocedure);
    updated := replace(definition, '''durationMs'', scene.duration_ms', '''motionStyle'', scene.motion_style, ''durationMs'', scene.duration_ms');
    updated := replace(updated, '''durationMs'',s.duration_ms', '''motionStyle'',s.motion_style,''durationMs'',s.duration_ms');
    if updated=definition then raise exception 'scene reader signature changed: %',signature; end if;
    execute updated;
  end loop;
end;
$$;

insert into public.exercise_families(slug,name) values ('row','Row'),('lunge','Lunge') on conflict(slug) do nothing;
