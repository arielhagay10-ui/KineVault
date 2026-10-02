alter table public.exercise_scenes drop constraint exercise_scenes_motion_style_check;
alter table public.exercise_scenes add constraint exercise_scenes_motion_style_check
  check (motion_style in ('free','squat','hinge','row','split-squat','bench-press','seated-curl','incline-curl'));
