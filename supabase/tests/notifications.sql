begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
select plan(13);
insert into auth.users(id,email,aud,role) values
  ('00000000-0000-4000-8000-000000000111','notification-owner@example.test','authenticated','authenticated'),
  ('00000000-0000-4000-8000-000000000112','notification-reviewer@example.test','authenticated','authenticated');
update public.roles set role = 'reviewer' where user_id = '00000000-0000-4000-8000-000000000112';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000111',true);
select set_config('test.private_id',public.save_private_exercise(p_name => 'Notification Raise',p_family_slug => 'lateral-raise',
  p_primary_muscle_slugs => array['lateral-deltoid'],p_joint_action_slugs => array['shoulder-abduction'])::text,true);
select public.save_private_scene(current_setting('test.private_id')::uuid,
  '{"durationMs":1000,"cameraAngle":"front","equipment":null,"keyframes":[{"timeMs":0,"poses":{"left-shoulder":{"z":0}}},{"timeMs":1000,"poses":{"left-shoulder":{"z":-70}}}]}'::jsonb);
select set_config('test.submission_id',public.submit_private_exercise(current_setting('test.private_id')::uuid,'new')::text,true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000112',true);
select public.begin_submission_review(current_setting('test.submission_id')::uuid);
select public.request_submission_changes(current_setting('test.submission_id')::uuid,'poor_media','Please clarify the side view.');
select is((select count(*)::integer from public.notifications),0,'reviewers cannot read contributor notifications');
select ok(not has_function_privilege('authenticated','public.claim_notification_delivery()','EXECUTE'),'only workers can claim email deliveries');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000111',true);
select is((select count(*)::integer from public.notifications),1,'decision creates an owner-only account update');
select set_config('test.notification_id',(select id from public.notifications)::text,true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000112',true);
select public.mark_notification_read(current_setting('test.notification_id')::uuid);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000111',true);
select is((select read_at from public.notifications where id = current_setting('test.notification_id')::uuid),null::timestamptz,'another account cannot mark the notification read');
select public.mark_notification_read(current_setting('test.notification_id')::uuid);
select ok((select read_at is not null from public.notifications where id = current_setting('test.notification_id')::uuid),'owner can mark the account update read');
set local role service_role;
select set_config('test.delivery_id',(select delivery_id from public.claim_notification_delivery())::text,true);
select is(current_setting('test.delivery_id'),current_setting('test.notification_id'),'email job is linked to its account notification');
select is((select subject from public.prepare_notification_delivery(current_setting('test.delivery_id')::uuid,
  'updates@example.test','Original subject','Original text','<p>Original text</p>')),'Original subject','first delivery freezes its provider payload');
select public.fail_notification_delivery(current_setting('test.delivery_id')::uuid,'provider_unavailable',true);
set local role postgres;
select is((select status from public.notification_deliveries where id = current_setting('test.delivery_id')::uuid),'queued','temporary failure schedules a retry');
set local role service_role;
select is((select count(*)::integer from public.claim_notification_delivery()),0,'backoff prevents immediate retry loops');
set local role postgres;
update public.notification_deliveries set next_attempt_at = now() where id = current_setting('test.delivery_id')::uuid;
set local role service_role;
select is((select delivery_id::text from public.claim_notification_delivery()),current_setting('test.delivery_id'),'retry keeps the same idempotency identity');
select is((select subject from public.prepare_notification_delivery(current_setting('test.delivery_id')::uuid,
  'changed@example.test','Changed subject','Changed text','<p>Changed text</p>')),'Original subject','retry cannot alter the frozen email payload');
select public.complete_notification_delivery(current_setting('test.delivery_id')::uuid,'provider-receipt-1');
set local role postgres;
select is((select status from public.notification_deliveries where id = current_setting('test.delivery_id')::uuid),'sent','provider acceptance resolves the email job');
select is((select status::text from public.exercise_submissions where id = current_setting('test.submission_id')::uuid),'changes_requested','email failures do not undo moderation decisions');
select * from finish();
rollback;
