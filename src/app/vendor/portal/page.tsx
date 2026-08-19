"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { VendorPortalHeader } from "@/components/vendor-portal/VendorPortalHeader";
import { VendorPortalWizard } from "@/components/vendor-portal/VendorPortalWizard";
import {
  VendorPortalSubmittedScreen,
  VendorPortalExpiredScreen,
  VendorPortalRevokedScreen,
} from "@/components/vendor-portal/VendorPortalStatusScreens";

export default function VendorPortalPage() {
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorState, setErrorState] = useState<"none" | "expired" | "revoked" | "unauthorized">("none");

  const loadSession = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/vendor-onboarding/session");
      const data = await res.json();

      if (!res.ok) {
        if (data.error?.toLowerCase().includes("expired")) {
          setErrorState("expired");
        } else if (data.error?.toLowerCase().includes("revoked")) {
          setErrorState("revoked");
        } else {
          setErrorState("unauthorized");
        }
        return;
      }

      setSessionData(data.data);
    } catch (err) {
      setErrorState("unauthorized");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Loading Vendor Portal...</p>
        </div>
      </div>
    );
  }

  if (errorState === "expired") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center">
        <VendorPortalExpiredScreen />
      </div>
    );
  }

  if (errorState === "revoked") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center">
        <VendorPortalRevokedScreen />
      </div>
    );
  }

  if (errorState === "unauthorized" || !sessionData) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md">
          <h2 className="text-lg font-semibold text-white">Session Inactive</h2>
          <p className="text-xs text-slate-400 mt-2">
            No active vendor onboarding session found. Please open the link from your invitation email.
          </p>
        </div>
      </div>
    );
  }

  const { draft, vendor, documents, requiredDocumentTypes, onboardingStatus, onboardingNotes, expiresAt, remainingSeconds, isReadOnly } = sessionData;
  const companyName = draft?.companyName || vendor?.companyName || "Vendor Organization";

  // If already submitted, show submitted screen
  if (onboardingStatus === "submitted" || isReadOnly) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <VendorPortalHeader
          companyName={companyName}
          expiresAt={expiresAt}
          remainingSeconds={remainingSeconds}
          onboardingStatus={onboardingStatus}
          isReadOnly={true}
        />
        <main className="flex-1 flex flex-col justify-center">
          <VendorPortalSubmittedScreen
            companyName={companyName}
            submittedAt={draft?.submittedAt}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <VendorPortalHeader
        companyName={companyName}
        expiresAt={expiresAt}
        remainingSeconds={remainingSeconds}
        onboardingStatus={onboardingStatus}
        isReadOnly={false}
        onExpire={() => setErrorState("expired")}
      />
      <main className="flex-1">
        <VendorPortalWizard
          initialDraft={draft}
          requiredDocumentTypes={requiredDocumentTypes}
          initialDocuments={documents}
          onboardingStatus={onboardingStatus}
          onboardingNotes={onboardingNotes}
          isReadOnly={false}
          onSubmitSuccess={() => loadSession()}
        />
      </main>
    </div>
  );
}
