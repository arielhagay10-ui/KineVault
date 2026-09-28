create table public.admin_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  object_type text not null,
  object_id uuid not null,
  operation text not null check(operation in ('INSERT','UPDATE','DELETE')),
  before_value jsonb,
  after_value jsonb,
  comment text,
  created_at timestamptz not null default now()
);
create index admin_events_object_idx on public.admin_events(object_type,object_id,created_at desc);
create trigger immutable_admin_events before update or delete on public.admin_events
for each row execute function private.reject_audit_mutation();
alter table public.admin_events enable row level security;
revoke all on public.admin_events from anon,authenticated;
grant select on public.admin_events to authenticated;
create policy admin_events_read on public.admin_events for select to authenticated using ((select private.is_admin()));

create function private.record_admin_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare old_record jsonb; new_record jsonb; target_id uuid;
begin
  if auth.uid() is not null then
    if tg_op <> 'INSERT' then old_record := to_jsonb(old); end if;
    if tg_op <> 'DELETE' then new_record := to_jsonb(new); end if;
    if old_record is distinct from new_record then
      target_id := coalesce(new_record->>'id',old_record->>'id',new_record->>'user_id',old_record->>'user_id')::uuid;
      insert into public.admin_events(actor_id,object_type,object_id,operation,before_value,after_value,comment)
      values(auth.uid(),tg_table_name,target_id,tg_op,old_record,new_record,nullif(current_setting('app.audit_comment',true),''));
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.record_admin_mutation() from public,anon,authenticated;

create function private.prevent_taxonomy_cycle()
returns trigger language plpgsql set search_path = '' as $$
declare has_cycle boolean;
begin
  if new.parent_id is null then return new; end if;
  execute format('with recursive ancestors as (
    select id,parent_id from public.%I where id = $1
    union select t.id,t.parent_id from public.%I t join ancestors a on t.id = a.parent_id
  ) select exists(select 1 from ancestors where id = $2)',tg_table_name,tg_table_name)
  into has_cycle using new.parent_id,new.id;
  if has_cycle then raise exception 'taxonomy hierarchy cannot contain a cycle'; end if;
  return new;
end;
$$;
create function private.validate_taxonomy_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(new.slug) > 120
    or length(btrim(new.name)) not between 2 and 120 then
    raise exception 'invalid taxonomy name or slug';
  end if;
  if tg_op = 'UPDATE' and old.slug <> new.slug then
    raise exception 'saved taxonomy slugs cannot change';
  end if;
  return new;
end;
$$;
do $$
declare target text;
begin
  foreach target in array array['muscles','joints','equipment_categories','equipment','exercise_families'] loop
    execute format('create trigger taxonomy_cycle before insert or update of parent_id on public.%I for each row execute function private.prevent_taxonomy_cycle()',target);
  end loop;
  foreach target in array array['muscles','joints','joint_actions','equipment_categories','equipment','attachments',
    'movement_patterns','exercise_families','body_positions','grips','stances','planes_of_motion','resistance_sources','rigs','equipment_assets','roles'] loop
    execute format('create trigger record_admin_mutation after insert or update or delete on public.%I for each row execute function private.record_admin_mutation()',target);
  end loop;
  foreach target in array array['muscles','joints','joint_actions','equipment_categories','equipment','attachments',
    'movement_patterns','exercise_families','body_positions','grips','stances','planes_of_motion','resistance_sources'] loop
    execute format('create trigger validate_taxonomy_mutation before insert or update on public.%I for each row execute function private.validate_taxonomy_mutation()',target);
  end loop;
end;
$$;

create function public.assign_application_role(p_user_id uuid,p_role public.app_role,p_comment text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare prior public.app_role;
begin
  if auth.uid() is null or not (select private.is_admin()) then raise exception 'admin role required'; end if;
  if p_role is null or length(btrim(coalesce(p_comment,''))) < 5 or length(p_comment) > 1000 then
    raise exception 'a role and useful reason are required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('kinevault-admin-roles',0));
  select role into prior from public.roles where user_id = p_user_id for update;
  if not found then raise exception 'account not found'; end if;
  if prior = 'admin' and p_role <> 'admin' and (select count(*) from public.roles where role = 'admin') <= 1 then
    raise exception 'the final admin cannot be demoted';
  end if;
  perform set_config('app.audit_comment',btrim(p_comment),true);
  update public.roles set role = p_role,assigned_at = now(),assigned_by = auth.uid() where user_id = p_user_id;
end;
$$;
revoke all on function public.assign_application_role(uuid,public.app_role,text) from public;
grant execute on function public.assign_application_role(uuid,public.app_role,text) to authenticated;

-- Retirement affects new selection; existing source scenes must remain readable.
create index exercise_scenes_rig_idx on public.exercise_scenes(rig_id);
create index scene_equipment_asset_idx on public.scene_equipment(asset_id,scene_id);
create function private.can_read_rig(p_rig_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.rigs where id = p_rig_id and active)
    or (select private.is_reviewer())
    or exists(select 1 from public.exercise_scenes where rig_id = p_rig_id and private.can_read_content(content_id));
$$;
revoke all on function private.can_read_rig(uuid) from public;
grant execute on function private.can_read_rig(uuid) to anon,authenticated;
alter policy rigs_read on public.rigs using ((select private.can_read_rig(id)));
alter policy rig_joints_read on public.rig_joints using ((select private.can_read_rig(rig_id)));
alter policy equipment_assets_read on public.equipment_assets using (
  active or (select private.is_reviewer()) or exists (
    select 1 from public.scene_equipment where asset_id = equipment_assets.id and private.can_read_scene(scene_id)
  )
);
grant update(active) on public.rigs,public.equipment_assets to authenticated;
create policy rigs_admin_update on public.rigs for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy equipment_assets_admin_update on public.equipment_assets for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
