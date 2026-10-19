import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.KINEVAULT_DIST_DIR || ".next",
  agentRules: false,
  devIndicators: false,
  output: "standalone",
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    }, ...["/auth/:path*", "/check-email"].map(source => ({
      source,
      headers: [
        { key: "Cache-Control", value: "private, no-store" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ],
    })), {
      source: "/models/z-anatomy/model.meshopt.32c5dfc3.glb",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    }, {
      source: "/shared/:path*",
      headers: [
        { key: "Cache-Control", value: "private, no-store" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ],
    }, {
      source: "/internal/render/:path*",
      headers: [
        { key: "Cache-Control", value: "private, no-store" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ],
    }];
  },
};

export default nextConfig;
