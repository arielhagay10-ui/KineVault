alter table public.exercise_scenes drop constraint exercise_scenes_motion_style_check;
alter table public.exercise_scenes add constraint exercise_scenes_motion_style_check
  check (motion_style in ('free','squat','hinge','row','split-squat','bench-press','seated-curl'));

insert into public.equipment_categories(slug,name) values ('supports','Supports') on conflict(slug) do nothing;
insert into public.equipment(category_id,slug,name)
  select id,'bench','Bench' from public.equipment_categories where slug='supports'
  on conflict(slug) do nothing;
