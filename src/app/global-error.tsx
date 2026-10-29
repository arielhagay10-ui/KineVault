"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en">
    <head><title>Page unavailable | KineVault</title></head>
    <body style={{ margin: 0, background: "#f5f6f8", color: "#1c2730", fontFamily: "system-ui, sans-serif" }}>
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "80px 24px" }}>
        <section role="alert" style={{ border: "1px solid #d5dde4", borderRadius: 16, background: "#fff", padding: 24 }}>
          <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.25 }}>KineVault could not be loaded</h1>
          <p style={{ margin: "16px 0 24px", color: "#4e5d6a", lineHeight: 1.6 }}>Try again, or return home and open the page again.</p>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
            <button type="button" onClick={reset} style={{ minHeight: 44, border: 0, borderRadius: 8, padding: "12px 20px", background: "#314e65", color: "#fff", font: "inherit", fontWeight: 600, cursor: "pointer" }}>Try again</button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Root recovery needs a full document navigation. */}
            <a href="/" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, color: "#314e65", fontWeight: 600 }}>Return home</a>
          </div>
        </section>
      </main>
    </body>
  </html>;
}
