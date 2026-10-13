-- PostgREST can serialize floats with 15 significant digits. Keep ranking boundaries
-- at stable decimal precision so JSON cursors do not repeat or skip tied scores.
alter table public.exercises alter column discovery_score set expression as (
  round(((case when verified_at is not null then 6.0 else 0.0 end)
    + 3.0 * ln(1.0 + favorite_count) + 2.0 * ln(1.0 + use_count)
    + 0.25 * ln(1.0 + view_count))::numeric, 6)::double precision
);
analyze public.exercises;
