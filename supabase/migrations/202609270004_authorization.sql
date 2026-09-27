create or replace function private.has_role(required public.app_role)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.roles
    where user_id = (select auth.uid())
      and (role = required or role = 'admin')
  );
$$;

create or replace function private.is_reviewer()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select (select private.has_role('reviewer'));
$$;

create or replace function private.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select (select private.has_role('admin'));
$$;

create or replace function private.can_read_submission(target_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select (select private.is_reviewer()) or exists (
    select 1 from public.exercise_submissions
    where id = target_id and owner_id = (select auth.uid())
  );
$$;

create or replace function private.can_read_content(target_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.exercise_content
    where id = target_id and kind = 'private_draft' and owner_id = (select auth.uid())
  ) or exists (
    select 1 from public.exercises
    where current_content_id = target_id and status = 'published'
  ) or exists (
    select 1 from public.private_exercises
    where content_id = target_id and owner_id = (select auth.uid())
  ) or exists (
    select 1 from public.exercise_submissions
    where owner_id = (select auth.uid())
      and (original_content_id = target_id or editorial_content_id = target_id)
  ) or (
    (select private.is_reviewer()) and exists (
      select 1 from public.exercise_submissions
      where original_content_id = target_id or editorial_content_id = target_id
    )
  );
$$;

create or replace function private.can_edit_content(target_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.exercise_content
    where id = target_id and kind = 'private_draft' and owner_id = (select auth.uid())
  ) or (
    (select private.is_reviewer()) and exists (
      select 1 from public.exercise_submissions s
      join public.exercise_content c on c.id = s.editorial_content_id
      where c.id = target_id and c.kind = 'submission_editorial'
    )
  );
$$;

create or replace function private.can_read_scene(target_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.exercise_scenes
    where id = target_id and (select private.can_read_content(content_id))
  );
$$;

create or replace function private.can_edit_scene(target_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.exercise_scenes
    where id = target_id and (select private.can_edit_content(content_id))
  );
$$;

create or replace function private.can_read_keyframe(target_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.motion_keyframes
    where id = target_id and (select private.can_read_scene(scene_id))
  );
$$;

create or replace function private.can_edit_keyframe(target_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.motion_keyframes
    where id = target_id and (select private.can_edit_scene(scene_id))
  );
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  insert into public.roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'roles', 'exercise_content', 'exercise_biomechanics',
    'exercise_aliases', 'exercise_muscles', 'exercise_joints',
    'exercise_joint_actions', 'exercise_equipment', 'exercise_attachments',
    'exercise_movement_patterns', 'exercises', 'exercise_relations',
    'private_exercises', 'exercise_submissions', 'exercise_versions',
    'favorites', 'taxonomy_suggestions', 'moderation_reviews',
    'moderation_events', 'rigs', 'rig_joints', 'equipment_assets',
    'exercise_scenes', 'scene_equipment', 'motion_keyframes',
    'motion_joint_poses', 'motion_phase_annotations', 'render_jobs',
    'exercise_media', 'submission_media', 'muscles', 'joints',
    'joint_actions', 'equipment_categories', 'equipment', 'attachments',
    'movement_patterns', 'exercise_families', 'body_positions', 'grips',
    'stances', 'planes_of_motion', 'resistance_sources'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
  end loop;
end;
$$;

revoke all on all functions in schema private from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.has_role(public.app_role) to anon, authenticated;
grant execute on function private.is_reviewer() to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.can_read_submission(uuid) to anon, authenticated;
grant execute on function private.can_read_content(uuid) to anon, authenticated;
grant execute on function private.can_edit_content(uuid) to authenticated;
grant execute on function private.can_read_scene(uuid) to anon, authenticated;
grant execute on function private.can_edit_scene(uuid) to authenticated;
grant execute on function private.can_read_keyframe(uuid) to anon, authenticated;
grant execute on function private.can_edit_keyframe(uuid) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'muscles', 'joints', 'joint_actions', 'equipment_categories',
    'equipment', 'attachments', 'movement_patterns', 'exercise_families',
    'body_positions', 'grips', 'stances', 'planes_of_motion',
    'resistance_sources'
  ] loop
    execute format('grant select on public.%I to anon, authenticated', table_name);
    execute format('grant insert, update, delete on public.%I to authenticated', table_name);
    execute format('create policy taxonomy_read on public.%I for select to anon, authenticated using (true)', table_name);
    execute format('create policy taxonomy_insert on public.%I for insert to authenticated with check ((select private.is_admin()))', table_name);
    execute format('create policy taxonomy_update on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', table_name);
    execute format('create policy taxonomy_delete on public.%I for delete to authenticated using ((select private.is_admin()))', table_name);
  end loop;
end;
$$;

grant select, update on public.profiles to authenticated;
create policy profiles_read on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_reviewer()));
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select on public.roles to authenticated;
create policy roles_read on public.roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

grant select on public.exercise_content to anon, authenticated;
grant insert, update, delete on public.exercise_content to authenticated;
create policy content_read on public.exercise_content for select to anon, authenticated
  using ((select private.can_read_content(id)));
create policy content_insert on public.exercise_content for insert to authenticated
  with check (kind = 'private_draft' and owner_id = (select auth.uid()));
create policy content_update on public.exercise_content for update to authenticated
  using ((select private.can_edit_content(id)))
  with check (
    (kind = 'private_draft' and owner_id = (select auth.uid()))
    or (kind = 'submission_editorial' and (select private.is_reviewer()))
  );
create policy content_delete on public.exercise_content for delete to authenticated
  using (kind = 'private_draft' and owner_id = (select auth.uid()));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'exercise_biomechanics', 'exercise_aliases', 'exercise_muscles',
    'exercise_joints', 'exercise_joint_actions', 'exercise_equipment',
    'exercise_attachments', 'exercise_movement_patterns',
    'exercise_scenes', 'exercise_media'
  ] loop
    execute format('grant select on public.%I to anon, authenticated', table_name);
    execute format('grant insert, update, delete on public.%I to authenticated', table_name);
    execute format('create policy content_child_read on public.%I for select to anon, authenticated using ((select private.can_read_content(content_id)))', table_name);
    execute format('create policy content_child_insert on public.%I for insert to authenticated with check ((select private.can_edit_content(content_id)))', table_name);
    execute format('create policy content_child_update on public.%I for update to authenticated using ((select private.can_edit_content(content_id))) with check ((select private.can_edit_content(content_id)))', table_name);
    execute format('create policy content_child_delete on public.%I for delete to authenticated using ((select private.can_edit_content(content_id)))', table_name);
  end loop;
end;
$$;

grant select on public.exercises to anon, authenticated;
create policy exercises_read on public.exercises for select to anon, authenticated
  using (status = 'published' or (select private.is_reviewer()));

grant select on public.exercise_relations to anon, authenticated;
create policy relations_read on public.exercise_relations for select to anon, authenticated
  using (
    (select private.is_reviewer()) or (
      exists (select 1 from public.exercises e where e.id = source_exercise_id and e.status = 'published')
      and exists (select 1 from public.exercises e where e.id = target_exercise_id and e.status = 'published')
    )
  );

grant select, insert, update, delete on public.private_exercises to authenticated;
create policy private_exercises_read on public.private_exercises for select to authenticated
  using (owner_id = (select auth.uid()));
create policy private_exercises_insert on public.private_exercises for insert to authenticated
  with check (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.exercise_content c
      where c.id = content_id and c.kind = 'private_draft' and c.owner_id = (select auth.uid())
    )
  );
create policy private_exercises_update on public.private_exercises for update to authenticated
  using (owner_id = (select auth.uid())) with check (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.exercise_content c
      where c.id = content_id and c.kind = 'private_draft' and c.owner_id = (select auth.uid())
    )
  );
create policy private_exercises_delete on public.private_exercises for delete to authenticated
  using (owner_id = (select auth.uid()));

grant select on public.exercise_submissions to authenticated;
create policy submissions_read on public.exercise_submissions for select to authenticated
  using ((select private.can_read_submission(id)));

grant select on public.exercise_versions to authenticated;
create policy versions_read on public.exercise_versions for select to authenticated
  using ((select private.is_reviewer()));

grant select, insert, delete on public.favorites to authenticated;
create policy favorites_read on public.favorites for select to authenticated
  using (user_id = (select auth.uid()));
create policy favorites_insert on public.favorites for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.exercises e where e.id = exercise_id and e.status = 'published'
  ));
create policy favorites_delete on public.favorites for delete to authenticated
  using (user_id = (select auth.uid()));

grant select on public.taxonomy_suggestions to authenticated;
create policy suggestions_read on public.taxonomy_suggestions for select to authenticated
  using ((select private.can_read_submission(submission_id)));

grant select on public.moderation_reviews to authenticated;
create policy reviews_read on public.moderation_reviews for select to authenticated
  using ((select private.can_read_submission(submission_id)));
grant select on public.moderation_events to authenticated;
create policy events_read on public.moderation_events for select to authenticated
  using ((select private.can_read_submission(submission_id)));

grant select on public.rigs to anon, authenticated;
create policy rigs_read on public.rigs for select to anon, authenticated
  using (active or (select private.is_reviewer()));
grant select on public.rig_joints to anon, authenticated;
create policy rig_joints_read on public.rig_joints for select to anon, authenticated
  using (exists (select 1 from public.rigs r where r.id = rig_id and (r.active or (select private.is_reviewer()))));
grant select on public.equipment_assets to anon, authenticated;
create policy equipment_assets_read on public.equipment_assets for select to anon, authenticated
  using (active or (select private.is_reviewer()));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'scene_equipment', 'motion_keyframes', 'motion_phase_annotations'
  ] loop
    execute format('grant select on public.%I to anon, authenticated', table_name);
    execute format('grant insert, update, delete on public.%I to authenticated', table_name);
    execute format('create policy scene_child_read on public.%I for select to anon, authenticated using ((select private.can_read_scene(scene_id)))', table_name);
    execute format('create policy scene_child_insert on public.%I for insert to authenticated with check ((select private.can_edit_scene(scene_id)))', table_name);
    execute format('create policy scene_child_update on public.%I for update to authenticated using ((select private.can_edit_scene(scene_id))) with check ((select private.can_edit_scene(scene_id)))', table_name);
    execute format('create policy scene_child_delete on public.%I for delete to authenticated using ((select private.can_edit_scene(scene_id)))', table_name);
  end loop;
end;
$$;

grant select, insert, update, delete on public.motion_joint_poses to authenticated;
grant select on public.motion_joint_poses to anon;
create policy poses_read on public.motion_joint_poses for select to anon, authenticated
  using ((select private.can_read_keyframe(keyframe_id)));
create policy poses_insert on public.motion_joint_poses for insert to authenticated
  with check ((select private.can_edit_keyframe(keyframe_id)));
create policy poses_update on public.motion_joint_poses for update to authenticated
  using ((select private.can_edit_keyframe(keyframe_id)))
  with check ((select private.can_edit_keyframe(keyframe_id)));
create policy poses_delete on public.motion_joint_poses for delete to authenticated
  using ((select private.can_edit_keyframe(keyframe_id)));

grant select on public.render_jobs to authenticated;
create policy render_jobs_read on public.render_jobs for select to authenticated
  using (requested_by = (select auth.uid()) or (select private.is_reviewer()));

grant select on public.submission_media to authenticated;
create policy submission_media_read on public.submission_media for select to authenticated
  using ((select private.can_read_submission(submission_id)));
