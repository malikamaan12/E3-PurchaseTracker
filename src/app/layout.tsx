import "./globals.css";
import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google"; // High-quality Google Fonts
import Providers from "@/components/shared/Providers";
import { cookies } from "next/headers";
import { TOKEN_COOKIE_NAME } from "@/lib/utils/config";
import { decodeJwtPayload } from "@/lib/utils/jwt";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans" });
const outfit = Outfit({ subsets: ["latin"], weight: ["700"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "PurchaseTracker | Enterprise Procurement Hub",
  description: "High-performance purchase request management and vendor onboarding",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // SERVER-SIDE IDENTITY HYDRATION
  // No cryptographic check here - handled by SWR background fetch in AuthProvider.
  // This just eliminates the client-side "Verifying Identity" waterfall.
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE_NAME)?.value;
  
  const initialUser = token ? decodeJwtPayload(token) : null;
  const traceId = Math.random().toString(36).substring(7);

  if (initialUser) {
    console.log(`[SSR][${traceId}] HYDRATION_SUCCESS: ${initialUser.username} | Role: ${initialUser.role}`);
  } else if (token) {
    console.warn(`[SSR][${traceId}] HYDRATION_FAILED: Token present but invalid payload.`);
  } else {
    console.log(`[SSR][${traceId}] ANONYMOUS: No session cookie found.`);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" />
        <meta name="theme-color" content="#5B4B8A" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="E3 Purchase" />
      </head>
      <body className={`${inter.variable} ${outfit.variable} font-sans antialiased selection:bg-brand-primary/20`} suppressHydrationWarning>
        <Providers initialUser={initialUser}>
          <div className="flex min-h-screen flex-col bg-background text-foreground">
            {children}
            <SpeedInsights />
            <Analytics />
          </div>
        </Providers>
      </body>
    </html>
  );
}
