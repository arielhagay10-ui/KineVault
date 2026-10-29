"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const libraryLinks = [
  { href: "/dashboard", label: "Saved" },
  { href: "/my-exercises", label: "My exercises" },
  { href: "/submissions", label: "Submissions" },
  { href: "/notifications", label: "Updates" },
];

const reviewLinks = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/submissions", label: "Submissions" },
  { href: "/admin/exercises", label: "Exercises" },
  { href: "/admin/candidates", label: "Candidates" },
];

const adminLinks = [
  { href: "/admin/taxonomies", label: "Taxonomies" },
  { href: "/admin/assets", label: "Assets" },
  { href: "/admin/roles", label: "Roles" },
];

function WorkspaceNavigation({ label, links }: { label: string; links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return <nav aria-label={label} className="mb-8 flex flex-wrap gap-2 border-b border-border pb-4">
    {links.map((link) => {
      const active = pathname === link.href || (link.href !== "/admin" && pathname.startsWith(`${link.href}/`));
      return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}
        className={`inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
        {link.label}
      </Link>;
    })}
  </nav>;
}

export function LibraryNavigation() {
  return <WorkspaceNavigation label="Your library" links={libraryLinks} />;
}

export function AdminNavigation({ admin }: { admin: boolean }) {
  return <WorkspaceNavigation label="Review workspace" links={admin ? [...reviewLinks, ...adminLinks] : reviewLinks} />;
}
