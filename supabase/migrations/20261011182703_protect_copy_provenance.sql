-- Copy attribution feeds discovery; clients cannot attach arbitrary drafts to public entries.
create function private.protect_copy_provenance()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then return new; end if;
  if tg_op = 'INSERT' then
    if new.copied_from_exercise_id is not null then
      raise exception 'copy provenance is maintained internally';
    end if;
  elsif new.copied_from_exercise_id is distinct from old.copied_from_exercise_id then
    raise exception 'copy provenance is maintained internally';
  end if;
  return new;
end;
$$;
revoke all on function private.protect_copy_provenance() from public, anon, authenticated;
create trigger private_copy_provenance before insert or update of copied_from_exercise_id on public.private_exercises
  for each row execute function private.protect_copy_provenance();
