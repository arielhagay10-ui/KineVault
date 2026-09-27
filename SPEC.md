You are the lead full-stack engineer responsible for building an MVP for a community-driven exercise encyclopedia and exercise database.

Working name: KineVault.

The core concept is NOT a workout tracker. It is a comprehensive, searchable and community-expandable database of strength-training and gym exercises.

Users should be able to browse exercises, deeply filter them, save favorites, create private custom exercises, and submit new exercises for inclusion in the global database. Public submissions must go through an admin/reviewer moderation workflow before becoming part of the canonical database.

An important part of this product is biomechanical search. Exercises must be filterable not only by muscles and equipment, but also by anatomical joints and joint actions such as:

- shoulder flexion
- shoulder extension
- shoulder abduction
- shoulder adduction
- shoulder horizontal abduction
- shoulder horizontal adduction
- shoulder internal rotation
- shoulder external rotation
- elbow flexion
- elbow extension
- forearm pronation
- forearm supination
- wrist flexion
- wrist extension
- hip flexion
- hip extension
- hip abduction
- hip adduction
- hip internal rotation
- hip external rotation
- knee flexion
- knee extension
- ankle plantarflexion
- ankle dorsiflexion
- scapular elevation
- scapular depression
- scapular protraction
- scapular retraction
- scapular upward rotation
- scapular downward rotation
- spinal flexion
- spinal extension
- spinal rotation
- spinal lateral flexion

Do not scrape, copy or redistribute exercise data, descriptions, images, animations or videos from proprietary fitness databases. Seed the development database using original placeholder/demo content that can later be replaced with properly licensed/original material.

TECH STACK

Use:

- Next.js latest stable App Router
- TypeScript with strict mode
- React
- Tailwind CSS
- shadcn/ui
- PostgreSQL through Supabase
- Supabase Auth
- Supabase Storage for initial media storage
- PostgreSQL full-text search
- PostgreSQL pg\_trgm for fuzzy exercise-name matching
- Zod for validation
- Vitest for unit/integration testing
- Playwright for end-to-end testing

The application must be responsive and work well on desktop and mobile.

ARCHITECTURAL PRINCIPLES

Keep the exercise database separate from workout tracking.

Do not add:

- workout logging
- social feeds
- calorie tracking
- nutrition
- AI coaching
- unrelated fitness features

Public exercises are canonical shared records.

Users can also create private exercises that belong only to them.

A private exercise can later be submitted as a candidate for the public database.

Public exercise records must support versioning and audit history.

Use normalized relational data rather than storing major taxonomies as arbitrary text.

Use stable UUID identifiers.

Use human-readable slugs for public URLs.

Implement role-based access control with:

- user
- reviewer
- admin

Enforce authorization server-side and with appropriate Supabase RLS policies.

Never rely only on hiding UI elements.

CORE DOMAIN MODEL

Design migrations and TypeScript types for at least:

profiles\
roles

exercise\_families\
exercises\
exercise\_aliases\
exercise\_versions\
exercise\_relations

muscles\
exercise\_muscles

joints\
joint\_actions\
exercise\_joint\_actions

equipment\_categories\
equipment\
exercise\_equipment

attachments\
exercise\_attachments

movement\_patterns\
exercise\_movement\_patterns

exercise\_biomechanics\
exercise\_media

favorites

private\_exercises

exercise\_submissions\
submission\_media\
moderation\_reviews\
moderation\_events

EXERCISE FAMILY VS EXERCISE VARIATION

Exercise families and exercise variations must be modeled separately.

An exercise family represents a general movement concept.

Example:

Lateral Raise

Possible variations:

- Dumbbell Lateral Raise
- Cable Lateral Raise
- Machine Lateral Raise
- Leaning Cable Lateral Raise

Cable Lateral Raise may itself have more specific variations:

- Behind-Body Cable Lateral Raise
- Cross-Body Cable Lateral Raise

Do not treat every exercise name as an unrelated flat record.

The database must support hierarchical relationships.

Example:

Lateral Raise\
├── Dumbbell Lateral Raise\
├── Cable Lateral Raise\
│   ├── Behind-Body Cable Lateral Raise\
│   └── Cross-Body Cable Lateral Raise\
├── Machine Lateral Raise\
└── Leaning Cable Lateral Raise

Exercise relationships must support more than simple parent/child relationships.

Support relationship types such as:

VARIATION\_OF\
SIMILAR\_TO\
PROGRESSION\_OF\
REGRESSION\_OF\
ALTERNATIVE\_EQUIPMENT\_FOR\
SAME\_MOVEMENT\_PATTERN\_AS

Avoid assuming that every variation shares identical biomechanics.

A variation must be able to override:

- muscles
- equipment
- joint actions
- resistance profile
- body position
- grip
- stance
- range of motion
- instructions
- media

CORE EXERCISE FIELDS

Each public exercise should support:

name\
slug\
aliases\
exercise family\
short description\
setup instructions\
execution instructions\
form cues\
common mistakes\
difficulty\
exercise type\
compound/isolation mechanic\
push/pull/static force type\
unilateral/bilateral designation\
body position\
movement pattern\
plane of motion\
primary muscles\
secondary muscles\
stabilizer muscles\
joints involved\
joint actions\
equipment\
attachments\
grip\
stance\
resistance source\
resistance profile\
peak resistance position\
range-of-motion notes\
safety notes\
created by\
reviewed by\
created date\
updated date\
publication status

Do not assume every field applies to every exercise.

Model nullable fields appropriately.

MUSCLE RELATIONSHIPS

exercise\_muscles must include a role enum such as:

PRIMARY\
SECONDARY\
STABILIZER

Do not put muscle names directly into the exercises table.

JOINTS AND JOINT ACTIONS

Joint actions are a first-class part of the product.

They must NOT be stored as a comma-separated string or generic text field.

Create a normalized joints table.

Example joints:

- shoulder
- scapulothoracic articulation
- elbow
- radioulnar / forearm
- wrist
- cervical spine
- thoracic spine
- lumbar spine
- hip
- knee
- ankle

Create a normalized joint\_actions table.

Every joint action must belong to a joint or anatomical region.

Examples:

Shoulder:

- Flexion
- Extension
- Abduction
- Adduction
- Horizontal Abduction
- Horizontal Adduction
- Internal Rotation
- External Rotation

Elbow:

- Flexion
- Extension

Forearm:

- Pronation
- Supination

Hip:

- Flexion
- Extension
- Abduction
- Adduction
- Internal Rotation
- External Rotation

Knee:

- Flexion
- Extension

Ankle:

- Plantarflexion
- Dorsiflexion

Scapula:

- Elevation
- Depression
- Protraction
- Retraction
- Upward Rotation
- Downward Rotation

Spine:

- Flexion
- Extension
- Rotation
- Lateral Flexion

Model exercise\_joint\_actions as a many-to-many relationship.

The relationship should support metadata such as:

exercise\_id\
joint\_action\_id\
role\
notes

Use a role enum similar to:

PRIMARY\
SECONDARY\
STABILIZATION

For example:

Barbell Back Squat:

Primary joint actions:

- Hip Extension
- Knee Extension

Secondary/supporting:

- Ankle Plantarflexion, depending on classification methodology

Barbell Bench Press:

Primary joint actions:

- Shoulder Horizontal Adduction
- Elbow Extension

Cable Lateral Raise:

Primary:

- Shoulder Abduction

Supporting/scapular:

- Scapular Upward Rotation

Barbell Curl:

Primary:

- Elbow Flexion

Potential secondary:

- Forearm Supination depending on technique/grip

Do not automatically infer joint actions only from muscles.

Joint actions must be reviewable exercise metadata because real movements can include multiple joints and technique-dependent differences.

JOINT ACTION FILTERING

Users must be able to filter exercises by joint and joint action.

Examples:

Shoulder\
→ Abduction

Hip\
→ Extension

Elbow\
→ Flexion

Users should also be able to combine joint-action filters with other filters.

Examples:

Shoulder Abduction\
+\
Cable\
+\
Descending Resistance Profile

or:

Hip Extension\
+\
Barbell\
+\
Compound

or:

Elbow Flexion\
+\
Cable\
+\
Unilateral

Support multiple selected joint actions.

The backend/filter architecture should support AND/OR semantics cleanly.

For the initial UI:

- selecting one joint action means exercises containing that action
- selecting multiple actions defaults to exercises containing ALL selected actions
- optionally provide an ANY/ALL selector later

Represent filters in the URL.

Example:

/exercises?jointAction=shoulder-abduction

Multiple:

/exercises?jointAction=hip-extension&jointAction=knee-extension

Combined:

/exercises?jointAction=shoulder-abduction&equipment=cable&muscle=lateral-deltoid

MOVEMENT PATTERNS VS JOINT ACTIONS

Movement patterns and joint actions are different concepts.

Do not merge them.

Example:

Movement Pattern:\
Horizontal Push

Joint Actions:\
Shoulder Horizontal Adduction\
Elbow Extension

Another example:

Movement Pattern:\
Squat

Joint Actions:\
Hip Extension\
Knee Extension

Another example:

Movement Pattern:\
Vertical Pull

Joint Actions may include:\
Shoulder Adduction\
Elbow Flexion\
Scapular Downward Rotation

Keep these as separate taxonomies.

MOVEMENT PATTERNS

Support broad movement patterns such as:

Horizontal Push\
Horizontal Pull\
Vertical Push\
Vertical Pull\
Squat\
Hip Hinge\
Lunge\
Carry\
Rotation\
Anti-Rotation\
Spinal Flexion\
Spinal Extension\
Isolation\
Other

Do not make the movement-pattern taxonomy prevent more detailed joint-action classification.

EQUIPMENT

Equipment should support a hierarchy.

Examples:

Free Weight\
Barbell\
Dumbbell\
EZ Bar\
Kettlebell

Cable\
Single Cable\
Dual Cable\
Functional Trainer

Machine\
Selectorized Machine\
Plate Loaded Machine\
Smith Machine

Bodyweight

Attachments must be modeled separately from equipment.

Example attachments:

- Rope
- D-handle
- Straight bar
- EZ attachment
- Lat bar
- Ankle cuff
- V-handle

RESISTANCE PROFILE

Resistance profile is an important searchable part of the exercise database.

Do not use vague classifications such as "lengthened bias" as the primary resistance-profile system.

Model the external resistance profile across the exercise's range of motion.

Create a resistance_profile field/taxonomy supporting values such as:

ASCENDING
DESCENDING
BELL_SHAPED
RELATIVELY_CONSTANT
VARIABLE_COMPLEX
UNKNOWN

Definitions:

ASCENDING:
The exercise generally becomes more mechanically demanding toward the end of the concentric range of motion.

DESCENDING:
The exercise generally becomes less mechanically demanding toward the end of the concentric range of motion, meaning the greatest external challenge occurs earlier in the movement.

BELL_SHAPED:
The external challenge generally increases toward the middle of the movement and decreases again toward the end.

RELATIVELY_CONSTANT:
The external challenge remains reasonably similar through most of the usable range of motion.

VARIABLE_COMPLEX:
The resistance changes throughout the movement but does not fit cleanly into ascending, descending or bell-shaped classifications.

UNKNOWN:
There is not enough information to classify the resistance profile confidently.

Also optionally model:

peak_resistance_position:

BEGINNING
MIDDLE
END
MULTIPLE
UNKNOWN

Do not automatically derive resistance profile solely from the exercise name.

Resistance profile can depend on:

- equipment geometry
- cable height
- cable direction
- machine cam design
- lever length
- body position
- setup
- range of motion
- execution technique

For exercises performed on machines, different machine models may create different resistance profiles.

Therefore resistance-profile classifications must support reviewer notes and uncertainty.

Example:

Exercise:
Dumbbell Lateral Raise

Resistance profile:
ASCENDING

Peak resistance position:
END

Exercise:
Cable Lateral Raise with cable approximately perpendicular to the arm through the middle of the ROM

Resistance profile:
RELATIVELY_CONSTANT or equipment/setup dependent

Exercise:
A specific cam-based lateral raise machine

Resistance profile:
VARIABLE_COMPLEX

The exact classification should be reviewed rather than assumed solely from the exercise category.

EXERCISE RELATIONSHIPS

Exercises need relationships so the database can represent exercise families and alternatives.

Support relationship types such as:

VARIATION\_OF\
SIMILAR\_TO\
PROGRESSION\_OF\
REGRESSION\_OF\
ALTERNATIVE\_EQUIPMENT\_FOR\
SAME\_MOVEMENT\_PATTERN\_AS

These relationships must be queryable.

The exercise page should eventually be able to display sections such as:

Variations

Similar Exercises

Different Equipment

Easier Variations

Harder Variations

Same Joint Actions

Same Muscle With Different Resistance Profile

ALIASES AND DUPLICATES

Support canonical exercise names and multiple aliases.

Example:

Canonical:\
Barbell Romanian Deadlift

Aliases:\
Romanian Deadlift\
RDL\
Barbell RDL

Before a public submission can be submitted, run duplicate detection.

Implement:

1. normalized exact name comparison
2. alias comparison
3. PostgreSQL pg\_trgm similarity
4. equipment comparison
5. muscle comparison
6. joint-action comparison
7. movement-pattern comparison
8. exercise-family comparison

Display the most likely existing duplicates to the submitting user.

Example:

Submitted:\
Single-Arm Behind-Body Cable Lateral Raise

Possible matches:

Behind-Body Cable Lateral Raise\
94% similarity

Single-Arm Cable Lateral Raise\
88% similarity

Cable Lateral Raise\
79% similarity

The similarity score is only a review aid.

Do not automatically reject fuzzy matches.

A user or reviewer may determine that the exercise is a legitimate variation rather than a duplicate.

MODERATION STATE MACHINE

Implement states similar to:

DRAFT\
PRIVATE\
SUBMITTED\
IN\_REVIEW\
CHANGES\_REQUESTED\
APPROVED\
REJECTED\
MERGED\
WITHDRAWN

A reviewer/admin must be able to:

approve\
request changes\
reject\
merge with an existing exercise

Structured rejection/change reasons should include:

DUPLICATE\
INCORRECT\_NAME\
INCORRECT\_EXERCISE\_FAMILY\
INCORRECT\_PRIMARY\_MUSCLE\
INCORRECT\_SECONDARY\_MUSCLE\
INCORRECT\_JOINT\
INCORRECT\_JOINT\_ACTION\
MISSING\_JOINT\_ACTION\
INCORRECT\_EQUIPMENT\
INCORRECT\_BIOMECHANICS\
INCORRECT\_RESISTANCE\_PROFILE\
SHOULD\_BE\_ALIAS\
SHOULD\_BE\_VARIATION\
UNSAFE\_OR\_UNCLEAR\_DEMONSTRATION\
POOR\_MEDIA\
INSUFFICIENT\_INFORMATION\
OTHER

Allow a reviewer comment.

Record every moderation action in an immutable moderation event history.

MEDIA

Do NOT use animated GIF as the primary media format.

The data model should support:

- WebM
- MP4
- poster image
- optional original GLB/GLTF animation source for future 3D support

Each exercise may eventually contain:

- male front view
- male side view
- male 45-degree view
- female front view
- female side view
- female 45-degree view

For the MVP it is acceptable for exercises to have fewer media assets.

Use HTML video configured for:

autoplay\
muted\
loop\
playsInline

Implement MP4 fallback when WebM is unavailable.

Do not build automatic 3D exercise animation generation in this MVP.

Design the media schema so GLB source assets and additional generated formats can be added later without redesigning the database.

SEARCH AND FILTERING

Create a fast Explore page.

Search should match:

- canonical exercise name
- aliases
- description

Filters should include:

ANATOMY

- primary muscle
- secondary muscle
- stabilizer muscle
- joint
- joint action

MOVEMENT

- exercise family
- movement pattern
- plane of motion
- compound/isolation
- force type
- laterality

EQUIPMENT

- equipment category
- equipment
- attachment

BIOMECHANICS

- resistance source
- resistance profile
- peak resistance position

OTHER

- body position
- difficulty

Allow filters to be combined.

Example advanced search:

Primary muscle:\
Lateral Deltoid

Joint action:\
Shoulder Abduction

Equipment:\
Cable

Resistance profile:\
Relatively Constant

All active filters must be represented in URL query parameters so searches can be bookmarked and shared.

Support sorting by:

- alphabetical
- newest
- most favorited

PUBLIC ROUTES

Implement approximately:

/\
/exercises\
/exercises/[slug]\
/families/[slug]\
/muscles/[slug]\
/joints/[slug]\
/joint-actions/[slug]\
/equipment/[slug]

JOINT ACTION PAGE

A public joint-action page should exist.

Example:

/joint-actions/shoulder-abduction

It should display:

Shoulder Abduction

Short anatomical explanation

Exercises containing this joint action

Filters for:

- equipment
- muscles
- resistance profile
- body position
- difficulty

Do not make medical or rehabilitation claims.

Keep descriptions educational and exercise-focused.

AUTHENTICATED USER ROUTES

/dashboard\
/my-exercises\
/my-exercises/new\
/my-exercises/[id]/edit\
/submissions\
/submissions/[id]

ADMIN/REVIEWER ROUTES

/admin\
/admin/submissions\
/admin/submissions/[id]\
/admin/exercises\
/admin/exercises/[id]/edit\
/admin/taxonomy

ADMIN TAXONOMY MANAGEMENT

Admins must be able to manage:

muscles\
joints\
joint actions\
equipment\
equipment categories\
attachments\
movement patterns\
exercise families

Avoid making these taxonomies editable by ordinary users.

Users should choose from canonical values when submitting an exercise.

If a required taxonomy value does not exist, allow the user to suggest a new value as part of the submission without immediately creating it globally.

EXERCISE PAGE

Create a polished exercise detail page.

It should show:

- exercise name
- exercise family
- aliases
- looping demonstration
- male/female media selector when available
- camera-angle selector when available
- primary muscles
- secondary muscles
- stabilizers
- joints involved
- joint actions
- equipment
- attachments
- instructions
- form cues
- common mistakes
- movement pattern
- mechanic
- force type
- plane of motion
- resistance profile
- peak resistance position
- related exercises

Joint actions should be clickable.

Example:

Joint Actions

Shoulder Abduction\
Scapular Upward Rotation

Clicking Shoulder Abduction should open:

/joint-actions/shoulder-abduction

Include a favorite/save button for signed-in users.

PUBLIC SUBMISSION FLOW

Build this UX:

Create Exercise\
→ enter exercise metadata\
→ choose exercise family or propose new family\
→ choose muscles\
→ choose joints\
→ choose joint actions\
→ choose equipment\
→ enter biomechanics\
→ upload/reference media\
→ Save Privately

From a private exercise:

Submit to Global Database\
→ run duplicate search\
→ compare name\
→ aliases\
→ family\
→ muscles\
→ equipment\
→ joint actions\
→ show likely duplicates\
→ user confirms it is new or identifies relationship\
→ validation\
→ submit\
→ submission enters moderation queue

Do not modify the public exercise database until approval.

If approved:

create/update the canonical public exercise\
record provenance

If merged:

connect relevant aliases\
connect relevant exercise relationships\
preserve submission history

ADMIN DASHBOARD

The moderation page should make reviewing submissions fast.

Display:

- submitted exercise
- submitter
- submission date
- exercise family
- proposed metadata
- muscles
- joints
- joint actions
- equipment
- biomechanics
- media
- possible duplicate matches
- existing related variations
- current public database comparison
- changes since previous review

Make biomechanics differences visually obvious.

For example:

Submitted Joint Actions:

Shoulder Abduction\
Elbow Flexion

Existing Exercise:

Shoulder Abduction

Highlight the difference for reviewers.

Allow individual fields to be corrected before approval while preserving what the user originally submitted.

Provide:

approve\
request changes\
reject\
merge

SEED DATA

Create original development seed data for approximately 20 common exercises so functionality can be tested.

Examples may include:

Barbell Bench Press\
Incline Dumbbell Bench Press\
Barbell Back Squat\
Conventional Deadlift\
Barbell Romanian Deadlift\
Pull-Up\
Lat Pulldown\
Dumbbell Lateral Raise\
Cable Lateral Raise\
Behind-Body Cable Lateral Raise\
Barbell Curl\
Dumbbell Curl\
Cable Triceps Pushdown\
Overhead Cable Triceps Extension\
Leg Extension\
Seated Leg Curl\
Standing Calf Raise

Seed accurate relationships between:

exercise families\
exercises\
muscles\
joints\
joint actions\
equipment\
movement patterns

Example seed relationship:

Exercise:\
Cable Lateral Raise

Family:\
Lateral Raise

Primary Muscle:\
Lateral Deltoid

Joint:\
Shoulder

Primary Joint Action:\
Shoulder Abduction

Equipment:\
Cable

Movement Pattern:\
Isolation / Shoulder Abduction

Do not copy descriptions or media from proprietary fitness websites.

DESIGN

Use a clean, premium appearance focused on exploration rather than workout tracking.

Visual direction:

- minimal
- modern
- dark and light mode
- large exercise demonstrations
- excellent typography
- fast filters
- mobile friendly

The Explore page should feel like a combination of:

- modern search engine
- encyclopedia
- visual exercise library
- biomechanical database

Avoid:

- excessive gradients
- giant dashboard cards
- fake statistics
- generic AI SaaS design patterns

FILTER UI

The filter sidebar or filter drawer should have organized sections.

Example:

Muscles

Joints\
Shoulder\
Elbow\
Hip\
Knee\
Ankle

Joint Actions\
Shoulder Abduction\
Shoulder Flexion\
Elbow Flexion\
Hip Extension\
Knee Extension

Equipment

Attachments

Movement

Resistance Profile

Body Position

Difficulty

When a joint is selected, optionally prioritize/show joint actions belonging to that joint.

Example:

User selects:

Shoulder

Then show prominently:

Shoulder Flexion\
Shoulder Extension\
Shoulder Abduction\
Shoulder Adduction\
Shoulder Horizontal Adduction\
Shoulder Horizontal Abduction\
Shoulder Internal Rotation\
Shoulder External Rotation

Do not require selecting a joint before selecting a joint action.

QUALITY

Use:

- strict TypeScript
- server-side authorization
- Zod validation
- proper database indexes
- accessible form controls
- semantic HTML
- loading states
- error states
- empty states
- responsive design

Add indexes for frequently filtered relationship tables including:

exercise\_muscles\
exercise\_joint\_actions\
exercise\_equipment\
exercise\_movement\_patterns

Prevent N+1 database query patterns.

Implement pagination rather than retrieving the entire exercise database.

DATABASE PERFORMANCE

Because exercises will have many-to-many relationships, design queries carefully.

The Explore page may eventually query tens of thousands of exercises.

Create indexes for:

exercise IDs\
muscle IDs\
joint action IDs\
equipment IDs\
family IDs\
publication status\
slugs

Use SQL EXISTS/subqueries or efficient joins for multi-filter searches.

Avoid loading all metadata into application memory and filtering in JavaScript.

Filtering must happen in PostgreSQL.

TESTS

Add tests covering at minimum:

exercise creation\
exercise-family relationships\
exercise variations\
private exercise ownership\
submission creation\
joint assignment\
joint-action assignment\
joint-action filtering\
multiple joint-action filtering\
muscle + joint-action combined filtering\
equipment + joint-action combined filtering\
duplicate detection\
unauthorized admin access\
reviewer authorization\
approval\
rejection\
merge\
favorite/unfavorite\
search\
filtering

Create Playwright tests for major user flows.

One Playwright test should specifically verify:

Open Explore\
→ select Shoulder Abduction\
→ select Cable\
→ verify only matching exercises appear\
→ open an exercise\
→ verify Shoulder Abduction appears on the exercise page

DOCUMENTATION

Create:

README.md\
ARCHITECTURE.md\
DATABASE.md\
BIOMECHANICS.md\
MODERATION.md

BIOMECHANICS.md should explain the difference between:

- muscles
- joints
- joint actions
- movement patterns
- planes of motion
- resistance profiles
- exercise families
- exercise variations

Document the classification philosophy so future contributors and admins classify exercises consistently.

IMPLEMENTATION PROCESS

Do not attempt to implement the entire application in one enormous change.

First inspect the repository.

If the project does not exist, initialize it.

Then execute development in phases.

PHASE 1

Project structure\
Database design\
Authentication\
RLS\
Taxonomy tables\
Muscles\
Joints\
Joint actions\
Equipment\
Exercise families\
Migrations\
Seed data

PHASE 2

Public exercise browsing\
Exercise-family hierarchy\
Search\
Filters\
Joint-action filtering\
Exercise pages\
Joint-action pages

PHASE 3

User accounts\
Favorites\
Private exercises

PHASE 4

Public submission workflow\
Biomechanical metadata\
Duplicate detection\
Variation detection

PHASE 5

Admin moderation dashboard\
Approval\
Rejection\
Changes requested\
Merge workflow\
Taxonomy management

PHASE 6

Media system\
Polish\
Testing\
Performance optimization\
Documentation

At the beginning of each phase, briefly describe what will be changed.

After each phase:

run lint\
run TypeScript type checking\
run relevant tests\
fix failures before continuing

Do not hide errors or disable tests just to make the build pass.

When an architectural decision is ambiguous, choose the simplest option that preserves future scalability and document the decision in ARCHITECTURE.md.

FUTURE-PROOFING

Do not implement these now, but keep the architecture capable of supporting them later:

3D male/female avatars\
GLB exercise animations\
browser-based exercise animation editor\
inverse kinematics\
multiple camera renders\
automatic WebM/MP4 rendering\
exercise API subscriptions\
multiple languages\
expert reviewer reputation\
community voting on disputed metadata\
joint-angle data\
range-of-motion measurements\
exercise phase analysis\
moment-arm data\
force-vector visualization\
resistance curve graphs

The MVP succeeds when a user can:

search the exercise database\
filter by muscles\
filter by joints\
filter by joint actions\
filter by equipment\
filter by biomechanics\
navigate exercise families and variations\
create a private exercise\
submit it publicly\
have an admin review it\
approve/reject/merge it\
and see approved exercises appear correctly in the global searchable database.