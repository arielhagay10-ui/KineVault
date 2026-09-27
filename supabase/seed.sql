-- Original development data. Catalog candidates stay private until an original
-- character demonstration has been reviewed and published.

insert into public.muscles (slug, name) values
  ('pectoralis-major', 'Pectoralis Major'),
  ('anterior-deltoid', 'Anterior Deltoid'),
  ('lateral-deltoid', 'Lateral Deltoid'),
  ('posterior-deltoid', 'Posterior Deltoid'),
  ('triceps-brachii', 'Triceps Brachii'),
  ('biceps-brachii', 'Biceps Brachii'),
  ('brachialis', 'Brachialis'),
  ('latissimus-dorsi', 'Latissimus Dorsi'),
  ('trapezius', 'Trapezius'),
  ('quadriceps', 'Quadriceps'),
  ('gluteus-maximus', 'Gluteus Maximus'),
  ('hamstrings', 'Hamstrings'),
  ('erector-spinae', 'Erector Spinae'),
  ('gastrocnemius', 'Gastrocnemius'),
  ('soleus', 'Soleus')
on conflict (slug) do nothing;

insert into public.joints (slug, name) values
  ('shoulder', 'Shoulder'),
  ('scapulothoracic', 'Scapulothoracic Articulation'),
  ('elbow', 'Elbow'),
  ('forearm', 'Radioulnar / Forearm'),
  ('wrist', 'Wrist'),
  ('hip', 'Hip'),
  ('knee', 'Knee'),
  ('ankle', 'Ankle'),
  ('spine', 'Spine'),
  ('cervical-spine', 'Cervical Spine'),
  ('thoracic-spine', 'Thoracic Spine'),
  ('lumbar-spine', 'Lumbar Spine')
on conflict (slug) do nothing;

update public.joints child set parent_id = parent.id
from public.joints parent
where parent.slug = 'spine' and child.slug in ('cervical-spine', 'thoracic-spine', 'lumbar-spine');

insert into public.joint_actions (joint_id, slug, name)
select j.id, a.slug, a.name
from (values
  ('shoulder', 'shoulder-flexion', 'Flexion'),
  ('shoulder', 'shoulder-extension', 'Extension'),
  ('shoulder', 'shoulder-abduction', 'Abduction'),
  ('shoulder', 'shoulder-adduction', 'Adduction'),
  ('shoulder', 'shoulder-horizontal-abduction', 'Horizontal Abduction'),
  ('shoulder', 'shoulder-horizontal-adduction', 'Horizontal Adduction'),
  ('shoulder', 'shoulder-internal-rotation', 'Internal Rotation'),
  ('shoulder', 'shoulder-external-rotation', 'External Rotation'),
  ('elbow', 'elbow-flexion', 'Flexion'),
  ('elbow', 'elbow-extension', 'Extension'),
  ('forearm', 'forearm-pronation', 'Pronation'),
  ('forearm', 'forearm-supination', 'Supination'),
  ('wrist', 'wrist-flexion', 'Flexion'),
  ('wrist', 'wrist-extension', 'Extension'),
  ('hip', 'hip-flexion', 'Flexion'),
  ('hip', 'hip-extension', 'Extension'),
  ('hip', 'hip-abduction', 'Abduction'),
  ('hip', 'hip-adduction', 'Adduction'),
  ('hip', 'hip-internal-rotation', 'Internal Rotation'),
  ('hip', 'hip-external-rotation', 'External Rotation'),
  ('knee', 'knee-flexion', 'Flexion'),
  ('knee', 'knee-extension', 'Extension'),
  ('ankle', 'ankle-plantarflexion', 'Plantarflexion'),
  ('ankle', 'ankle-dorsiflexion', 'Dorsiflexion'),
  ('scapulothoracic', 'scapular-elevation', 'Elevation'),
  ('scapulothoracic', 'scapular-depression', 'Depression'),
  ('scapulothoracic', 'scapular-protraction', 'Protraction'),
  ('scapulothoracic', 'scapular-retraction', 'Retraction'),
  ('scapulothoracic', 'scapular-upward-rotation', 'Upward Rotation'),
  ('scapulothoracic', 'scapular-downward-rotation', 'Downward Rotation'),
  ('spine', 'spinal-flexion', 'Flexion'),
  ('spine', 'spinal-extension', 'Extension'),
  ('spine', 'spinal-rotation', 'Rotation'),
  ('spine', 'spinal-lateral-flexion', 'Lateral Flexion')
) as a(joint_slug, slug, name)
join public.joints j on j.slug = a.joint_slug
on conflict (slug) do nothing;

insert into public.equipment_categories (slug, name) values
  ('free-weight', 'Free Weight'), ('cable', 'Cable'),
  ('machine', 'Machine'), ('bodyweight', 'Bodyweight')
on conflict (slug) do nothing;

insert into public.equipment (category_id, slug, name)
select c.id, e.slug, e.name
from (values
  ('free-weight', 'barbell', 'Barbell'),
  ('free-weight', 'dumbbell', 'Dumbbell'),
  ('free-weight', 'ez-bar', 'EZ Bar'),
  ('free-weight', 'kettlebell', 'Kettlebell'),
  ('cable', 'cable', 'Cable'),
  ('cable', 'single-cable', 'Single Cable'),
  ('cable', 'dual-cable', 'Dual Cable'),
  ('machine', 'lat-pulldown-machine', 'Lat Pulldown Machine'),
  ('machine', 'lateral-raise-machine', 'Lateral Raise Machine'),
  ('machine', 'leg-extension-machine', 'Leg Extension Machine'),
  ('machine', 'leg-curl-machine', 'Leg Curl Machine'),
  ('machine', 'calf-raise-machine', 'Calf Raise Machine'),
  ('bodyweight', 'bodyweight', 'Bodyweight'),
  ('bodyweight', 'pull-up-bar', 'Pull-Up Bar')
) as e(category_slug, slug, name)
join public.equipment_categories c on c.slug = e.category_slug
on conflict (slug) do nothing;

update public.equipment child set parent_id = parent.id
from public.equipment parent
where parent.slug = 'cable' and child.slug in ('single-cable', 'dual-cable');

insert into public.attachments (slug, name) values
  ('rope', 'Rope'), ('d-handle', 'D-Handle'),
  ('straight-bar', 'Straight Bar'), ('ez-attachment', 'EZ Attachment'),
  ('lat-bar', 'Lat Bar'), ('ankle-cuff', 'Ankle Cuff'),
  ('v-handle', 'V-Handle')
on conflict (slug) do nothing;

insert into public.movement_patterns (slug, name) values
  ('horizontal-push', 'Horizontal Push'),
  ('horizontal-pull', 'Horizontal Pull'),
  ('vertical-push', 'Vertical Push'),
  ('vertical-pull', 'Vertical Pull'),
  ('squat', 'Squat'), ('hip-hinge', 'Hip Hinge'),
  ('lunge', 'Lunge'), ('carry', 'Carry'),
  ('rotation', 'Rotation'), ('anti-rotation', 'Anti-Rotation'),
  ('spinal-flexion', 'Spinal Flexion'),
  ('spinal-extension', 'Spinal Extension'),
  ('isolation', 'Isolation'), ('other', 'Other')
on conflict (slug) do nothing;

insert into public.exercise_families (slug, name) values
  ('bench-press', 'Bench Press'),
  ('squat', 'Squat'),
  ('deadlift', 'Deadlift'),
  ('pull-up', 'Pull-Up'),
  ('lat-pulldown', 'Lat Pulldown'),
  ('lateral-raise', 'Lateral Raise'),
  ('curl', 'Curl'),
  ('triceps-extension', 'Triceps Extension'),
  ('leg-extension', 'Leg Extension'),
  ('leg-curl', 'Leg Curl'),
  ('calf-raise', 'Calf Raise'),
  ('shoulder-press', 'Shoulder Press')
on conflict (slug) do nothing;

insert into public.body_positions (slug, name) values
  ('standing', 'Standing'), ('seated', 'Seated'),
  ('supine', 'Supine'), ('prone', 'Prone'),
  ('hanging', 'Hanging')
on conflict (slug) do nothing;
insert into public.grips (slug, name) values
  ('pronated', 'Pronated'), ('supinated', 'Supinated'),
  ('neutral', 'Neutral'), ('mixed', 'Mixed')
on conflict (slug) do nothing;
insert into public.stances (slug, name) values
  ('standard', 'Standard'), ('split', 'Split'),
  ('narrow', 'Narrow'), ('wide', 'Wide')
on conflict (slug) do nothing;
insert into public.planes_of_motion (slug, name) values
  ('sagittal', 'Sagittal'), ('frontal', 'Frontal'),
  ('transverse', 'Transverse'), ('multiplanar', 'Multiplanar')
on conflict (slug) do nothing;
insert into public.resistance_sources (slug, name) values
  ('free-weight', 'Free Weight'), ('cable', 'Cable'),
  ('machine', 'Machine'), ('bodyweight', 'Bodyweight')
on conflict (slug) do nothing;

with seed_exercises(slug, name, family_slug, description, mechanic, force_type, laterality) as (values
  ('barbell-bench-press', 'Barbell Bench Press', 'bench-press', 'A horizontal barbell press performed while lying on a bench.', 'compound', 'push', 'bilateral'),
  ('incline-dumbbell-bench-press', 'Incline Dumbbell Bench Press', 'bench-press', 'A dumbbell press performed on an inclined bench.', 'compound', 'push', 'bilateral'),
  ('barbell-back-squat', 'Barbell Back Squat', 'squat', 'A squat performed with a barbell supported across the upper back.', 'compound', 'push', 'bilateral'),
  ('conventional-deadlift', 'Conventional Deadlift', 'deadlift', 'A floor-to-standing barbell lift using a hip hinge and knee extension.', 'compound', 'pull', 'bilateral'),
  ('barbell-romanian-deadlift', 'Barbell Romanian Deadlift', 'deadlift', 'A barbell hip hinge with a controlled descent and modest knee bend.', 'compound', 'pull', 'bilateral'),
  ('pull-up', 'Pull-Up', 'pull-up', 'A bodyweight vertical pull from a hanging start.', 'compound', 'pull', 'bilateral'),
  ('lat-pulldown', 'Lat Pulldown', 'lat-pulldown', 'A seated cable vertical pull toward the upper chest.', 'compound', 'pull', 'bilateral'),
  ('dumbbell-lateral-raise', 'Dumbbell Lateral Raise', 'lateral-raise', 'A standing arm raise with dumbbells moving outward to the sides.', 'isolation', 'pull', 'bilateral'),
  ('cable-lateral-raise', 'Cable Lateral Raise', 'lateral-raise', 'A lateral arm raise using a cable for external resistance.', 'isolation', 'pull', 'unilateral'),
  ('behind-body-cable-lateral-raise', 'Behind-Body Cable Lateral Raise', 'lateral-raise', 'A cable lateral raise with the handle starting behind the body.', 'isolation', 'pull', 'unilateral'),
  ('cross-body-cable-lateral-raise', 'Cross-Body Cable Lateral Raise', 'lateral-raise', 'A cable lateral raise beginning across the front of the body.', 'isolation', 'pull', 'unilateral'),
  ('machine-lateral-raise', 'Machine Lateral Raise', 'lateral-raise', 'A lateral raise guided by a dedicated machine.', 'isolation', 'pull', 'bilateral'),
  ('barbell-curl', 'Barbell Curl', 'curl', 'An elbow-flexion exercise performed with a barbell.', 'isolation', 'pull', 'bilateral'),
  ('dumbbell-curl', 'Dumbbell Curl', 'curl', 'An elbow-flexion exercise performed with dumbbells.', 'isolation', 'pull', 'bilateral'),
  ('cable-triceps-pushdown', 'Cable Triceps Pushdown', 'triceps-extension', 'An elbow-extension exercise with a high cable.', 'isolation', 'push', 'bilateral'),
  ('overhead-cable-triceps-extension', 'Overhead Cable Triceps Extension', 'triceps-extension', 'An overhead elbow-extension exercise with a cable.', 'isolation', 'push', 'bilateral'),
  ('leg-extension', 'Leg Extension', 'leg-extension', 'A seated knee-extension exercise using a machine.', 'isolation', 'push', 'bilateral'),
  ('seated-leg-curl', 'Seated Leg Curl', 'leg-curl', 'A seated knee-flexion exercise using a machine.', 'isolation', 'pull', 'bilateral'),
  ('standing-calf-raise', 'Standing Calf Raise', 'calf-raise', 'A standing ankle-plantarflexion exercise.', 'isolation', 'push', 'bilateral'),
  ('dumbbell-shoulder-press', 'Dumbbell Shoulder Press', 'shoulder-press', 'An overhead press performed with dumbbells.', 'compound', 'push', 'bilateral')
)
insert into public.exercise_content (kind, family_id, name, short_description, mechanic, force_type, laterality, difficulty, exercise_type)
select 'catalog_candidate', f.id, s.name, s.description,
  s.mechanic::public.exercise_mechanic,
  s.force_type::public.force_type,
  s.laterality::public.laterality,
  'intermediate', 'strength'
from seed_exercises s
join public.exercise_families f on f.slug = s.family_slug;

insert into public.exercises (slug, current_content_id, status)
select lower(regexp_replace(c.name, '[^a-zA-Z0-9]+', '-', 'g')), c.id, 'pending_media'
from public.exercise_content c
where c.kind = 'catalog_candidate';

insert into public.exercise_relations (source_exercise_id, target_exercise_id, relation_type)
select child.id, parent.id, 'variation_of'
from (values
  ('behind-body-cable-lateral-raise', 'cable-lateral-raise'),
  ('cross-body-cable-lateral-raise', 'cable-lateral-raise'),
  ('barbell-romanian-deadlift', 'conventional-deadlift')
) as r(child_slug, parent_slug)
join public.exercises child on child.slug = r.child_slug
join public.exercises parent on parent.slug = r.parent_slug;

insert into public.exercise_muscles (content_id, muscle_id, role)
select e.current_content_id, m.id, r.role::public.muscle_role
from (values
  ('barbell-bench-press', 'pectoralis-major', 'primary'), ('barbell-bench-press', 'triceps-brachii', 'secondary'),
  ('incline-dumbbell-bench-press', 'pectoralis-major', 'primary'), ('incline-dumbbell-bench-press', 'anterior-deltoid', 'secondary'),
  ('barbell-back-squat', 'quadriceps', 'primary'), ('barbell-back-squat', 'gluteus-maximus', 'secondary'),
  ('conventional-deadlift', 'gluteus-maximus', 'primary'), ('conventional-deadlift', 'hamstrings', 'secondary'),
  ('barbell-romanian-deadlift', 'hamstrings', 'primary'), ('barbell-romanian-deadlift', 'gluteus-maximus', 'secondary'),
  ('pull-up', 'latissimus-dorsi', 'primary'), ('pull-up', 'biceps-brachii', 'secondary'),
  ('lat-pulldown', 'latissimus-dorsi', 'primary'), ('lat-pulldown', 'biceps-brachii', 'secondary'),
  ('dumbbell-lateral-raise', 'lateral-deltoid', 'primary'),
  ('cable-lateral-raise', 'lateral-deltoid', 'primary'),
  ('behind-body-cable-lateral-raise', 'lateral-deltoid', 'primary'),
  ('cross-body-cable-lateral-raise', 'lateral-deltoid', 'primary'),
  ('machine-lateral-raise', 'lateral-deltoid', 'primary'),
  ('barbell-curl', 'biceps-brachii', 'primary'), ('barbell-curl', 'brachialis', 'secondary'),
  ('dumbbell-curl', 'biceps-brachii', 'primary'), ('dumbbell-curl', 'brachialis', 'secondary'),
  ('cable-triceps-pushdown', 'triceps-brachii', 'primary'),
  ('overhead-cable-triceps-extension', 'triceps-brachii', 'primary'),
  ('leg-extension', 'quadriceps', 'primary'),
  ('seated-leg-curl', 'hamstrings', 'primary'),
  ('standing-calf-raise', 'gastrocnemius', 'primary'), ('standing-calf-raise', 'soleus', 'secondary'),
  ('dumbbell-shoulder-press', 'anterior-deltoid', 'primary'), ('dumbbell-shoulder-press', 'triceps-brachii', 'secondary')
) as r(exercise_slug, muscle_slug, role)
join public.exercises e on e.slug = r.exercise_slug
join public.muscles m on m.slug = r.muscle_slug;

insert into public.exercise_joint_actions (content_id, joint_action_id, role)
select e.current_content_id, a.id, r.role::public.joint_role
from (values
  ('barbell-bench-press', 'shoulder-horizontal-adduction', 'primary'), ('barbell-bench-press', 'elbow-extension', 'primary'),
  ('incline-dumbbell-bench-press', 'shoulder-horizontal-adduction', 'primary'), ('incline-dumbbell-bench-press', 'elbow-extension', 'primary'),
  ('barbell-back-squat', 'hip-extension', 'primary'), ('barbell-back-squat', 'knee-extension', 'primary'),
  ('conventional-deadlift', 'hip-extension', 'primary'), ('conventional-deadlift', 'knee-extension', 'primary'),
  ('barbell-romanian-deadlift', 'hip-extension', 'primary'),
  ('pull-up', 'shoulder-adduction', 'primary'), ('pull-up', 'elbow-flexion', 'primary'),
  ('lat-pulldown', 'shoulder-adduction', 'primary'), ('lat-pulldown', 'elbow-flexion', 'primary'),
  ('dumbbell-lateral-raise', 'shoulder-abduction', 'primary'), ('dumbbell-lateral-raise', 'scapular-upward-rotation', 'secondary'),
  ('cable-lateral-raise', 'shoulder-abduction', 'primary'), ('cable-lateral-raise', 'scapular-upward-rotation', 'secondary'),
  ('behind-body-cable-lateral-raise', 'shoulder-abduction', 'primary'), ('behind-body-cable-lateral-raise', 'scapular-upward-rotation', 'secondary'),
  ('cross-body-cable-lateral-raise', 'shoulder-abduction', 'primary'), ('cross-body-cable-lateral-raise', 'scapular-upward-rotation', 'secondary'),
  ('machine-lateral-raise', 'shoulder-abduction', 'primary'),
  ('barbell-curl', 'elbow-flexion', 'primary'),
  ('dumbbell-curl', 'elbow-flexion', 'primary'),
  ('cable-triceps-pushdown', 'elbow-extension', 'primary'),
  ('overhead-cable-triceps-extension', 'elbow-extension', 'primary'),
  ('leg-extension', 'knee-extension', 'primary'),
  ('seated-leg-curl', 'knee-flexion', 'primary'),
  ('standing-calf-raise', 'ankle-plantarflexion', 'primary'),
  ('dumbbell-shoulder-press', 'shoulder-flexion', 'primary'), ('dumbbell-shoulder-press', 'elbow-extension', 'primary')
) as r(exercise_slug, action_slug, role)
join public.exercises e on e.slug = r.exercise_slug
join public.joint_actions a on a.slug = r.action_slug;

insert into public.exercise_joints (content_id, joint_id, role)
select ea.content_id, ja.joint_id,
  case when bool_or(ea.role = 'primary') then 'primary'::public.joint_role
       else 'secondary'::public.joint_role end
from public.exercise_joint_actions ea
join public.joint_actions ja on ja.id = ea.joint_action_id
group by ea.content_id, ja.joint_id;

insert into public.exercise_equipment (content_id, equipment_id)
select e.current_content_id, q.id
from (values
  ('barbell-bench-press', 'barbell'),
  ('incline-dumbbell-bench-press', 'dumbbell'),
  ('barbell-back-squat', 'barbell'),
  ('conventional-deadlift', 'barbell'),
  ('barbell-romanian-deadlift', 'barbell'),
  ('pull-up', 'pull-up-bar'),
  ('lat-pulldown', 'lat-pulldown-machine'),
  ('dumbbell-lateral-raise', 'dumbbell'),
  ('cable-lateral-raise', 'cable'),
  ('behind-body-cable-lateral-raise', 'cable'),
  ('cross-body-cable-lateral-raise', 'cable'),
  ('machine-lateral-raise', 'lateral-raise-machine'),
  ('barbell-curl', 'barbell'),
  ('dumbbell-curl', 'dumbbell'),
  ('cable-triceps-pushdown', 'cable'),
  ('overhead-cable-triceps-extension', 'cable'),
  ('leg-extension', 'leg-extension-machine'),
  ('seated-leg-curl', 'leg-curl-machine'),
  ('standing-calf-raise', 'calf-raise-machine'),
  ('dumbbell-shoulder-press', 'dumbbell')
) as r(exercise_slug, equipment_slug)
join public.exercises e on e.slug = r.exercise_slug
join public.equipment q on q.slug = r.equipment_slug;

insert into public.exercise_attachments (content_id, attachment_id)
select e.current_content_id, a.id
from (values
  ('cable-lateral-raise', 'd-handle'),
  ('behind-body-cable-lateral-raise', 'd-handle'),
  ('cross-body-cable-lateral-raise', 'd-handle'),
  ('cable-triceps-pushdown', 'rope'),
  ('overhead-cable-triceps-extension', 'rope'),
  ('lat-pulldown', 'lat-bar')
) as r(exercise_slug, attachment_slug)
join public.exercises e on e.slug = r.exercise_slug
join public.attachments a on a.slug = r.attachment_slug;

insert into public.exercise_movement_patterns (content_id, movement_pattern_id)
select e.current_content_id, p.id
from (values
  ('barbell-bench-press', 'horizontal-push'),
  ('incline-dumbbell-bench-press', 'horizontal-push'),
  ('barbell-back-squat', 'squat'),
  ('conventional-deadlift', 'hip-hinge'),
  ('barbell-romanian-deadlift', 'hip-hinge'),
  ('pull-up', 'vertical-pull'),
  ('lat-pulldown', 'vertical-pull'),
  ('dumbbell-lateral-raise', 'isolation'),
  ('cable-lateral-raise', 'isolation'),
  ('behind-body-cable-lateral-raise', 'isolation'),
  ('cross-body-cable-lateral-raise', 'isolation'),
  ('machine-lateral-raise', 'isolation'),
  ('barbell-curl', 'isolation'),
  ('dumbbell-curl', 'isolation'),
  ('cable-triceps-pushdown', 'isolation'),
  ('overhead-cable-triceps-extension', 'isolation'),
  ('leg-extension', 'isolation'),
  ('seated-leg-curl', 'isolation'),
  ('standing-calf-raise', 'isolation'),
  ('dumbbell-shoulder-press', 'vertical-push')
) as r(exercise_slug, pattern_slug)
join public.exercises e on e.slug = r.exercise_slug
join public.movement_patterns p on p.slug = r.pattern_slug;

insert into public.exercise_biomechanics (
  content_id, resistance_source_id, resistance_profile,
  peak_resistance_position, classification_confidence, reviewer_notes
)
select e.current_content_id, rs.id,
  case when e.slug = 'dumbbell-lateral-raise' then 'ascending'::public.resistance_profile
       else 'unknown'::public.resistance_profile end,
  case when e.slug = 'dumbbell-lateral-raise' then 'end'::public.peak_resistance_position
       else 'unknown'::public.peak_resistance_position end,
  case when e.slug = 'dumbbell-lateral-raise' then 'medium'::public.classification_confidence
       else 'low'::public.classification_confidence end,
  'Development classification; review setup and equipment geometry before publication.'
from public.exercises e
join public.exercise_equipment ee on ee.content_id = e.current_content_id
join public.equipment q on q.id = ee.equipment_id
join public.resistance_sources rs on rs.slug = (
  case when q.slug = 'pull-up-bar' then 'bodyweight'
       when q.slug in ('barbell', 'dumbbell') then 'free-weight'
       when q.slug = 'cable' then 'cable'
       else 'machine' end
);

insert into public.exercise_aliases (content_id, alias, normalized_alias)
select e.current_content_id, a.alias, a.normalized_alias
from (values
  ('barbell-romanian-deadlift', 'Romanian Deadlift', 'romanian deadlift'),
  ('barbell-romanian-deadlift', 'RDL', 'rdl'),
  ('barbell-romanian-deadlift', 'Barbell RDL', 'barbell rdl'),
  ('cable-triceps-pushdown', 'Triceps Pressdown', 'triceps pressdown'),
  ('pull-up', 'Pullup', 'pullup')
) as a(exercise_slug, alias, normalized_alias)
join public.exercises e on e.slug = a.exercise_slug;
