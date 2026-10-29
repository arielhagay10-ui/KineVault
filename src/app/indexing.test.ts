import { expect, it } from "vitest";
import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import nextConfig from "../../next.config";

it.each([
  "/sign-in", "/sign-up", "/reset-password", "/reset-password/update",
  "/admin", "/admin/exercises/record/edit", "/dashboard", "/my-exercises",
  "/my-exercises/record/workshop", "/submissions", "/submissions/record", "/notifications",
  "/auth/confirm", "/check-email", "/shared/token", "/internal/render/job",
])("sends a noindex directive for %s", async path => {
  const response = await unstable_getResponseFromNextConfig({ url: `https://kinevault.test${path}`, nextConfig });
  expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
});

it.each([
  "/", "/exercises", "/exercises/cable-shoulder-abduction", "/muscles/deltoid",
  "/joint-actions/shoulder-abduction", "/joints/shoulder", "/equipment/cable", "/families/raise",
])("leaves public page %s indexable", async path => {
  const response = await unstable_getResponseFromNextConfig({ url: `https://kinevault.test${path}`, nextConfig });
  expect(response.headers.get("X-Robots-Tag")).toBeNull();
});
