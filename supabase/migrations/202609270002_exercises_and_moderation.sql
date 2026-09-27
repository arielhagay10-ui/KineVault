create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null
);
create index roles_role_idx on public.roles (role);

create table public.exercise_content (
  id uuid primary key default gen_random_uuid(),
  kind public.content_kind not null,
  owner_id uuid references auth.users(id) on delete set null,
  family_id uuid references public.exercise_families(id) on delete restrict,
  name text not null check (length(btrim(name)) between 2 and 160),
  short_description text,
  setup_instructions text,
  execution_instructions text,
  form_cues text,
  common_mistakes text,
  safety_notes text,
  range_of_motion_notes text,
  difficulty public.exercise_difficulty,
  exercise_type public.exercise_type,
  mechanic public.exercise_mechanic,
  force_type public.force_type,
  laterality public.laterality,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint private_content_has_owner check (kind <> 'private_draft' or owner_id is not null)
);
create index exercise_content_family_id_idx on public.exercise_content (family_id);
create index exercise_content_owner_kind_idx on public.exercise_content (owner_id, kind);

create table public.exercise_biomechanics (
  content_id uuid primary key references public.exercise_content(id) on delete cascade,
  body_position_id uuid references public.body_positions(id) on delete restrict,
  grip_id uuid references public.grips(id) on delete restrict,
  stance_id uuid references public.stances(id) on delete restrict,
  plane_id uuid references public.planes_of_motion(id) on delete restrict,
  resistance_source_id uuid references public.resistance_sources(id) on delete restrict,
  resistance_profile public.resistance_profile not null default 'unknown',
  peak_resistance_position public.peak_resistance_position not null default 'unknown',
  classification_confidence public.classification_confidence,
  reviewer_notes text
);

create table public.exercise_aliases (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.exercise_content(id) on delete cascade,
  alias text not null check (length(btrim(alias)) between 2 and 160),
  normalized_alias text not null check (length(normalized_alias) > 0),
  unique (content_id, normalized_alias)
);
create index exercise_aliases_normalized_alias_idx on public.exercise_aliases (normalized_alias);
create index exercise_aliases_trgm_idx on public.exercise_aliases using gin (normalized_alias extensions.gin_trgm_ops);

create table public.exercise_muscles (
  content_id uuid not null references public.exercise_content(id) on delete cascade,
  muscle_id uuid not null references public.muscles(id) on delete restrict,
  role public.muscle_role not null,
  notes text,
  primary key (content_id, muscle_id)
);
create index exercise_muscles_filter_idx on public.exercise_muscles (muscle_id, role, content_id);

create table public.exercise_joints (
  content_id uuid not null references public.exercise_content(id) on delete cascade,
  joint_id uuid not null references public.joints(id) on delete restrict,
  role public.joint_role not null,
  notes text,
  primary key (content_id, joint_id)
);
create index exercise_joints_filter_idx on public.exercise_joints (joint_id, role, content_id);

create table public.exercise_joint_actions (
  content_id uuid not null references public.exercise_content(id) on delete cascade,
  joint_action_id uuid not null references public.joint_actions(id) on delete restrict,
  role public.joint_role not null,
  notes text,
  primary key (content_id, joint_action_id)
);
create index exercise_joint_actions_filter_idx on public.exercise_joint_actions (joint_action_id, role, content_id);

create table public.exercise_equipment (
  content_id uuid not null references public.exercise_content(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete restrict,
  role public.equipment_role not null default 'required',
  notes text,
  primary key (content_id, equipment_id)
);
create index exercise_equipment_filter_idx on public.exercise_equipment (equipment_id, content_id);

create table public.exercise_attachments (
  content_id uuid not null references public.exercise_content(id) on delete cascade,
  attachment_id uuid not null references public.attachments(id) on delete restrict,
  notes text,
  primary key (content_id, attachment_id)
);
create index exercise_attachments_filter_idx on public.exercise_attachments (attachment_id, content_id);

create table public.exercise_movement_patterns (
  content_id uuid not null references public.exercise_content(id) on delete cascade,
  movement_pattern_id uuid not null references public.movement_patterns(id) on delete restrict,
  primary key (content_id, movement_pattern_id)
);
create index exercise_movement_patterns_filter_idx on public.exercise_movement_patterns (movement_pattern_id, content_id);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  current_content_id uuid not null unique references public.exercise_content(id) on delete restrict,
  status public.publication_status not null default 'pending_media',
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  favorite_count integer not null default 0 check (favorite_count >= 0),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint published_has_date check (status <> 'published' or published_at is not null)
);
create index exercises_status_published_idx on public.exercises (published_at desc, id) where status = 'published';
create index exercises_status_popular_idx on public.exercises (favorite_count desc, id) where status = 'published';

create table public.exercise_relations (
  id uuid primary key default gen_random_uuid(),
  source_exercise_id uuid not null references public.exercises(id) on delete cascade,
  target_exercise_id uuid not null references public.exercises(id) on delete cascade,
  relation_type public.exercise_relation_type not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (source_exercise_id, target_exercise_id, relation_type),
  constraint exercise_relations_no_self check (source_exercise_id <> target_exercise_id),
  constraint symmetric_relation_order check (
    relation_type not in ('similar_to', 'same_movement_pattern_as', 'alternative_equipment_for')
    or source_exercise_id < target_exercise_id
  )
);
create unique index exercise_one_variation_parent_idx on public.exercise_relations (source_exercise_id)
  where relation_type = 'variation_of';
create index exercise_relations_target_type_idx on public.exercise_relations (target_exercise_id, relation_type);

create table public.private_exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null unique references public.exercise_content(id) on delete restrict,
  copied_from_exercise_id uuid references public.exercises(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index private_exercises_owner_updated_idx on public.private_exercises (owner_id, updated_at desc);

create table public.exercise_submissions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  source_private_exercise_id uuid references public.private_exercises(id) on delete set null,
  original_content_id uuid not null unique references public.exercise_content(id) on delete restrict,
  editorial_content_id uuid unique references public.exercise_content(id) on delete restrict,
  status public.submission_status not null default 'draft',
  related_exercise_id uuid references public.exercises(id) on delete set null,
  merged_into_exercise_id uuid references public.exercises(id) on delete set null,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index exercise_submissions_owner_updated_idx on public.exercise_submissions (owner_id, updated_at desc);
create index exercise_submissions_queue_idx on public.exercise_submissions (status, submitted_at, id)
  where status in ('submitted', 'in_review', 'changes_requested');

create table public.exercise_versions (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  content_id uuid not null unique references public.exercise_content(id) on delete restrict,
  source_submission_id uuid references public.exercise_submissions(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now(),
  unique (exercise_id, version_number)
);
create index exercise_versions_exercise_published_idx on public.exercise_versions (exercise_id, published_at desc);

create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);
create index favorites_exercise_id_idx on public.favorites (exercise_id);

create table public.taxonomy_suggestions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.exercise_submissions(id) on delete cascade,
  taxonomy_name text not null check (taxonomy_name in (
    'muscles', 'joints', 'joint_actions', 'equipment', 'equipment_categories',
    'attachments', 'movement_patterns', 'exercise_families'
  )),
  suggested_name text not null check (length(btrim(suggested_name)) between 2 and 120),
  explanation text,
  created_at timestamptz not null default now()
);
create index taxonomy_suggestions_submission_idx on public.taxonomy_suggestions (submission_id);

create table public.moderation_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.exercise_submissions(id) on delete restrict,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  action public.moderation_action not null check (action in ('request_changes', 'approve', 'reject', 'merge')),
  reason public.moderation_reason,
  comment text,
  created_at timestamptz not null default now()
);
create index moderation_reviews_submission_created_idx on public.moderation_reviews (submission_id, created_at desc);

create table public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.exercise_submissions(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action public.moderation_action not null,
  from_status public.submission_status,
  to_status public.submission_status not null,
  reason public.moderation_reason,
  comment text,
  created_at timestamptz not null default now()
);
create index moderation_events_submission_created_idx on public.moderation_events (submission_id, created_at, id);

create or replace function private.reject_variation_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.relation_type <> 'variation_of' then
    return new;
  end if;
  if exists (
    with recursive ancestors(id) as (
      select new.target_exercise_id
      union all
      select r.target_exercise_id
      from public.exercise_relations r
      join ancestors a on r.source_exercise_id = a.id
      where r.relation_type = 'variation_of' and r.id is distinct from new.id
    )
    select 1 from ancestors where id = new.source_exercise_id
  ) then
    raise exception 'variation relationship would create a cycle';
  end if;
  return new;
end;
$$;

create trigger reject_variation_cycle
before insert or update on public.exercise_relations
for each row execute function private.reject_variation_cycle();

create or replace function private.update_favorite_count()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.exercises set favorite_count = favorite_count + 1 where id = new.exercise_id;
    return new;
  end if;
  update public.exercises set favorite_count = favorite_count - 1 where id = old.exercise_id;
  return old;
end;
$$;

create trigger update_favorite_count
after insert or delete on public.favorites
for each row execute function private.update_favorite_count();
