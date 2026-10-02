-- A chest fly is shoulder horizontal adduction, separate from pressing.
insert into public.exercise_families (slug, name)
values ('chest-fly', 'Chest Fly')
on conflict (slug) do nothing;
