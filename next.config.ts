import type { NextConfig } from "next";
import path from "path";

const isProd = process.env.NODE_ENV === "production";

// Next.js dev mode (Fast Refresh / webpack eval-source-map) requires
// 'unsafe-eval' to run client JS; without it hydration silently dies and the
// page becomes non-interactive. We only relax the policy in development and
// keep production locked down (no eval). 'wasm-unsafe-eval' is harmless and
// covers any wasm-based tooling in dev.
const scriptSrc = isProd
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

// The dev overlay/HMR connects over websockets, so widen connect-src in dev.
const connectSrc = isProd ? "connect-src 'self'" : "connect-src 'self' ws: wss:";

// Security headers applied to every response. This is an internal ERP holding
// student PII, so we harden against clickjacking, MIME sniffing and referrer
// leakage, and ask crawlers not to index any page.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      connectSrc,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

if (isProd) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

// Allow constrained VPS builders to limit CPU (avoids OOM on 1–2 GB droplets)
// while letting CI/beefier hosts use all cores. Set NEXT_BUILD_CPUS in the env.
const buildCpus = process.env.NEXT_BUILD_CPUS
  ? Number(process.env.NEXT_BUILD_CPUS)
  : undefined;

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) for small Docker
  // images and simple `node server.js` startup on the VPS.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  experimental: {
    ...(buildCpus ? { cpus: buildCpus } : {}),
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // Tree-shake barrel-export packages so only imported icons/modules ship.
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
