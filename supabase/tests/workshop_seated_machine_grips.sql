begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(4);
-- Mirrors the grip-edit browser scene: idle machines with a custom right grip.
create temporary table seated_items on commit drop as
select n, jsonb_build_object('id', '00000000-0000-4000-8000-' || lpad(n::text, 12, '0'), 'name', slug, 'slug', slug,
  'x', n * 0.5 - 2, 'y', 0, 'z', 2, 'rotationX', 0, 'rotationY', 0, 'rotationZ', 0, 'scale', 0.5,
  'attachment', 'none', 'pulleyHeight', 1.5, 'gripOffsets', '{"right":{"x":0.02,"y":0,"z":0}}'::jsonb) as item
from unnest(array['leg-extension-machine','leg-curl-machine','lateral-raise-machine']) with ordinality as machines(slug, n);
select set_config('test.body', '{"x":0,"y":0,"z":0,"rotationX":0,"rotationY":0,"rotationZ":0,"scale":1}', true);
select ok(private.valid_studio_layout(jsonb_build_object('body', current_setting('test.body')::jsonb,
  'objects', (select jsonb_agg(item order by n) from seated_items))), 'seated machines keep custom grips when idle');
select ok(private.valid_studio_layout(jsonb_build_object('body', current_setting('test.body')::jsonb,
  'objects', (select jsonb_agg(item || '{"attachment":"right"}'::jsonb order by n) from seated_items where n = 1))), 'a hand can hold an idle leg extension');
select ok(private.valid_studio_layout(jsonb_build_object('body', current_setting('test.body')::jsonb, 'objects', (
  select jsonb_agg(jsonb_set(item, '{id}', to_jsonb('00000000-0000-4000-8000-' || lpad(copy::text, 12, '0'))) order by copy)
  from seated_items, generate_series(1, 20) copy where n = 3))), 'twenty items fit one scene');
select ok(not private.valid_studio_layout(jsonb_build_object('body', current_setting('test.body')::jsonb, 'objects', (
  select jsonb_agg(jsonb_set(item, '{id}', to_jsonb('00000000-0000-4000-8000-' || lpad(copy::text, 12, '0'))) order by copy)
  from seated_items, generate_series(1, 21) copy where n = 3))), 'scenes keep the 20-item limit');
select * from finish();
rollback;
