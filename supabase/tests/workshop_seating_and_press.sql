begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
create function pg_temp.seat_layout(changes jsonb, slug text default 'shoulder-press-machine') returns jsonb language sql as $$
  select jsonb_build_object('body', '{"x":0,"y":0,"z":0,"rotationX":0,"rotationY":0,"rotationZ":0,"scale":1}'::jsonb,
    'objects', jsonb_build_array('{"id":"00000000-0000-4000-8000-000000000001","name":"Seat","x":0,"y":0,"z":0,"rotationX":0,"rotationY":0,"rotationZ":0,"scale":1,"attachment":"none","pulleyHeight":1.5}'::jsonb || jsonb_build_object('slug', slug) || changes));
$$;
select ok(private.valid_studio_layout(pg_temp.seat_layout('{"seatOffsetX":-0.1,"seatOffsetZ":0.12,"seatFootSupport":false,"pressGrip":"neutral","machinePositionLeft":0.2,"machinePositionRight":0.8}')), 'press seat, grip and independent levers save');
select ok(private.valid_studio_layout(pg_temp.seat_layout('{"seatOffsetX":0.1,"seatOffsetZ":-0.12,"seatFootSupport":true}', slug)), slug || ' accepts seat bounds')
from unnest(array['bench','row-machine','cable-row-machine','pec-deck','lat-pulldown-machine','leg-press','shoulder-press-machine']) slug;
select ok(private.valid_studio_layout(pg_temp.seat_layout('{}', slug)), slug || ' legacy layout saves')
from unnest(array['bench','row-machine','leg-press','shoulder-press-machine','smith-machine']) slug;
select ok(not private.valid_studio_layout(pg_temp.seat_layout(changes)), 'rejects malformed seat/grip ' || changes::text)
from (values ('{"seatOffsetX":0.101}'::jsonb), ('{"seatOffsetX":-0.101}'), ('{"seatOffsetZ":0.121}'), ('{"seatOffsetZ":-0.121}'), ('{"seatOffsetX":null}'), ('{"seatOffsetZ":"0"}'), ('{"seatFootSupport":1}'), ('{"pressGrip":"pronated"}'), ('{"machinePositionLeft":1.01}'), ('{"machinePositionRight":null}'), ('{"rowGrip":"wide"}'), ('{"rowSeatHeight":0.7}'), ('{"rowFootSupport":false}'), ('{"unknown":true}')) v(changes);
select ok(not private.valid_studio_layout(pg_temp.seat_layout('{"seatFootSupport":false}', 'leg-press')), 'leg press keeps required foot contacts');
select ok(not private.valid_studio_layout(pg_temp.seat_layout(changes, slug)), slug || ' rejects ' || changes::text)
from unnest(array['smith-machine','stool','cable-machine','barbell']) slug
cross join (values ('{"seatOffsetX":0}'::jsonb), ('{"seatOffsetZ":0}'), ('{"seatFootSupport":true}'), ('{"pressGrip":"wide"}'), ('{"machinePositionLeft":0.2}')) v(changes);
select ok(private.valid_studio_layout(pg_temp.seat_layout(jsonb_build_object('machineUse',true,'attachment',attachment))), 'press accepts ' || attachment || ' grip')
from unnest(array['left','right','both']) attachment;
select ok(not private.valid_studio_layout(pg_temp.seat_layout('{"machineUse":true,"attachment":"invalid"}')), 'invalid press attachment rejected');
select ok(private.valid_studio_layout(pg_temp.seat_layout('{"rowFootSupport":false,"machinePositionLeft":0.2}', 'row-machine')), 'legacy row controls save');
select ok(private.valid_studio_layout(pg_temp.seat_layout('{"frames":[{"x":0,"y":0,"z":0,"rotationX":0,"rotationY":0,"rotationZ":0,"scale":1,"timeMs":0,"seatOffsetX":0.1,"seatOffsetZ":-0.12,"machinePositionLeft":0.2,"machinePositionRight":0.8}]}')), 'press frame controls save');
select ok(not private.valid_studio_layout(pg_temp.seat_layout(jsonb_build_object('frames',jsonb_build_array('{"x":0,"y":0,"z":0,"rotationX":0,"rotationY":0,"rotationZ":0,"scale":1,"timeMs":0}'::jsonb || changes)), slug)), slug || ' rejects frame ' || changes::text)
from (values ('shoulder-press-machine', '{"seatOffsetX":0.101}'::jsonb), ('shoulder-press-machine', '{"seatOffsetZ":-0.121}'), ('shoulder-press-machine', '{"seatOffsetX":null}'), ('shoulder-press-machine', '{"machinePositionRight":2}'), ('bench', '{"machinePositionLeft":0.2}'), ('smith-machine', '{"seatOffsetX":0}'), ('barbell', '{"seatOffsetZ":0}'), ('shoulder-press-machine', '{"seatFootSupport":false}'), ('shoulder-press-machine', '{"pressGrip":"neutral"}')) v(slug, changes);
select ok(private.valid_studio_layout(null), 'legacy null saves');
select * from finish();
rollback;
