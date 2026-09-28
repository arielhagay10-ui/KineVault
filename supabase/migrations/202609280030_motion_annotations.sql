alter table public.motion_phase_annotations add constraint annotation_text_lengths
check(length(btrim(label)) between 1 and 80 and (note is null or length(note) <= 500));
alter table public.moderation_field_changes drop constraint moderation_field_changes_field_name_check;
alter table public.moderation_field_changes add constraint moderation_field_changes_field_name_check
check(field_name in ('name','description','family','muscles','joints','joint_actions','equipment','resistance_profile',
  'body_position','attachments','movement_patterns','grip','stance','plane','resistance_source','peak_resistance_position',
  'classification_confidence','reviewer_notes','difficulty','exercise_type','mechanic','force_type','laterality',
  'setup_instructions','execution_instructions','form_cues','common_mistakes','safety_notes','range_of_motion_notes','media','relationship','motion_annotations'));

create function private.annotation_values(p_content_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('startMs',a.start_ms,'endMs',a.end_ms,
    'label',a.label,'note',a.note,'jointAction',j.slug) order by a.start_ms,a.label),'[]'::jsonb)
  from public.exercise_scenes s join public.motion_phase_annotations a on a.scene_id = s.id
  left join public.joint_actions j on j.id = a.joint_action_id where s.content_id = p_content_id;
$$;
revoke all on function private.annotation_values(uuid) from public,anon,authenticated;

create function private.replace_scene_annotations(p_content_id uuid,p_annotations jsonb)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare scene public.exercise_scenes%rowtype; annotation jsonb; action_id uuid; submission_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.exercise_content c join public.private_exercises p on p.content_id = c.id
    where c.id = p_content_id and c.kind = 'private_draft' and c.owner_id = auth.uid() and p.owner_id = auth.uid()) then
    select id into submission_id from public.exercise_submissions where editorial_content_id = p_content_id and status = 'in_review';
    if submission_id is null then raise exception 'editable scene required'; end if;
    perform private.assert_submission_reviewer(submission_id);
  end if;
  select * into scene from public.exercise_scenes where content_id = p_content_id for update;
  if scene.id is null then raise exception 'scene required'; end if;
  if p_annotations is null or jsonb_typeof(p_annotations) <> 'array' or jsonb_array_length(p_annotations) > 24 then
    raise exception 'invalid annotations';
  end if;
  delete from public.motion_phase_annotations where scene_id = scene.id;
  for annotation in select value from jsonb_array_elements(p_annotations) loop
    if jsonb_typeof(annotation) <> 'object' or jsonb_typeof(annotation->'startMs') <> 'number'
      or jsonb_typeof(annotation->'endMs') <> 'number' or jsonb_typeof(annotation->'label') <> 'string'
      or length(btrim(annotation->>'label')) not between 1 and 80
      or length(coalesce(annotation->>'note','')) > 500
      or (annotation->>'startMs')::numeric <> trunc((annotation->>'startMs')::numeric)
      or (annotation->>'endMs')::numeric <> trunc((annotation->>'endMs')::numeric)
      or (annotation->>'startMs')::integer < 0 or (annotation->>'endMs')::integer > scene.duration_ms
      or (annotation->>'endMs')::integer <= (annotation->>'startMs')::integer then
      raise exception 'annotation outside scene bounds';
    end if;
    action_id := null;
    if nullif(annotation->>'jointAction','') is not null then
      select id into action_id from public.joint_actions where slug = annotation->>'jointAction';
      if action_id is null or not exists(select 1 from public.exercise_joint_actions where content_id = p_content_id and joint_action_id = action_id) then
        raise exception 'annotation action must belong to the exercise';
      end if;
    end if;
    insert into public.motion_phase_annotations(scene_id,start_ms,end_ms,joint_action_id,label,note)
    values(scene.id,(annotation->>'startMs')::integer,(annotation->>'endMs')::integer,action_id,
      btrim(annotation->>'label'),nullif(btrim(annotation->>'note'),''));
  end loop;
end;
$$;
revoke all on function private.replace_scene_annotations(uuid,jsonb) from public,anon;
grant execute on function private.replace_scene_annotations(uuid,jsonb) to authenticated;

alter function public.save_private_scene(uuid,jsonb) set schema private;
alter function private.save_private_scene(uuid,jsonb) rename to save_private_scene_core;
create function public.save_private_scene(p_private_id uuid,p_scene jsonb)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare scene_id uuid; content_id uuid;
begin
  scene_id := private.save_private_scene_core(p_private_id,p_scene);
  select p.content_id into content_id from public.private_exercises p where id = p_private_id and owner_id = auth.uid();
  perform private.replace_scene_annotations(content_id,coalesce(p_scene->'annotations','[]'::jsonb));
  return scene_id;
end;
$$;
revoke all on function public.save_private_scene(uuid,jsonb) from public;
grant execute on function public.save_private_scene(uuid,jsonb) to authenticated;

create function public.edit_submission_annotations(p_submission_id uuid,p_annotations jsonb,p_comment text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare target public.exercise_submissions%rowtype; prior jsonb; after_value jsonb; event_id uuid;
begin
  perform private.assert_submission_reviewer(p_submission_id);
  select * into target from public.exercise_submissions where id = p_submission_id for update;
  if target.status <> 'in_review' then raise exception 'submission must be in review'; end if;
  if length(btrim(coalesce(p_comment,''))) < 5 or length(p_comment) > 2000 then raise exception 'a useful audit comment is required'; end if;
  prior := private.annotation_values(target.editorial_content_id);
  perform private.replace_scene_annotations(target.editorial_content_id,p_annotations);
  after_value := private.annotation_values(target.editorial_content_id);
  if prior is not distinct from after_value then raise exception 'no annotations changed'; end if;
  insert into public.moderation_events(submission_id,actor_id,action,from_status,to_status,comment)
  values(p_submission_id,auth.uid(),'edit','in_review','in_review',btrim(p_comment)) returning id into event_id;
  insert into public.moderation_field_changes(event_id,field_name,before_value,after_value)
  values(event_id,'motion_annotations',prior,after_value);
end;
$$;
revoke all on function public.edit_submission_annotations(uuid,jsonb,text) from public;
grant execute on function public.edit_submission_annotations(uuid,jsonb,text) to authenticated;
