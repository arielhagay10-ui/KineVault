-- Machine migrations can precede taxonomy seeds on a fresh installation.
insert into public.equipment_categories (slug, name)
values ('machine', 'Machine')
on conflict (slug) do nothing;

insert into public.equipment (category_id, slug, name)
select category.id, equipment.slug, equipment.name
from public.equipment_categories category
cross join (values
  ('smith-machine', 'Smith Machine'),
  ('leg-press', 'Leg Press')
) equipment(slug, name)
where category.slug = 'machine'
on conflict (slug) do nothing;
