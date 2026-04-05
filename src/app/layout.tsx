import "./globals.css";
import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google"; // High-quality Google Fonts
import Providers from "@/components/shared/Providers";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans" });
const outfit = Outfit({ subsets: ["latin"], weight: ["700"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "PurchaseTracker | Enterprise Procurement Hub",
  description: "High-performance purchase request management and vendor onboarding",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var theme = localStorage.getItem('theme');
                var supportDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches === true;
                if (!theme && supportDarkMode) theme = 'dark';
                if (!theme) theme = 'light';
                document.documentElement.className = theme;
              } catch (e) {}
            })();
          `,
        }} />
      </head>
      <body className={`${inter.variable} ${outfit.variable} font-sans selection:bg-brand-primary/20`} suppressHydrationWarning>
        <Providers>
          <div className="flex min-h-screen flex-col bg-background text-foreground">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
