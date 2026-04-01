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
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${outfit.variable} font-sans selection:bg-brand-primary/20`}>
        <Providers>
          <div className="flex min-h-screen flex-col bg-zinc-950">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
