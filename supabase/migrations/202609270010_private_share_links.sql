create table public.private_exercise_shares (
  id uuid primary key default gen_random_uuid(),
  private_exercise_id uuid not null references public.private_exercises(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index private_exercise_one_active_share_idx
  on public.private_exercise_shares (private_exercise_id) where revoked_at is null;
create index private_exercise_shares_owner_idx
  on public.private_exercise_shares (created_by, created_at desc);

alter table public.private_exercise_shares enable row level security;
grant select, insert, update on public.private_exercise_shares to authenticated;
create policy private_share_owner_read on public.private_exercise_shares
  for select to authenticated using (
    exists (select 1 from public.private_exercises pe
            where pe.id = private_exercise_id and pe.owner_id = (select auth.uid()))
  );
create policy private_share_owner_insert on public.private_exercise_shares
  for insert to authenticated with check (
    created_by = (select auth.uid()) and
    exists (select 1 from public.private_exercises pe
            where pe.id = private_exercise_id and pe.owner_id = (select auth.uid()))
  );
create policy private_share_owner_update on public.private_exercise_shares
  for update to authenticated using (
    exists (select 1 from public.private_exercises pe
            where pe.id = private_exercise_id and pe.owner_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.private_exercises pe
            where pe.id = private_exercise_id and pe.owner_id = (select auth.uid()))
  );

create function private.protect_private_share()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.private_exercise_id is distinct from old.private_exercise_id
     or new.created_by is distinct from old.created_by
     or new.token_hash is distinct from old.token_hash
     or new.created_at is distinct from old.created_at then
    raise exception 'share identity is immutable';
  end if;
  if old.revoked_at is not null then raise exception 'revoked links cannot be restored'; end if;
  new.revoked_at := now();
  return new;
end;
$$;
create trigger protect_private_share
before update on public.private_exercise_shares
for each row execute function private.protect_private_share();

create function public.replace_private_share(p_private_id uuid, p_token_hash text)
returns uuid
language plpgsql volatile security invoker
set search_path = ''
as $$
declare
  target_id uuid;
  new_share_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid share token'; end if;
  select id into target_id from public.private_exercises
  where id = p_private_id and owner_id = auth.uid() for update;
  if target_id is null then raise exception 'private exercise not found'; end if;
  update public.private_exercise_shares set revoked_at = now()
  where private_exercise_id = target_id and revoked_at is null;
  new_share_id := gen_random_uuid();
  insert into public.private_exercise_shares (id, private_exercise_id, created_by, token_hash)
  values (new_share_id, target_id, auth.uid(), p_token_hash);
  return new_share_id;
end;
$$;
revoke all on function public.replace_private_share(uuid, text) from public;
grant execute on function public.replace_private_share(uuid, text) to authenticated;

create function public.revoke_private_share(p_private_id uuid)
returns void
language plpgsql volatile security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not exists (select 1 from public.private_exercises pe
                 where pe.id = p_private_id and pe.owner_id = auth.uid()) then
    raise exception 'private exercise not found';
  end if;
  update public.private_exercise_shares set revoked_at = now()
  where private_exercise_id = p_private_id and revoked_at is null;
end;
$$;
revoke all on function public.revoke_private_share(uuid) from public;
grant execute on function public.revoke_private_share(uuid) to authenticated;

create function public.read_shared_private_exercise(p_token_hash text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', c.name,
    'description', c.short_description,
    'family', (select f.name from public.exercise_families f where f.id = c.family_id),
    'muscles', coalesce((
      select jsonb_agg(jsonb_build_object('name', m.name, 'role', em.role) order by em.role, m.name)
      from public.exercise_muscles em join public.muscles m on m.id = em.muscle_id
      where em.content_id = c.id
    ), '[]'::jsonb),
    'joints', coalesce((
      select jsonb_agg(j.name order by j.name)
      from public.exercise_joints ej join public.joints j on j.id = ej.joint_id
      where ej.content_id = c.id
    ), '[]'::jsonb),
    'joint_actions', coalesce((
      select jsonb_agg(jsonb_build_object('name', ja.name, 'joint', j.name) order by j.name, ja.name)
      from public.exercise_joint_actions eja
      join public.joint_actions ja on ja.id = eja.joint_action_id
      join public.joints j on j.id = ja.joint_id
      where eja.content_id = c.id
    ), '[]'::jsonb),
    'equipment', coalesce((
      select jsonb_agg(q.name order by q.name)
      from public.exercise_equipment ee join public.equipment q on q.id = ee.equipment_id
      where ee.content_id = c.id
    ), '[]'::jsonb),
    'resistance_profile', b.resistance_profile,
    'body_position', bp.name
  )
  from public.private_exercise_shares s
  join public.private_exercises pe on pe.id = s.private_exercise_id
  join public.exercise_content c on c.id = pe.content_id
  left join public.exercise_biomechanics b on b.content_id = c.id
  left join public.body_positions bp on bp.id = b.body_position_id
  where s.token_hash = p_token_hash and s.revoked_at is null;
$$;
revoke all on function public.read_shared_private_exercise(text) from public;
grant execute on function public.read_shared_private_exercise(text) to anon, authenticated;
