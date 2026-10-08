-- Must only run through the UUID-named database in scripts/test-database.mjs.
do $$ begin
  if current_database() !~ '^kinevault_checks_[a-f0-9]{32}$' then
    raise exception 'Catalog load fixtures require an isolated check database';
  end if;
end $$;
set statement_timeout = '120s';
begin;
create temporary table load_sources as
select e.current_content_id, row_number() over(order by e.slug)::integer n
from public.exercises e;
do $$ begin
  if not exists(select 1 from load_sources) then raise exception 'Catalog load requires seed exercises'; end if;
end $$;
create temporary table load_rows as
select i, md5('catalog-load-exercise-' || i)::uuid exercise_id,
  md5('catalog-load-content-' || i)::uuid content_id, source.current_content_id source_content_id
from generate_series(1,__FIXTURE_ROWS__) i
join load_sources source on source.n = case when i <= (select count(*) from load_sources) then i else 1 + case when i % 10 < 6
  then (i / 10) % least(8,(select count(*)::integer from load_sources))
  else (i * 17) % (select count(*)::integer from load_sources) end end;
insert into public.exercise_content(id,kind,name,family_id,short_description,difficulty,exercise_type,mechanic,force_type,laterality)
select row.content_id,'submission_editorial',c.name || case when row.i <= (select count(*) from load_sources)
  then '' else ' Variation ' || lpad(row.i::text,7,'0') end,
  c.family_id,c.short_description,c.difficulty,c.exercise_type,c.mechanic,c.force_type,c.laterality
from load_rows row join public.exercise_content c on c.id = row.source_content_id;
insert into public.exercise_muscles(content_id,muscle_id,role)
select row.content_id,r.muscle_id,r.role from load_rows row join public.exercise_muscles r on r.content_id = row.source_content_id;
insert into public.exercise_joints(content_id,joint_id,role)
select row.content_id,r.joint_id,r.role from load_rows row join public.exercise_joints r on r.content_id = row.source_content_id;
insert into public.exercise_joint_actions(content_id,joint_action_id,role)
select row.content_id,r.joint_action_id,r.role from load_rows row join public.exercise_joint_actions r on r.content_id = row.source_content_id;
insert into public.exercise_equipment(content_id,equipment_id,role)
select row.content_id,r.equipment_id,r.role from load_rows row join public.exercise_equipment r on r.content_id = row.source_content_id;
insert into public.exercise_attachments(content_id,attachment_id)
select row.content_id,r.attachment_id from load_rows row join public.exercise_attachments r on r.content_id = row.source_content_id;
insert into public.exercise_movement_patterns(content_id,movement_pattern_id)
select row.content_id,r.movement_pattern_id from load_rows row join public.exercise_movement_patterns r on r.content_id = row.source_content_id;
insert into public.exercise_aliases(content_id,alias,normalized_alias)
select row.content_id,case when c.name ilike '%lateral raise%' then 'Side lift' else c.name || ' alternative' end,
  case when c.name ilike '%lateral raise%' then 'side lift' else lower(c.name) || ' alternative' end
from load_rows row join public.exercise_content c on c.id = row.source_content_id where row.i % 10 < 3;
insert into public.exercise_biomechanics(content_id,body_position_id,plane_id,resistance_source_id,resistance_profile,peak_resistance_position,classification_confidence)
select row.content_id,r.body_position_id,r.plane_id,r.resistance_source_id,r.resistance_profile,r.peak_resistance_position,r.classification_confidence
from load_rows row join public.exercise_biomechanics r on r.content_id = row.source_content_id;
insert into public.exercise_media(content_id,asset_group_id,kind,storage_bucket,storage_path,license_name)
select content_id,md5('catalog-load-media-' || i)::uuid,'webm','benchmark-only',exercise_id::text || '.webm',
  'Synthetic load-test metadata' from load_rows;
update public.exercise_content set kind = 'published_version' where id in(select content_id from load_rows);
insert into public.exercises(id,slug,current_content_id,status,favorite_count,published_at)
select exercise_id,'load-variation-' || i,content_id,'pending_media',
  case when i % 100 < 90 then 0 when i % 100 < 99 then i % 20 + 1 else 100 + i % 900 end,
  timestamptz '2026-01-01 00:00:00+00' - (i % 730) * interval '1 day'
from load_rows;
insert into public.exercise_versions(exercise_id,version_number,content_id)
select exercise_id,1,content_id from load_rows;
-- Use an independent modulus so unpublished status does not remove the alias cohort.
update public.exercises set status = 'published' where id in(select exercise_id from load_rows
  where i <= (select count(*) from load_sources) or i % 11 <> 0);
commit;
analyze;
select jsonb_build_object(
  'syntheticRows',(select count(*) from load_rows),
  'sourceExercises',(select count(*) from load_sources),
  'published',(select count(*) from public.exercises where status = 'published'),
  'unpublished',(select count(*) from public.exercises where status <> 'published'),
  'aliases',(select count(*) from public.exercise_aliases),
  'topFamilies',(select jsonb_agg(row_to_json(f)) from (select family.slug,count(*) total
    from public.exercises e join public.exercise_content c on c.id=e.current_content_id
    join public.exercise_families family on family.id=c.family_id group by family.slug order by count(*) desc limit 8) f)
);
