"use client";

import TopNav from "@/components/layout/TopNav";
import AmbientBackground from "@/components/layout/AmbientBackground";
import { useAuth } from "@/context/AuthContext";
import { LoadingState } from "@/components/shared/LoadingState";
import { Sidebar } from "@/components/layout/Sidebar";

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
      {/* Global Top Nav - Now handles all primary navigation */}
      <TopNav />
      
      {/* Scrollable Page Content */}
      <main className="flex-1 overflow-y-auto bg-background px-4 sm:px-6 py-6 md:px-12 md:py-10 custom-scrollbar relative pb-safe">
        <div className="max-w-[1600px] mx-auto w-full">
          {children}
        </div>
        
        <AmbientBackground />
      </main>
    </div>
  );
}
