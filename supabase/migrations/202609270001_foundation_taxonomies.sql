create schema if not exists extensions;
create schema if not exists private;
create extension if not exists pg_trgm with schema extensions;

create type public.app_role as enum ('user', 'reviewer', 'admin');
create type public.content_kind as enum ('private_draft', 'submission_original', 'submission_editorial', 'catalog_candidate', 'published_version');
create type public.publication_status as enum ('pending_media', 'published', 'withdrawn');
create type public.muscle_role as enum ('primary', 'secondary', 'stabilizer');
create type public.joint_role as enum ('primary', 'secondary', 'stabilization');
create type public.equipment_role as enum ('required', 'optional');
create type public.exercise_relation_type as enum (
  'variation_of', 'similar_to', 'progression_of', 'regression_of',
  'alternative_equipment_for', 'same_movement_pattern_as'
);
create type public.exercise_difficulty as enum ('beginner', 'intermediate', 'advanced');
create type public.exercise_type as enum ('strength', 'mobility', 'plyometric', 'isometric', 'other');
create type public.exercise_mechanic as enum ('compound', 'isolation');
create type public.force_type as enum ('push', 'pull', 'static', 'mixed');
create type public.laterality as enum ('unilateral', 'bilateral', 'alternating');
create type public.resistance_profile as enum (
  'ascending', 'descending', 'bell_shaped', 'relatively_constant',
  'variable_complex', 'unknown'
);
create type public.peak_resistance_position as enum ('beginning', 'middle', 'end', 'multiple', 'unknown');
create type public.classification_confidence as enum ('low', 'medium', 'high');
create type public.submission_status as enum (
  'draft', 'submitted', 'in_review', 'changes_requested',
  'approved', 'rejected', 'merged', 'withdrawn'
);
create type public.moderation_action as enum (
  'submit', 'begin_review', 'request_changes', 'resubmit',
  'approve', 'reject', 'merge', 'withdraw', 'edit'
);
create type public.moderation_reason as enum (
  'duplicate', 'incorrect_name', 'incorrect_exercise_family',
  'incorrect_primary_muscle', 'incorrect_secondary_muscle',
  'incorrect_joint', 'incorrect_joint_action', 'missing_joint_action',
  'incorrect_equipment', 'incorrect_biomechanics',
  'incorrect_resistance_profile', 'should_be_alias',
  'should_be_variation', 'unsafe_or_unclear_demonstration',
  'poor_media', 'insufficient_information', 'other'
);
create type public.media_kind as enum ('webm', 'mp4', 'poster', 'glb_source', 'gltf_source');
create type public.camera_angle as enum ('front', 'side', 'three_quarter', 'custom');
create type public.render_status as enum ('queued', 'running', 'succeeded', 'failed');

create table public.muscles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  parent_id uuid references public.muscles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint muscles_no_self_parent check (id is distinct from parent_id)
);

create table public.joints (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  parent_id uuid references public.joints(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint joints_no_self_parent check (id is distinct from parent_id)
);

create table public.joint_actions (
  id uuid primary key default gen_random_uuid(),
  joint_id uuid not null references public.joints(id) on delete restrict,
  slug text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (joint_id, name)
);
create index joint_actions_joint_id_idx on public.joint_actions (joint_id);

create table public.equipment_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  parent_id uuid references public.equipment_categories(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint equipment_categories_no_self_parent check (id is distinct from parent_id)
);

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.equipment_categories(id) on delete restrict,
  parent_id uuid references public.equipment(id) on delete restrict,
  slug text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  constraint equipment_no_self_parent check (id is distinct from parent_id)
);
create index equipment_category_id_idx on public.equipment (category_id);
create index equipment_parent_id_idx on public.equipment (parent_id);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.movement_patterns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.exercise_families (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  parent_id uuid references public.exercise_families(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint exercise_families_no_self_parent check (id is distinct from parent_id)
);

create table public.body_positions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);

create table public.grips (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);

create table public.stances (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);

create table public.planes_of_motion (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);

create table public.resistance_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);
