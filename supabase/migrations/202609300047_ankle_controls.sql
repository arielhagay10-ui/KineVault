-- Keep existing knee quaternion signs; positive UI flexion is the inverse of X.
-- Knees are hinges, with a small extension allowance rather than sideways posing.
update public.rig_joints joint set max_x_degrees = 5,
  min_y_degrees = 0, max_y_degrees = 0, min_z_degrees = 0, max_z_degrees = 0
from public.rigs rig where joint.rig_id = rig.id
  and rig.name = 'KineVault Anatomical Figure' and rig.version = 1
  and joint.slug in ('left-knee', 'right-knee');

insert into public.rig_joints (
  rig_id, parent_joint_id, anatomical_joint_id, slug, name,
  min_x_degrees, max_x_degrees, min_y_degrees, max_y_degrees, min_z_degrees, max_z_degrees
)
select rig.id, knee.id, ankle.id, side.slug || '-ankle', side.name || ' Ankle',
  -45, 20, -20, 20, -20, 30
from public.rigs rig
cross join (values ('left', 'Left'), ('right', 'Right')) as side(slug, name)
join public.rig_joints knee on knee.rig_id = rig.id and knee.slug = side.slug || '-knee'
join public.joints ankle on ankle.slug = 'ankle'
where rig.name = 'KineVault Anatomical Figure' and rig.version = 1
on conflict (rig_id, slug) do nothing;
