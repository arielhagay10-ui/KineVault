"use client";

import Link from "next/link";
import { useRef } from "react";
import { signOut } from "@/app/sign-in/actions";
import { ThemeControl, type Theme } from "./theme-control";
import { Menu, X } from "./ui/icons";

export function SiteMenu({ theme, signedIn, role }: { theme: Theme; signedIn: boolean; role?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = () => { dialog.current?.close(); button.current?.focus(); };
  return <>
    <a href="#main-content" className="sr-only fixed start-4 top-4 z-[100] rounded-lg bg-card p-3 focus:not-sr-only">Skip to content</a>
    <button ref={button} data-site-menu type="button" aria-label="Site menu" onClick={() => dialog.current?.showModal()}
      className="fixed bottom-4 end-4 z-50 flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-border bg-card text-primary shadow-md hover:bg-muted"><Menu /></button>
    <dialog ref={dialog} aria-label="Site navigation" onCancel={close}
      onClick={event => { if (event.target === event.currentTarget) close(); }}
      className="m-auto w-[min(24rem,calc(100%-2rem))] rounded-2xl border bg-card p-6 text-foreground backdrop:bg-black/50">
      <div className="flex items-center justify-between gap-4"><Link href="/" onClick={close} className="text-xl font-bold">KineVault</Link><button type="button" aria-label="Close menu" onClick={close} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-muted"><X /></button></div>
      <nav aria-label="Main navigation" className="my-5 grid">
        {[["/", "Home"], ["/exercises", "Explore exercises"], ["/dashboard", "Dashboard"], ["/my-exercises", "My exercises"], ["/submissions", "My submissions"], ["/notifications", "Review updates"]].map(([href, label]) => <Link key={href} href={href} onClick={close} className="min-h-11 rounded-lg px-3 py-3 text-sm font-semibold hover:bg-muted">{label}</Link>)}
        {role && role !== "user" && [["/admin", "Review dashboard"], ["/admin/submissions", "Review queue"], ["/admin/exercises", "Published exercises"], ["/admin/candidates", "Catalog candidates"], ...(role === "admin" ? [["/admin/taxonomies", "Taxonomies"], ["/admin/assets", "Assets"], ["/admin/roles", "Roles"]] : [])].map(([href, label]) => <Link key={href} href={href} onClick={close} className="min-h-11 rounded-lg px-3 py-3 text-sm hover:bg-muted">{label}</Link>)}
      </nav>
      <ThemeControl initial={theme} />
      {signedIn ? <form action={signOut} className="mt-4"><button className="min-h-11 px-3 text-sm font-semibold" type="submit">Sign out</button></form> : <Link href="/sign-in" onClick={close} className="mt-4 inline-flex min-h-11 items-center px-3 text-sm font-semibold">Sign in</Link>}
    </dialog>
  </>;
}
