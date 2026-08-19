import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vendor Onboarding Portal | E3 Procurement Hub",
  description: "Secure vendor self-service onboarding and document submission portal",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true,
    },
  },
  other: {
    "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
    "Referrer-Policy": "no-referrer",
  },
};

export default function VendorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-brand-primary/30">
      {children}
    </div>
  );
}
