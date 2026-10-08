begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(27);

select ok(not has_table_privilege(role_name, 'public.private_exercise_shares', privilege_name),
  role_name || ' cannot ' || privilege_name || ' private share records')
from (values ('anon'),('authenticated')) roles(role_name)
cross join (values ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) privileges(privilege_name);
select ok(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  cross join (values ('anon'),('authenticated')) roles(role_name)
  where n.nspname = 'public' and c.relkind in ('r','p')
    and has_table_privilege(role_name,c.oid,'TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
), 'API roles have no maintenance or schema privileges on existing public tables');
select ok(has_table_privilege('authenticated','public.private_exercise_shares',privilege_name),
  'authenticated retains share ' || privilege_name)
from (values ('SELECT'),('INSERT'),('UPDATE')) privileges(privilege_name);
select ok(not has_table_privilege('anon','public.private_exercise_shares','SELECT'),
  'anonymous visitors still cannot read share records directly');
select ok(has_function_privilege('authenticated','public.replace_private_share(uuid,text)','EXECUTE'),
  'authenticated retains share creation RPC');
select ok(has_function_privilege('authenticated','public.revoke_private_share(uuid)','EXECUTE'),
  'authenticated retains share revocation RPC');
select ok(has_function_privilege('anon','public.read_shared_private_exercise(text)','EXECUTE'),
  'anonymous visitors retain token-based shared exercise RPC');
select ok(has_function_privilege('service_role','public.claim_render_job()','EXECUTE'),
  'render worker retains job claim RPC');
set local role anon;
select throws_ok('truncate table public.private_exercise_shares', '42501',
  'permission denied for table private_exercise_shares', 'anonymous cannot truncate share records');
set local role authenticated;
select throws_ok('truncate table public.private_exercise_shares', '42501',
  'permission denied for table private_exercise_shares', 'authenticated cannot truncate share records');
reset role;

set local role postgres;
create table public.privilege_test_future_table (id uuid);
reset role;
select ok(not has_table_privilege(role_name,'public.privilege_test_future_table',privilege_name),
  role_name || ' does not inherit future table ' || privilege_name)
from (values ('anon'),('authenticated')) roles(role_name)
cross join (values ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) privileges(privilege_name);

select * from finish();
rollback;
