-- Apply validated patches to normalized draft relations; callers authorize and audit.
create function private.apply_content_patch(p_content_id uuid,p_patch jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  item record; field_name text; before_value jsonb; after_value jsonb;
  change_count integer := 0; taxonomy_table text; join_table text;
  join_column text; role_type text; entry jsonb; taxonomy_id uuid;
  before_joints jsonb; wanted_slugs text[]; changes jsonb := '{}'::jsonb;
begin
  if not exists(select 1 from public.exercise_content where id = p_content_id and kind = 'submission_editorial') then
    raise exception 'editorial content required';
  end if;
  if jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb
    or p_patch is null then
    raise exception 'a change and useful audit comment are required';
  end if;
  if exists (select 1 from jsonb_object_keys(p_patch) key where key not in (
    'name','description','family','muscles','joints','joint_actions',
    'equipment','resistance_profile','body_position','attachments','movement_patterns',
    'grip','stance','plane','resistance_source','peak_resistance_position',
    'classification_confidence','reviewer_notes','difficulty','exercise_type','mechanic',
    'force_type','laterality','setup_instructions','execution_instructions','form_cues',
    'common_mistakes','safety_notes','range_of_motion_notes'
  )) then raise exception 'unsupported review field'; end if;
  before_joints := private.review_field_value(p_content_id,'joints');
  for item in select key, value from jsonb_each(p_patch) loop
    field_name := item.key;
    before_value := private.review_field_value(p_content_id, field_name);
    if field_name = 'name' then
      if jsonb_typeof(item.value) <> 'string' or length(btrim(item.value #>> '{}')) not between 2 and 160 then raise exception 'invalid name'; end if;
      update public.exercise_content set name = btrim(item.value #>> '{}'), updated_at = now() where id = p_content_id;
    elsif field_name = 'description' then
      if item.value <> 'null'::jsonb and (jsonb_typeof(item.value) <> 'string' or length(item.value #>> '{}') > 500) then raise exception 'invalid description'; end if;
      update public.exercise_content set short_description = nullif(btrim(item.value #>> '{}'),''), updated_at = now() where id = p_content_id;
    elsif field_name in ('family','body_position','grip','stance','plane','resistance_source') then
      if item.value <> 'null'::jsonb and jsonb_typeof(item.value) <> 'string' then raise exception 'invalid taxonomy'; end if;
      if field_name = 'family' then
        select id into taxonomy_id from public.exercise_families where slug = item.value #>> '{}';
        if item.value <> 'null'::jsonb and taxonomy_id is null then raise exception 'unknown family'; end if;
        update public.exercise_content set family_id = taxonomy_id, updated_at = now() where id = p_content_id;
      else
        taxonomy_table := case field_name when 'body_position' then 'body_positions'
          when 'grip' then 'grips' when 'stance' then 'stances' when 'plane' then 'planes_of_motion'
          else 'resistance_sources' end;
        execute format('select id from public.%I where slug = $1',taxonomy_table) into taxonomy_id using item.value #>> '{}';
        if item.value <> 'null'::jsonb and taxonomy_id is null then raise exception 'unknown taxonomy value'; end if;
        execute format('insert into public.exercise_biomechanics(content_id,%I) values($1,$2) on conflict(content_id) do update set %I = excluded.%I',field_name || '_id',field_name || '_id',field_name || '_id')
          using p_content_id,taxonomy_id;
      end if;
    elsif field_name = 'resistance_profile' then
      if jsonb_typeof(item.value) <> 'string' then raise exception 'invalid resistance profile'; end if;
      insert into public.exercise_biomechanics(content_id,resistance_profile)
      values(p_content_id,(item.value #>> '{}')::public.resistance_profile)
      on conflict(content_id) do update set resistance_profile = excluded.resistance_profile;
    elsif field_name in ('difficulty','exercise_type','mechanic','force_type','laterality') then
      if item.value <> 'null'::jsonb and jsonb_typeof(item.value) <> 'string' then raise exception 'invalid classification'; end if;
      role_type := case field_name when 'difficulty' then 'exercise_difficulty'
        when 'mechanic' then 'exercise_mechanic' else field_name end;
      execute format('update public.exercise_content set %I = $1::public.%I,updated_at = now() where id = $2',field_name,role_type)
        using item.value #>> '{}',p_content_id;
    elsif field_name in ('peak_resistance_position','classification_confidence','reviewer_notes') then
      if item.value <> 'null'::jsonb and jsonb_typeof(item.value) <> 'string' then raise exception 'invalid biomechanics'; end if;
      if field_name = 'reviewer_notes' and length(item.value #>> '{}') > 2000 then raise exception 'notes too long'; end if;
      insert into public.exercise_biomechanics(content_id) values(p_content_id) on conflict do nothing;
      if field_name = 'reviewer_notes' then
        update public.exercise_biomechanics set reviewer_notes = nullif(btrim(item.value #>> '{}'),'') where content_id = p_content_id;
      else
        execute format('update public.exercise_biomechanics set %I = $1::public.%I where content_id = $2',field_name,field_name)
          using item.value #>> '{}',p_content_id;
      end if;
    elsif field_name in ('setup_instructions','execution_instructions','form_cues','common_mistakes','safety_notes','range_of_motion_notes') then
      if item.value <> 'null'::jsonb and (jsonb_typeof(item.value) <> 'string' or length(item.value #>> '{}') > 4000) then raise exception 'invalid instruction'; end if;
      execute format('update public.exercise_content set %I = $1,updated_at = now() where id = $2',field_name)
        using nullif(btrim(item.value #>> '{}'),''),p_content_id;
    else
      if jsonb_typeof(item.value) <> 'array' or jsonb_array_length(item.value) > 20 then raise exception 'invalid taxonomy array'; end if;
      case field_name
        when 'muscles' then taxonomy_table := 'muscles'; join_table := 'exercise_muscles'; join_column := 'muscle_id'; role_type := 'muscle_role';
        when 'joints' then taxonomy_table := 'joints'; join_table := 'exercise_joints'; join_column := 'joint_id'; role_type := 'joint_role';
        when 'joint_actions' then taxonomy_table := 'joint_actions'; join_table := 'exercise_joint_actions'; join_column := 'joint_action_id'; role_type := 'joint_role';
        when 'equipment' then taxonomy_table := 'equipment'; join_table := 'exercise_equipment'; join_column := 'equipment_id'; role_type := 'equipment_role';
        when 'attachments' then taxonomy_table := 'attachments'; join_table := 'exercise_attachments'; join_column := 'attachment_id'; role_type := null;
        when 'movement_patterns' then taxonomy_table := 'movement_patterns'; join_table := 'exercise_movement_patterns'; join_column := 'movement_pattern_id'; role_type := null;
      end case;
      select coalesce(array_agg(case when role_type is null then value #>> '{}' else value->>'slug' end),'{}'::text[])
        into wanted_slugs from jsonb_array_elements(item.value);
      if cardinality(wanted_slugs) <> (select count(distinct value) from unnest(wanted_slugs) value) then
        raise exception 'duplicate taxonomy value';
      end if;
      execute format('delete from public.%I relation where relation.content_id = $1 and not exists (select 1 from public.%I taxonomy where taxonomy.id = relation.%I and taxonomy.slug = any($2))',join_table,taxonomy_table,join_column)
        using p_content_id,wanted_slugs;
      for entry in select value from jsonb_array_elements(item.value) loop
        if role_type is null then
          if jsonb_typeof(entry) <> 'string' then raise exception 'invalid taxonomy value'; end if;
          execute format('select id from public.%I where slug = $1',taxonomy_table) into taxonomy_id using entry #>> '{}';
          if taxonomy_id is null then raise exception 'unknown taxonomy value'; end if;
          execute format('insert into public.%I(content_id,%I) values($1,$2) on conflict(content_id,%I) do nothing',join_table,join_column,join_column)
            using p_content_id,taxonomy_id;
        else
          if jsonb_typeof(entry) <> 'object' or jsonb_typeof(entry->'slug') <> 'string' or jsonb_typeof(entry->'role') <> 'string' then raise exception 'invalid taxonomy value'; end if;
          execute format('select id from public.%I where slug = $1',taxonomy_table) into taxonomy_id using entry->>'slug';
          if taxonomy_id is null then raise exception 'unknown taxonomy value'; end if;
          execute format('insert into public.%I(content_id,%I,role) values($1,$2,$3::public.%I) on conflict(content_id,%I) do update set role = excluded.role',join_table,join_column,role_type,join_column)
            using p_content_id,taxonomy_id,entry->>'role';
        end if;
      end loop;
    end if;
    after_value := private.review_field_value(p_content_id,field_name);
    if field_name <> 'joints' and before_value is distinct from after_value then
      changes := changes || jsonb_build_object(field_name,jsonb_build_object('before',before_value,'after',after_value));
      change_count := change_count + 1;
    end if;
  end loop;
  -- Actions imply anatomical joints, even when a reviewer edits both lists.
  insert into public.exercise_joints(content_id,joint_id,role)
  select p_content_id,a.joint_id,
    case when bool_or(ea.role = 'primary') then 'primary'::public.joint_role
      when bool_or(ea.role = 'secondary') then 'secondary'::public.joint_role
      else 'stabilization'::public.joint_role end
  from public.exercise_joint_actions ea join public.joint_actions a on a.id = ea.joint_action_id
  where ea.content_id = p_content_id group by a.joint_id
  on conflict(content_id,joint_id) do nothing;
  after_value := private.review_field_value(p_content_id,'joints');
  if before_joints is distinct from after_value then
    changes := changes || jsonb_build_object('joints',jsonb_build_object('before',before_joints,'after',after_value));
    change_count := change_count + 1;
  end if;
  if change_count = 0 then raise exception 'no classifications changed'; end if;
  return changes;
end;
$$;
-- Preserve one new media group per old group, including future camera/body variants.
create function private.clone_media(p_source_content_id uuid,p_target_content_id uuid,p_scene_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare source_group record; target_group uuid;
begin
  for source_group in select distinct asset_group_id from public.exercise_media where content_id = p_source_content_id loop
    target_group := gen_random_uuid();
    insert into public.exercise_media(content_id,scene_id,asset_group_id,kind,storage_bucket,storage_path,
      camera_angle,character_presentation,license_name,source_credit)
    select p_target_content_id,p_scene_id,target_group,kind,storage_bucket,storage_path,
      camera_angle,character_presentation,license_name,source_credit
    from public.exercise_media where content_id = p_source_content_id and asset_group_id = source_group.asset_group_id;
  end loop;
end;
$$;
revoke all on function private.clone_media(uuid,uuid,uuid) from public,anon,authenticated;

create function public.revise_public_exercise(p_exercise_id uuid,p_expected_content_id uuid,p_patch jsonb,p_comment text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare target public.exercises%rowtype; new_content_id uuid; new_scene_id uuid;
  changes jsonb; source_submission uuid; version_number integer;
begin
  if auth.uid() is null or not (select private.is_reviewer()) then raise exception 'reviewer role required'; end if;
  if length(btrim(coalesce(p_comment,''))) < 5 or length(p_comment) > 2000 then raise exception 'a useful audit comment is required'; end if;
  select * into target from public.exercises where id = p_exercise_id and status = 'published' for update;
  if not found then raise exception 'published exercise not found'; end if;
  if target.current_content_id is distinct from p_expected_content_id then raise exception 'exercise changed; reload before saving'; end if;
  new_content_id := private.clone_exercise_content(target.current_content_id,'submission_editorial',null);
  changes := private.apply_content_patch(new_content_id,p_patch);
  if not exists(select 1 from public.exercise_content where id = new_content_id and family_id is not null)
    or not exists(select 1 from public.exercise_muscles where content_id = new_content_id and role = 'primary')
    or not exists(select 1 from public.exercise_joint_actions where content_id = new_content_id and role = 'primary') then
    raise exception 'family, primary muscle, and primary joint action are required';
  end if;
  select source_submission_id into source_submission from public.exercise_versions where content_id = target.current_content_id;
  select id into new_scene_id from public.exercise_scenes where content_id = new_content_id;
  update public.exercise_scenes set motion_source_submission_id = coalesce(
    (select motion_source_submission_id from public.exercise_scenes where content_id = target.current_content_id),source_submission)
  where id = new_scene_id;
  perform private.clone_media(target.current_content_id,new_content_id,new_scene_id);
  update public.exercise_content set kind = 'published_version' where id = new_content_id;
  select coalesce(max(v.version_number),0)+1 into version_number from public.exercise_versions v where exercise_id = p_exercise_id;
  insert into public.exercise_versions(exercise_id,version_number,content_id,source_submission_id,approved_by)
  values(p_exercise_id,version_number,new_content_id,source_submission,auth.uid());
  update public.exercises set current_content_id = new_content_id,reviewed_by = auth.uid(),updated_at = now() where id = p_exercise_id;
  insert into public.admin_events(actor_id,object_type,object_id,operation,before_value,after_value,comment)
  values(auth.uid(),'exercises',p_exercise_id,'UPDATE',jsonb_build_object('content_id',target.current_content_id),
    jsonb_build_object('content_id',new_content_id,'changes',changes),btrim(p_comment));
  return new_content_id;
end;
$$;
revoke all on function public.revise_public_exercise(uuid,uuid,jsonb,text) from public;
grant execute on function public.revise_public_exercise(uuid,uuid,jsonb,text) to authenticated;
revoke all on function private.apply_content_patch(uuid,jsonb) from public,anon,authenticated;

create or replace function public.edit_submission_classifications(p_submission_id uuid,p_patch jsonb,p_comment text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare target public.exercise_submissions%rowtype; changes jsonb; item record; event_id uuid;
begin
  perform private.assert_submission_reviewer(p_submission_id);
  select * into target from public.exercise_submissions where id = p_submission_id for update;
  if target.status <> 'in_review' or target.editorial_content_id is null then raise exception 'submission must be in review'; end if;
  if length(btrim(coalesce(p_comment,''))) < 5 or length(p_comment) > 2000 then raise exception 'a useful audit comment is required'; end if;
  changes := private.apply_content_patch(target.editorial_content_id,p_patch);
  insert into public.moderation_events(submission_id,actor_id,action,from_status,to_status,comment)
  values(p_submission_id,auth.uid(),'edit','in_review','in_review',btrim(p_comment)) returning id into event_id;
  for item in select key,value from jsonb_each(changes) loop
    insert into public.moderation_field_changes(event_id,field_name,before_value,after_value)
    values(event_id,item.key,item.value->'before',item.value->'after');
  end loop;
  update public.exercise_submissions set updated_at = now() where id = p_submission_id;
end;
$$;
