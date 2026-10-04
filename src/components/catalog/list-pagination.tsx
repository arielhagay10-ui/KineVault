import Link from "next/link";
import { LIST_PAGE_SIZE, listPageUrl } from "@/lib/search/list-page";

export function ListPagination({ path, page, total, query = "" }: {
  path: string; page: number; total: number; query?: string;
}) {
  if (page === 1 && total <= LIST_PAGE_SIZE) return null;
  const linkClass = "inline-flex min-h-11 items-center rounded-xl border bg-card px-4 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";
  return <nav aria-label="Pagination" className="mt-6 flex flex-wrap items-center gap-4">
    {page > 1 && <Link className={linkClass} href={listPageUrl(path, page - 1, query)}>Previous page</Link>}
    <p className="text-sm text-muted-foreground">Page {page} · {total} total</p>
    {page * LIST_PAGE_SIZE < total && <Link className={linkClass} href={listPageUrl(path, page + 1, query)}>Next page</Link>}
  </nav>;
}
