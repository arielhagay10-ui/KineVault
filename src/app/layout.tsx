import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Comfortaa } from "next/font/google";
import { cn } from "@/lib/utils";
import { cookies } from "next/headers";
import type { Theme } from "@/components/theme-control";
import { SiteMenu } from "@/components/site-menu";
import { OverlayScrollbars } from "@/components/overlay-scrollbars";
import { getIdentity } from "@/lib/auth";
import "overlayscrollbars/styles/overlayscrollbars.css";
import Script from "next/script";

const comfortaa = Comfortaa({ subsets: ["latin"], variable: "--font-comfortaa", display: "swap" });

export const metadata: Metadata = {
  title: "KineVault — Exercise Encyclopedia",
  description: "Explore exercises through movement, anatomy, equipment, and biomechanics.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const preference = (await cookies()).get("kv-theme")?.value;
  const identity = await getIdentity();
  const theme: Theme = preference === "dark" || preference === "light" ? preference : "system";
  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning className={cn("font-sans", comfortaa.variable, theme === "dark" && "dark")}>
      <head><Script id="appearance-bootstrap" strategy="beforeInteractive">{"if(document.documentElement.dataset.theme==='system'){document.documentElement.classList.toggle('dark',window.matchMedia('(prefers-color-scheme: dark)').matches)}"}</Script></head>
      <body><div id="main-content" tabIndex={-1}>{children}</div><SiteMenu theme={theme} signedIn={!!identity} role={identity?.role} /><OverlayScrollbars /></body>
    </html>
  );
}
