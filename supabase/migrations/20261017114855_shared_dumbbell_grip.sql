-- Permit one dumbbell to occupy both hands while retaining the existing
-- pose-driver wrapper, hand collision checks, function identity and grants.
do $$
declare
  validator_definition text;
  previous_clause constant text := $clause$item->>'attachment' = 'both' and item->>'slug' not in ('barbell','kettlebell','bench','squat-rack')$clause$;
  shared_clause constant text := $clause$item->>'attachment' = 'both' and item->>'slug' not in ('barbell','dumbbell','kettlebell','bench','squat-rack')$clause$;
begin
  validator_definition := pg_catalog.pg_get_functiondef('private.valid_studio_layout_before_pose_driver(jsonb)'::regprocedure);
  if length(validator_definition) - length(replace(validator_definition, previous_clause, '')) <> length(previous_clause) then
    raise exception 'Expected exactly one shared-hand equipment clause in the studio validator';
  end if;
  execute replace(validator_definition, previous_clause, shared_clause);
end;
$$;
