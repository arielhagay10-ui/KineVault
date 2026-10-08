-- RLS does not govern TRUNCATE. Supabase table defaults also grant schema and
-- maintenance privileges that browser API roles never need.
-- Preserve DML, function grants, worker privileges, and non-public schemas.
revoke truncate, references, trigger, maintain
  on all tables in schema public from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables from anon, authenticated;
