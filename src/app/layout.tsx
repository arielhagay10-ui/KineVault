import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { cookies } from "next/headers";
import { ThemeControl, type Theme } from "@/components/theme-control";
import Script from "next/script";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "KineVault — Exercise Encyclopedia",
  description: "Explore exercises through movement, anatomy, equipment, and biomechanics.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const preference = (await cookies()).get("kv-theme")?.value;
  const theme: Theme = preference === "dark" || preference === "light" ? preference : "system";
  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning className={cn("font-sans", geist.variable, theme === "dark" && "dark")}>
      <head><Script id="appearance-bootstrap" strategy="beforeInteractive">{"if(document.documentElement.dataset.theme==='system'){document.documentElement.classList.toggle('dark',window.matchMedia('(prefers-color-scheme: dark)').matches)}"}</Script></head>
      <body><ThemeControl initial={theme} /><div id="main-content" tabIndex={-1}>{children}</div></body>
    </html>
  );
}
