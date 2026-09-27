import { expect, it } from "vitest";
import { safeNextPath } from "./auth-navigation";

it("keeps local redirects and rejects external destinations", () => {
  expect(safeNextPath("/my-exercises/new")).toBe("/my-exercises/new");
  expect(safeNextPath("https://outside.example")).toBe("/dashboard");
  expect(safeNextPath("//outside.example")).toBe("/dashboard");
  expect(safeNextPath("/\\outside.example")).toBe("/dashboard");
});
