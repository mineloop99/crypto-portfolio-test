import type { NextConfig } from "next";

// Baseline hardening. A script-src CSP is left out on purpose: Next.js inlines bootstrap scripts, so a strict policy
// needs per-request nonces (see AUDIT.md, finding A-6).
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  // The API reads the supplied CSVs at runtime; make sure they are shipped with the serverless function.
  outputFileTracingIncludes: {
    "/api/portfolio": ["./data/*.csv"],
  },
  poweredByHeader: false,
  headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
