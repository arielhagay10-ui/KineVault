"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";
const subscribe = () => () => {};

export function ThemeControl({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState(initial);
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && media.matches));
      document.documentElement.dataset.theme = theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  return <div className="border-t pt-4 text-sm text-muted-foreground">
    <label className="flex items-center gap-2">Appearance
      <select aria-label="Appearance" value={theme} disabled={!hydrated} className="min-h-11 rounded-md border bg-card px-3 py-2 text-foreground"
        onChange={(event) => {
          const value = event.target.value as Theme;
          document.cookie = `kv-theme=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
          setTheme(value);
        }}>
        <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
      </select>
    </label>
  </div>;
}
