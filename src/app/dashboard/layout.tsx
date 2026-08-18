"use client";

import TopNav from "@/components/layout/TopNav";
import { MobileBottomNavigation } from "@/components/mobile/MobileBottomNavigation";
import { useAuth } from "@/context/AuthContext";
import { LoadingState } from "@/components/shared/LoadingState";
import { CommandPalette } from "@/components/shared/CommandPalette";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <LoadingState message="Verifying Identity..." />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen bg-background transition-colors duration-300">
      {/* Global Top Nav - Handles header and search */}
      <TopNav />
      <CommandPalette />
      
      {/* Scrollable Page Content */}
      <main className="flex-1 overflow-y-auto bg-background custom-scrollbar relative pb-20 md:pb-safe">
        <div className="max-w-[2000px] mx-auto px-3.5 sm:px-6 lg:px-8 xl:px-12 py-3.5 md:py-8 w-full">
          {children}
        </div>
      </main>

      {/* Global Mobile Bottom Navigation */}
      <MobileBottomNavigation />
    </div>
  );
}
