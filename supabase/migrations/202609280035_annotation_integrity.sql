-- Validate direct table writes as well as authoring/review RPCs.
create function private.validate_annotation_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare scene public.exercise_scenes%rowtype;
begin
  select * into scene from public.exercise_scenes where id = new.scene_id for share;
  if new.end_ms > scene.duration_ms then raise exception 'annotation outside scene bounds'; end if;
  if new.joint_action_id is not null and not exists(select 1 from public.exercise_joint_actions
    where content_id = scene.content_id and joint_action_id = new.joint_action_id) then
    raise exception 'annotation action must belong to the exercise';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_annotation_row() from public,anon,authenticated;
create trigger annotation_row_integrity before insert or update on public.motion_phase_annotations
for each row execute function private.validate_annotation_row();

create function private.validate_scene_annotations()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_content_id uuid;
begin
  if tg_table_name = 'exercise_scenes' then target_content_id := new.content_id;
  else target_content_id := old.content_id; end if;
  if exists(select 1 from public.motion_phase_annotations a join public.exercise_scenes s on s.id = a.scene_id
    where s.content_id = target_content_id and (a.end_ms > s.duration_ms or (a.joint_action_id is not null and not exists(
      select 1 from public.exercise_joint_actions ea where ea.content_id = target_content_id and ea.joint_action_id = a.joint_action_id)))) then
    raise exception 'update movement notes before removing their action or shortening the scene';
  end if;
  return null;
end;
$$;
revoke all on function private.validate_scene_annotations() from public,anon,authenticated;
create constraint trigger scene_annotation_integrity after update on public.exercise_scenes
deferrable initially deferred for each row execute function private.validate_scene_annotations();
create constraint trigger action_annotation_integrity after delete or update on public.exercise_joint_actions
deferrable initially deferred for each row execute function private.validate_scene_annotations();
