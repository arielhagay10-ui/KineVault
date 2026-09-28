create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.moderation_events(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  submission_id uuid not null references public.exercise_submissions(id) on delete restrict,
  action public.moderation_action not null check(action in ('request_changes','approve','reject','merge')),
  exercise_name text not null,
  comment text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_recent_idx on public.notifications(user_id,created_at desc,id);
create index notifications_unread_idx on public.notifications(user_id) where read_at is null;
alter table public.notifications enable row level security;
revoke all on public.notifications from anon,authenticated,service_role;
grant select on public.notifications to authenticated;
create policy notifications_owner_read on public.notifications for select to authenticated
using (user_id = (select auth.uid()));

create table public.notification_deliveries (
  id uuid primary key references public.notifications(id) on delete restrict,
  recipient_email text,
  status text not null default 'queued' check(status in ('queued','sending','sent','failed')),
  attempt_count integer not null default 0 check(attempt_count between 0 and 5),
  error_code text,
  provider_id text,
  sender text,
  subject text,
  text_body text,
  html_body text,
  queued_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  first_started_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz
);
create index notification_deliveries_queue_idx on public.notification_deliveries(next_attempt_at,id) where status = 'queued';
alter table public.notification_deliveries enable row level security;
revoke all on public.notification_deliveries from anon,authenticated,service_role;
grant select on public.notification_deliveries to authenticated;
create policy notification_deliveries_admin_read on public.notification_deliveries for select to authenticated
using ((select private.is_admin()));

create function private.queue_review_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target public.exercise_submissions%rowtype; notification_id uuid; recipient text; exercise_name text;
begin
  if new.action not in ('request_changes','approve','reject','merge') then return new; end if;
  select * into target from public.exercise_submissions where id = new.submission_id;
  select name into exercise_name from public.exercise_content where id = target.original_content_id;
  select email into recipient from auth.users where id = target.owner_id;
  insert into public.notifications(event_id,user_id,submission_id,action,exercise_name,comment)
  values(new.id,target.owner_id,new.submission_id,new.action,exercise_name,new.comment) returning id into notification_id;
  insert into public.notification_deliveries(id,recipient_email,status,error_code)
  values(notification_id,recipient,case when nullif(recipient,'') is null then 'failed' else 'queued' end,
    case when nullif(recipient,'') is null then 'missing_recipient' end);
  return new;
end;
$$;
revoke all on function private.queue_review_notification() from public,anon,authenticated,service_role;
create trigger queue_review_notification after insert on public.moderation_events
for each row execute function private.queue_review_notification();

create function public.mark_notification_read(p_notification_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.notifications set read_at = coalesce(read_at,now())
  where id = p_notification_id and user_id = auth.uid();
end;
$$;
revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create function public.claim_notification_delivery()
returns table(delivery_id uuid,submission_id uuid,action public.moderation_action,exercise_name text,comment text)
language plpgsql volatile security definer set search_path = '' as $$
declare job public.notification_deliveries%rowtype;
begin
  update public.notification_deliveries set status = 'failed',error_code = 'delivery_window_expired',completed_at = now()
  where status in ('sending','queued') and first_started_at < now() - interval '23 hours';
  update public.notification_deliveries set status = 'failed',error_code = 'worker_timeout',completed_at = now()
  where status = 'sending' and started_at < now() - interval '5 minutes' and attempt_count >= 5;
  update public.notification_deliveries set status = 'queued',next_attempt_at = now(),error_code = 'worker_timeout'
  where status = 'sending' and started_at < now() - interval '5 minutes' and attempt_count < 5;
  select * into job from public.notification_deliveries
  where status = 'queued' and next_attempt_at <= now() and attempt_count < 5
  order by next_attempt_at,id limit 1 for update skip locked;
  if not found then return; end if;
  update public.notification_deliveries set status = 'sending',attempt_count = attempt_count + 1,
    started_at = now(),first_started_at = coalesce(first_started_at,now()) where id = job.id;
  return query select notification.id,notification.submission_id,notification.action,notification.exercise_name,notification.comment
  from public.notifications notification where notification.id = job.id;
end;
$$;
revoke all on function public.claim_notification_delivery() from public,anon,authenticated;
grant execute on function public.claim_notification_delivery() to service_role;

-- Freeze the provider request on its first attempt, so idempotent retries have
-- identical content even if sender configuration changes during a deployment.
create function public.prepare_notification_delivery(
  p_delivery_id uuid,p_sender text,p_subject text,p_text text,p_html text
)
returns table(recipient_email text,sender text,subject text,text_body text,html_body text)
language plpgsql volatile security definer set search_path = '' as $$
declare job public.notification_deliveries%rowtype;
begin
  select * into job from public.notification_deliveries where id = p_delivery_id for update;
  if not found or job.status <> 'sending' then raise exception 'delivery is not claimed'; end if;
  if job.subject is null then
    if length(coalesce(p_sender,'')) not between 3 and 200 or p_sender ~ '[\r\n]'
      or length(coalesce(p_subject,'')) not between 1 and 200 or p_subject ~ '[\r\n]'
      or length(coalesce(p_text,'')) not between 1 and 12000
      or length(coalesce(p_html,'')) not between 1 and 24000 then raise exception 'invalid email payload'; end if;
    update public.notification_deliveries set sender = p_sender,subject = p_subject,text_body = p_text,html_body = p_html
    where id = p_delivery_id;
  end if;
  return query select delivery.recipient_email,delivery.sender,delivery.subject,delivery.text_body,delivery.html_body
    from public.notification_deliveries delivery where delivery.id = p_delivery_id;
end;
$$;
revoke all on function public.prepare_notification_delivery(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.prepare_notification_delivery(uuid,text,text,text,text) to service_role;

create function public.complete_notification_delivery(p_delivery_id uuid,p_provider_id text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if length(coalesce(p_provider_id,'')) not between 1 and 200 then raise exception 'provider receipt required'; end if;
  update public.notification_deliveries set status = 'sent',provider_id = p_provider_id,error_code = null,completed_at = now()
  where id = p_delivery_id and status = 'sending';
  if not found then raise exception 'delivery is not claimed'; end if;
end;
$$;
revoke all on function public.complete_notification_delivery(uuid,text) from public,anon,authenticated;
grant execute on function public.complete_notification_delivery(uuid,text) to service_role;

create function public.fail_notification_delivery(p_delivery_id uuid,p_error_code text,p_retry boolean default true)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_error_code not in ('provider_unavailable','provider_rejected','provider_response_invalid') then
    raise exception 'invalid delivery error code';
  end if;
  update public.notification_deliveries set
    status = case when p_retry and attempt_count < 5 then 'queued' else 'failed' end,
    next_attempt_at = now() + make_interval(secs => (30 * power(2,attempt_count))::integer),
    completed_at = case when not p_retry or attempt_count >= 5 then now() end,error_code = p_error_code
  where id = p_delivery_id and status = 'sending';
  if not found then raise exception 'delivery is not claimed'; end if;
end;
$$;
revoke all on function public.fail_notification_delivery(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.fail_notification_delivery(uuid,text,boolean) to service_role;
