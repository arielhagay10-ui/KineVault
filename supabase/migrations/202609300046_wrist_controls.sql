-- Add controls without changing any saved pose or snapshot. X is palm turn,
-- Y wrist flexion and Z deviation; the existing quaternion storage retains all three.
insert into public.rig_joints (
  rig_id, parent_joint_id, anatomical_joint_id, slug, name,
  min_x_degrees, max_x_degrees, min_y_degrees, max_y_degrees, min_z_degrees, max_z_degrees
)
select r.id, elbow.id, wrist.id, side.slug || '-wrist', side.name || ' Wrist',
  -90, 90, -70, 70, -30, 30
from public.rigs r
cross join (values ('left', 'Left'), ('right', 'Right')) as side(slug, name)
join public.rig_joints elbow on elbow.rig_id = r.id and elbow.slug = side.slug || '-elbow'
join public.joints wrist on wrist.slug = 'wrist'
where r.name = 'KineVault Anatomical Figure' and r.version = 1
on conflict (rig_id, slug) do nothing;
