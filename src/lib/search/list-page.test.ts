import { describe, expect, it } from "vitest";
import { listPageUrl, parseListPage, substringPattern } from "./list-page";

describe("bounded list pages", () => {
  it("defaults malformed or excessive offsets to the first bounded page", () => {
    for (const page of ["0", "-1", "1.5", "NaN", "Infinity", "999999999999"]) {
      expect(parseListPage({ page })).toMatchObject({ page: 1, from: 0, to: 23 });
    }
  });
  it("uses non-overlapping inclusive database ranges", () => {
    expect(parseListPage({ page: "2", q: " shoulder " })).toEqual({ page: 2, query: "shoulder", from: 24, to: 47 });
    expect(parseListPage({ page: ["3", "1"] }).from).toBe(48);
  });
  it("preserves and safely encodes search in previous and next links", () => {
    expect(listPageUrl("/submissions", 2, "a&b")).toBe("/submissions?page=2&q=a%26b");
    expect(listPageUrl("/submissions", 1)).toBe("/submissions");
  });
  it("treats LIKE wildcards and escapes literally", () => {
    expect(substringPattern("50%_\\")).toBe("%50\\%\\_\\\\%");
  });
});
