"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, signUp, requestPasswordReset, updatePassword } from "@/app/sign-in/actions";

type Mode = "sign-in" | "sign-up" | "forgot" | "update";

export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const action = mode === "sign-up" ? signUp : mode === "forgot" ? requestPasswordReset
    : mode === "update" ? updatePassword : signIn;
  const [state, formAction, pending] = useActionState(action, { error: null, notice: null });
  const title = mode === "sign-up" ? "Create your account" : mode === "forgot" ? "Reset your password"
    : mode === "update" ? "Choose a new password" : "Welcome back";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8f5] px-6 py-12 text-[#172a27]">
      <div className="w-full max-w-md">
        <Link href="/" className="text-xl font-bold tracking-[-0.05em]">KineVault</Link>
        <div className="mt-8 rounded-3xl border border-[#dce5de] bg-white p-7 shadow-sm sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#28785f]">Your exercise library</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">{title}</h1>
          {mode === "sign-up" && <p className="mt-2 text-sm leading-6 text-[#65776b]">Save favorites, create private exercises, and contribute reviewed movements.</p>}
          <form action={formAction} className="mt-7 space-y-5">
            {next && <input type="hidden" name="next" value={next} />}
            {mode !== "update" && <div>
              <label htmlFor="email" className="text-sm font-semibold">Email</label>
              <input id="email" type="email" name="email" autoComplete="email" required
                className="mt-2 w-full rounded-xl border border-[#cfdcd2] px-4 py-3 outline-none focus:border-[#348965] focus:ring-2 focus:ring-[#d7ebda]" />
            </div>}
            {mode !== "forgot" && <div>
              <label htmlFor="password" className="text-sm font-semibold">Password</label>
              <input id="password" type="password" name="password" minLength={mode === "sign-in" ? 1 : 10} maxLength={128} required
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                className="mt-2 w-full rounded-xl border border-[#cfdcd2] px-4 py-3 outline-none focus:border-[#348965] focus:ring-2 focus:ring-[#d7ebda]" />
              {mode !== "sign-in" && <p className="mt-2 text-xs text-[#788a7b]">At least 10 characters.</p>}
            </div>}
            {state.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>}
            {state.notice && <p role="status" className="rounded-lg bg-[#e9f6eb] px-3 py-2 text-sm text-[#276448]">{state.notice}</p>}
            <button type="submit" disabled={pending}
              className="w-full rounded-xl bg-[#174a3e] px-5 py-3 text-sm font-semibold text-white hover:bg-[#246a53] disabled:opacity-60">
              {pending ? "Working…" : mode === "sign-up" ? "Create account" : mode === "forgot" ? "Send reset email" : mode === "update" ? "Set new password" : "Sign in"}
            </button>
          </form>
          <div className="mt-6 flex flex-wrap justify-between gap-2 text-sm">
            {mode === "sign-in" ? <><Link href="/sign-up" className="font-medium text-[#28785f] hover:underline">Create an account</Link><Link href="/reset-password" className="text-[#5b7161] hover:underline">Forgot password?</Link></>
              : <Link href="/sign-in" className="font-medium text-[#28785f] hover:underline">Back to sign in</Link>}
          </div>
        </div>
      </div>
    </main>
  );
}
