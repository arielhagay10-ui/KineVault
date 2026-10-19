"use client";

import { useState } from "react";

export function PasswordField({ newPassword, invalid }: { newPassword: boolean; invalid: boolean }) {
  const [visible, setVisible] = useState(false);
  const description = [newPassword && "password-help", invalid && "form-error"].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor="password" className="text-sm font-semibold">Password</label>
      <div className="relative mt-2">
        <input id="password" type={visible ? "text" : "password"} name="password" minLength={newPassword ? 10 : 1} maxLength={128} required
          autoComplete={newPassword ? "new-password" : "current-password"} aria-invalid={invalid || undefined} aria-describedby={description}
          className="w-full rounded-xl border border-input bg-background px-4 py-3 pr-20 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring" />
        <button type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} aria-controls="password"
          className="absolute inset-y-1 right-1 min-h-11 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {newPassword && <p id="password-help" className="mt-2 text-xs leading-5 text-muted-foreground">At least 10 characters. A few unrelated words work well.</p>}
    </div>
  );
}
