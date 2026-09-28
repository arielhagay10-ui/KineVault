import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { z } from "zod";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid");
if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("This setup command only supports local Supabase.");
const prompt = createInterface({ input: process.stdin, output: process.stdout });
let email;
try { email = z.email().max(254).parse((await prompt.question("Email of your confirmed local account: ")).trim()); }
finally { prompt.close(); }
const literal = email.replaceAll("'", "''");
const sql = `begin;
lock table public.roles in exclusive mode;
do $setup$
declare target uuid;
begin
  if exists(select 1 from public.roles where role='admin') then raise exception 'An admin already exists. Use the Roles page.'; end if;
  select id into target from auth.users where lower(email)=lower('${literal}') and email_confirmed_at is not null;
  if target is null then raise exception 'Create and confirm this local account first.'; end if;
  perform set_config('request.jwt.claim.sub',target::text,true);
  perform set_config('app.audit_comment','Initial local administrator setup.',true);
  update public.roles set role='admin',assigned_at=now(),assigned_by=target where user_id=target;
  if not found then raise exception 'Account role is missing.'; end if;
end;
$setup$;
commit;`;
execFileSync("docker", ["exec", "-i", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], { input: sql, stdio: ["pipe", "pipe", "inherit"] });
console.log("Your local account is now an admin. Open /admin.");
