import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable strict mode in dev to prevent double-rendering every component
  reactStrictMode: false,
  compress: true,
  poweredByHeader: false,
  
  // Reduce noisy fetch logging in dev server output
  logging: {
    fetches: {
      fullUrl: false,
    },
  },

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "recharts",
      "framer-motion",
      "clsx",
      "tailwind-merge",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-tooltip"
    ],
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

    const appCsp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      `img-src 'self' data: blob: ${r2Origin} https://*.googleusercontent.com`,
      `connect-src 'self' ${r2Origin} https://*.vercel-insights.com https://va.vercel-scripts.com`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" },
          { key: "Content-Security-Policy", value: appCsp },
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
