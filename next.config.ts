import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable strict mode in dev to prevent double-rendering every component
  reactStrictMode: false,
  
  // Reduce noisy fetch logging in dev server output
  logging: {
    fetches: {
      fullUrl: false,
    },
  },

  serverExternalPackages: [
    "office-to-pdf", 
    "html-pdf-node", 
    "sharp", 
    "passport",
    "bcryptjs"
  ],

  async headers() {
    const r2Origin = process.env.R2_ENDPOINT
      ? (() => {
          try {
            return new URL(process.env.R2_ENDPOINT).origin;
          } catch {
            return process.env.R2_ENDPOINT;
          }
        })()
      : "https://r2.cloudflarestorage.com";

    const vendorCsp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      `img-src 'self' data: blob: ${r2Origin}`,
      `connect-src 'self' ${r2Origin}`,
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/vendor/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: vendorCsp },
        ],
      },
      {
        source: "/api/vendor-onboarding/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: vendorCsp },
        ],
      },
    ];
  },
};

export default nextConfig;
