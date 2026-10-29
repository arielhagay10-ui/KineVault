"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useSyncExternalStore } from "react";
import { signOut } from "@/app/sign-in/actions";
import { ThemeControl } from "./theme-control";
import { X } from "./ui/icons";

const subscribe = () => () => {};

export function SiteNavigation({ signedIn, role }: { signedIn: boolean; role?: string }) {
  const pathname = usePathname();
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const options = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { options.current?.hidePopover(); trigger.current?.focus(); };
  if (pathname === "/my-exercises/new" || /^\/my-exercises\/[^/]+\/workshop$/.test(pathname) || pathname.startsWith("/internal/render/")) return null;

  const library = ["/dashboard", "/my-exercises", "/submissions", "/notifications"].some(path => pathname === path || pathname.startsWith(`${path}/`));
  const explore = ["/exercises", "/muscles", "/joints", "/joint-actions", "/equipment", "/families"].some(path => pathname === path || pathname.startsWith(`${path}/`));
  const destinations = [
    { href: "/exercises", label: "Explore", active: explore },
    { href: "/dashboard", label: "Library", active: library },
    { href: "/my-exercises/new", label: "Create", active: false },
  ];

  return <header data-site-navigation className="border-b border-border bg-card">
    <a href="#main-content" className="sr-only fixed start-4 top-4 z-[100] rounded-lg bg-card p-3 focus:not-sr-only">Skip to content</a>
    <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-3 md:grid-cols-[auto_1fr_auto] md:gap-x-8 lg:px-10">
      <Link href="/" className="font-brand inline-flex min-h-11 w-fit items-center text-xl font-bold tracking-[-0.05em] text-primary">KineVault</Link>
      <nav aria-label="Main navigation" className="order-3 col-span-2 mt-2 grid grid-cols-3 gap-1 md:order-none md:col-span-1 md:mt-0 md:flex md:gap-1.5">
        {destinations.map(({ href, label, active }) => <Link key={href} href={href} prefetch={href === "/my-exercises/new" ? false : undefined}
          aria-current={active ? "page" : undefined} onClick={() => options.current?.hidePopover()}
          className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors ${active ? "bg-accent text-accent-foreground" : "text-primary hover:bg-muted"}`}>{label}</Link>)}
      </nav>
      <div className="flex items-center gap-2">
        <button ref={trigger} type="button" disabled={!hydrated} popoverTarget="account-options" aria-haspopup="dialog" aria-label={signedIn ? "Account" : "Appearance"}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-primary hover:bg-muted">
          {signedIn ? "Account" : <><span aria-hidden className="text-xl md:hidden">◐</span><span className="hidden md:inline">Appearance</span></>}
        </button>
        {!signedIn && <Link href="/sign-in" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-input px-3 text-sm font-medium text-primary hover:bg-muted md:px-5">Sign in</Link>}
      </div>
    </div>
    <div ref={options} id="account-options" popover="auto" role="dialog" aria-label="Account options"
      className="fixed start-auto end-4 top-16 z-50 m-0 w-[min(22rem,calc(100%-2rem))] rounded-xl border border-border bg-card p-5 text-foreground shadow-lg">
      <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">{signedIn ? "Account" : "Appearance"}</h2>
        <button type="button" aria-label="Close account options" onClick={close} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-muted"><X size={18} aria-hidden /></button>
      </div>
      <ThemeControl />
      {role && role !== "user" && <Link href="/admin" onClick={close} className="mt-3 flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-primary hover:bg-muted">{role === "admin" ? "Administration" : "Review dashboard"}</Link>}
      {signedIn && <form action={signOut} className="mt-3 border-t border-border pt-3"><button className="min-h-11 rounded-lg px-3 text-sm font-medium text-primary hover:bg-muted" type="submit">Sign out</button></form>}
    </div>
  </header>;
}
