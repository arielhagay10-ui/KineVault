create table public.rigs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version integer not null check (version > 0),
  source_storage_path text not null,
  license_name text not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (name, version)
);

create table public.rig_joints (
  id uuid primary key default gen_random_uuid(),
  rig_id uuid not null references public.rigs(id) on delete restrict,
  parent_joint_id uuid references public.rig_joints(id) on delete restrict,
  anatomical_joint_id uuid references public.joints(id) on delete set null,
  slug text not null,
  name text not null,
  min_x_degrees numeric(6,2),
  max_x_degrees numeric(6,2),
  min_y_degrees numeric(6,2),
  max_y_degrees numeric(6,2),
  min_z_degrees numeric(6,2),
  max_z_degrees numeric(6,2),
  unique (rig_id, slug),
  unique (id, rig_id),
  constraint rig_joint_no_self_parent check (id is distinct from parent_joint_id),
  constraint rig_x_range check (min_x_degrees is null or max_x_degrees is null or min_x_degrees <= max_x_degrees),
  constraint rig_y_range check (min_y_degrees is null or max_y_degrees is null or min_y_degrees <= max_y_degrees),
  constraint rig_z_range check (min_z_degrees is null or max_z_degrees is null or min_z_degrees <= max_z_degrees)
);
create index rig_joints_rig_id_idx on public.rig_joints (rig_id);

create table public.equipment_assets (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid references public.equipment(id) on delete restrict,
  attachment_id uuid references public.attachments(id) on delete restrict,
  slug text not null,
  version integer not null check (version > 0),
  source_storage_path text not null,
  license_name text not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (slug, version),
  constraint asset_taxonomy_target check (num_nonnulls(equipment_id, attachment_id) = 1)
);

create table public.exercise_scenes (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null unique references public.exercise_content(id) on delete cascade,
  rig_id uuid not null references public.rigs(id) on delete restrict,
  duration_ms integer not null check (duration_ms between 250 and 60000),
  default_camera_angle public.camera_angle not null default 'three_quarter',
  camera_position_x numeric(9,4) not null default 0,
  camera_position_y numeric(9,4) not null default 1.5,
  camera_position_z numeric(9,4) not null default 3,
  camera_target_x numeric(9,4) not null default 0,
  camera_target_y numeric(9,4) not null default 1,
  camera_target_z numeric(9,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, rig_id)
);

create table public.scene_equipment (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.exercise_scenes(id) on delete cascade,
  asset_id uuid not null references public.equipment_assets(id) on delete restrict,
  anchor_joint_id uuid references public.rig_joints(id) on delete restrict,
  position_x numeric(9,4) not null default 0,
  position_y numeric(9,4) not null default 0,
  position_z numeric(9,4) not null default 0,
  rotation_x numeric(9,6) not null default 0,
  rotation_y numeric(9,6) not null default 0,
  rotation_z numeric(9,6) not null default 0,
  rotation_w numeric(9,6) not null default 1,
  scale numeric(8,4) not null default 1 check (scale > 0)
);
create index scene_equipment_scene_id_idx on public.scene_equipment (scene_id);

create table public.motion_keyframes (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.exercise_scenes(id) on delete cascade,
  position_ms integer not null check (position_ms >= 0),
  phase_label text,
  unique (scene_id, position_ms),
  unique (id, scene_id)
);
create index motion_keyframes_scene_time_idx on public.motion_keyframes (scene_id, position_ms);

create table public.motion_joint_poses (
  keyframe_id uuid not null references public.motion_keyframes(id) on delete cascade,
  rig_joint_id uuid not null references public.rig_joints(id) on delete restrict,
  rotation_x numeric(9,6) not null default 0,
  rotation_y numeric(9,6) not null default 0,
  rotation_z numeric(9,6) not null default 0,
  rotation_w numeric(9,6) not null default 1,
  position_x numeric(9,4) not null default 0,
  position_y numeric(9,4) not null default 0,
  position_z numeric(9,4) not null default 0,
  primary key (keyframe_id, rig_joint_id),
  constraint nonzero_pose_rotation check (
    rotation_x <> 0 or rotation_y <> 0 or rotation_z <> 0 or rotation_w <> 0
  )
);
create index motion_joint_poses_rig_joint_idx on public.motion_joint_poses (rig_joint_id);

create table public.motion_phase_annotations (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.exercise_scenes(id) on delete cascade,
  start_ms integer not null check (start_ms >= 0),
  end_ms integer not null check (end_ms > start_ms),
  joint_action_id uuid references public.joint_actions(id) on delete restrict,
  label text not null,
  note text
);
create index motion_phase_annotations_scene_time_idx on public.motion_phase_annotations (scene_id, start_ms);

create table public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.exercise_scenes(id) on delete restrict,
  status public.render_status not null default 'queued',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  error_code text,
  requested_by uuid references auth.users(id) on delete set null,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create index render_jobs_queue_idx on public.render_jobs (queued_at, id) where status = 'queued';

create table public.exercise_media (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.exercise_content(id) on delete cascade,
  scene_id uuid references public.exercise_scenes(id) on delete set null,
  asset_group_id uuid not null,
  kind public.media_kind not null,
  storage_bucket text not null,
  storage_path text not null,
  camera_angle public.camera_angle,
  character_presentation text not null default 'neutral' check (character_presentation in ('neutral', 'male', 'female')),
  license_name text not null,
  source_credit text,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path),
  unique (asset_group_id, kind)
);
create index exercise_media_content_group_idx on public.exercise_media (content_id, asset_group_id);

create table public.submission_media (
  submission_id uuid not null references public.exercise_submissions(id) on delete cascade,
  media_id uuid not null unique references public.exercise_media(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (submission_id, media_id)
);
