-- Apply validated patches to normalized draft relations; callers authorize and audit.
create or replace function private.apply_content_patch(p_content_id uuid,p_patch jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  item record; field_name text; before_value jsonb; after_value jsonb;
  change_count integer := 0; taxonomy_table text; join_table text;
  join_column text; role_type text; entry jsonb; taxonomy_id uuid;
  before_joints jsonb; wanted_slugs text[]; changes jsonb := '{}'::jsonb;
begin
  if not exists(select 1 from public.exercise_content where id = p_content_id and kind in ('submission_editorial','private_draft')) then
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
  if change_count = 0 and exists(select 1 from public.exercise_content where id = p_content_id and kind = 'submission_editorial') then raise exception 'no classifications changed'; end if;
  return changes;
end;
$$;
create function public.save_private_metadata(p_patch jsonb,p_private_id uuid default null)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare private_id uuid := coalesce(p_private_id,gen_random_uuid()); content_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_private_id is null then
    content_id := gen_random_uuid();
    insert into public.exercise_content(id,kind,owner_id,created_by,name)
    values(content_id,'private_draft',auth.uid(),auth.uid(),'Untitled exercise');
    insert into public.private_exercises(id,owner_id,content_id) values(private_id,auth.uid(),content_id);
  else
    select p.content_id into content_id from public.private_exercises p where id = private_id and owner_id = auth.uid() for update;
    if content_id is null then raise exception 'private exercise not found'; end if;
  end if;
  perform private.apply_content_patch(content_id,p_patch);
  update public.private_exercises set updated_at = now() where id = private_id;
  return private_id;
end;
$$;
revoke all on function public.save_private_metadata(jsonb,uuid) from public;
grant execute on function public.save_private_metadata(jsonb,uuid) to authenticated;

-- Capability reads use JSON only as transport; classifications remain relational.
create function public.read_shared_private_metadata(p_token_hash text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_object_agg(field,private.review_field_value(c.id,field))
  from public.private_exercise_shares s
  join public.private_exercises p on p.id = s.private_exercise_id
  join public.exercise_content c on c.id = p.content_id
  cross join unnest(array['name','description','family','muscles','joints','joint_actions','equipment',
    'attachments','movement_patterns','body_position','grip','stance','plane','resistance_source',
    'resistance_profile','peak_resistance_position','classification_confidence','reviewer_notes','difficulty',
    'exercise_type','mechanic','force_type','laterality','setup_instructions','execution_instructions',
    'form_cues','common_mistakes','safety_notes','range_of_motion_notes']) field
  where s.token_hash = p_token_hash and s.revoked_at is null;
$$;
revoke all on function public.read_shared_private_metadata(text) from public;
grant execute on function public.read_shared_private_metadata(text) to anon,authenticated;
