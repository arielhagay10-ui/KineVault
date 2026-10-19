import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { withPublishedCableRaise } from "../helpers/published-catalog";

test("a failing catalog check still withdraws its fixture", async ({}, testInfo) => {
  test.setTimeout(180_000);
  let fixtureId: string | undefined;
  await expect(withPublishedCableRaise(testInfo.project.use.baseURL!, async exercise => {
    fixtureId = exercise.id;
    throw new Error("Expected fixture consumer failure");
  })).rejects.toThrow("Expected fixture consumer failure");
  expect(fixtureId).toBeDefined();
  const visitor = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } });
  const remaining = await visitor.from("exercises").select("id").eq("id", fixtureId!);
  expect(remaining.error).toBeNull();
  expect(remaining.data).toEqual([]);
});
