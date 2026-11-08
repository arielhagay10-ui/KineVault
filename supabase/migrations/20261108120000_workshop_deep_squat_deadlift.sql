-- Add the deep squat and floor-start deadlift movement setups to the existing check.
do $$
declare original text;
begin
  select pg_catalog.pg_get_constraintdef(oid) into strict original from pg_catalog.pg_constraint
    where conrelid = 'public.exercise_scenes'::regclass and conname = 'exercise_scenes_motion_style_check';
  if original <> 'CHECK ((motion_style = ANY (ARRAY[''free''::text, ''squat''::text, ''hinge''::text, ''row''::text, ''split-squat''::text, ''bench-press''::text, ''seated-curl''::text, ''incline-curl''::text])))' then
    raise exception 'Movement setup check changed; review deep squat and deadlift migration';
  end if;
end;
$$;

alter table public.exercise_scenes
  drop constraint exercise_scenes_motion_style_check,
  add constraint exercise_scenes_motion_style_check
    check (motion_style in ('free','squat','hinge','row','split-squat','bench-press','seated-curl','incline-curl','deep-squat','deadlift'));
