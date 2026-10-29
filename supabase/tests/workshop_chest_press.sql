begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
create function pg_temp.chest_layout(changes jsonb) returns jsonb language sql as $$
  select jsonb_build_object('body', '{"x":0,"y":0,"z":0,"rotationX":0,"rotationY":0,"rotationZ":0,"scale":1}'::jsonb,
    'objects', jsonb_build_array('{"id":"00000000-0000-4000-8000-000000000001","name":"Chest press","slug":"chest-press-machine","x":0,"y":0,"z":0,"rotationX":0,"rotationY":0,"rotationZ":0,"scale":1,"attachment":"none","pulleyHeight":1.5}'::jsonb || changes));
$$;
select ok(private.valid_studio_layout(pg_temp.chest_layout(jsonb_build_object('pressGrip', grip, 'machineUse',true,'attachment', hand,'seatOffsetX',.02,'seatOffsetZ',-.03,'seatFootSupport',false,'machinePositionLeft',.2,'machinePositionRight',.8))), grip || ' saves with ' || hand)
from unnest(array['wide','angled','neutral']) grip cross join unnest(array['none','left','right','both']) hand;
select ok(not private.valid_studio_layout(pg_temp.chest_layout(changes)), 'rejects malformed chest setup ' || changes::text)
from (values ('{"pressGrip":null}'::jsonb), ('{"pressGrip":"invalid"}'), ('{"machinePositionLeft":1.1}'), ('{"machinePositionRight":null}'), ('{"seatOffsetZ":0.13}'), ('{"rowGrip":"wide"}'), ('{"unknown":true}')) v(changes);
select ok(not private.valid_studio_layout(jsonb_set(pg_temp.chest_layout('{"pressGrip":"angled"}'), '{objects,0,slug}', '"shoulder-press-machine"')), 'angled grip remains chest-only');
select is((select count(*)::int from public.equipment where slug = 'chest-press-machine'), 1, 'one chest press taxonomy entry');
select * from finish();
rollback;
