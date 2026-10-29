import { expect, it } from "vitest";
import { authPath, emailNextPath, safeNextPath } from "./auth-navigation";

it("keeps local redirects and rejects external destinations", () => {
  expect(safeNextPath("/my-exercises/new")).toBe("/my-exercises/new");
  expect(safeNextPath("https://outside.example")).toBe("/dashboard");
  expect(safeNextPath("//outside.example")).toBe("/dashboard");
  expect(safeNextPath("/\\outside.example")).toBe("/dashboard");
});

it.each(["/%5coutside.example", "/%2foutside.example", "/%250aoutside.example", "/a/..//outside.example", "/%2e%2e//outside.example", "/sign-in?next=/sign-in", "/auth/callback", "/exercises\n//outside.example"])("rejects encoded redirect tricks and authentication loops: %s", (path) => {
  expect(safeNextPath(path)).toBe("/dashboard");
});

it.each(["/%23/../sign-in", "/%3f/../auth/callback", "/%23/../reset-password"])("rejects auth routes after final URL normalization: %s", path => {
  expect(safeNextPath(path)).toBe("/dashboard");
});

it("bounds the encoded destination before it can overflow pending-email validation", () => {
  expect(safeNextPath("/" + "א".repeat(400))).toBe("/dashboard");
  expect(safeNextPath("/exercises?q=" + "א".repeat(400))).toBe("/dashboard");
  expect(safeNextPath("/exercises?q=א")).toBe("/exercises?q=%D7%90");
});

it("preserves catalog queries and password recovery destinations", () => {
  expect(safeNextPath("/exercises?equipment=cable&jointAction=shoulder-abduction")).toBe("/exercises?equipment=cable&jointAction=shoulder-abduction");
  expect(safeNextPath(null, "/reset-password/update")).toBe("/reset-password/update");
  expect(safeNextPath("/exercises?q=50%25")).toBe("/exercises?q=50%25");
});

it.each([42, ["/exercises", "/admin"], {}, null, undefined])("rejects non-string destinations from malformed queries", value => {
  expect(safeNextPath(value)).toBe("/dashboard");
});

it("round-trips continuation through auth links and nested email redirects", () => {
  const next = "/exercises?equipment=cable&jointAction=shoulder-abduction";
  const path = authPath("/auth/confirm", next);
  expect(new URL(path, "https://kinevault.example").searchParams.get("next")).toBe(next);
  expect(emailNextPath(`https://kinevault.example${path}`, "https://kinevault.example")).toBe(next);
  expect(emailNextPath(`https://outside.example${path}`, "https://kinevault.example")).toBe("/dashboard");
  expect(emailNextPath("https://kinevault.example/sign-in?next=/admin", "https://kinevault.example")).toBe("/dashboard");
});
