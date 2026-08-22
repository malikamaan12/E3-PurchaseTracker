"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Legacy Vendor Onboarding Route — Retired
 * Automatically redirects to the universal Quick-Create Vendor workflow on the Vendors Dashboard.
 */
export default function VendorOnboardingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/vendors?quickCreate=1");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm font-semibold text-muted-foreground">
        Redirecting to Quick-Create Vendor...
      </p>
    </div>
  );
}
