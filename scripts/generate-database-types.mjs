import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const source = execFileSync(process.execPath, ["node_modules/supabase/dist/supabase.js", "gen", "types", "typescript", "--local", "--schema", "public"], { encoding: "utf8" });
writeFileSync("src/lib/database.types.ts", source.replace(/[ \t]+$/gm, "").trimEnd() + "\n");
