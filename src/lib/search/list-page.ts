import { z } from "zod";
import type { RawSearchParams } from "./params";

export const LIST_PAGE_SIZE = 24;

export function parseListPage(raw: RawSearchParams) {
  const first = (value: RawSearchParams[string]) => Array.isArray(value) ? value[0] : value;
  const page = z.coerce.number().int().min(1).max(100000).catch(1).parse(first(raw.page) ?? 1);
  const query = z.string().trim().transform(value => value.slice(0, 100)).catch("").parse(first(raw.q) ?? "");
  return { page, query, from: (page - 1) * LIST_PAGE_SIZE, to: page * LIST_PAGE_SIZE - 1 };
}

export function listPageUrl(path: string, page: number, query = "") {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (query) params.set("q", query);
  return params.size ? `${path}?${params}` : path;
}

/** Escape LIKE metacharacters so the typed query means a literal substring. */
export function substringPattern(query: string) {
  return `%${query.replace(/[\\%_]/g, "\\$&")}%`;
}
