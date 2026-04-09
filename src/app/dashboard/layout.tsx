"use client";

import TopNav from "@/components/layout/TopNav";
import AmbientBackground from "@/components/layout/AmbientBackground";
import { useAuth } from "@/context/AuthContext";
import { LoadingState } from "@/components/shared/LoadingState";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();

  // OPTIMISTIC HYDRATION CHECK
  // We only block the UI if we are loading AND we don't have a user payload from the server.
  if (isLoading && !user) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <LoadingState message="Verifying Identity..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden transition-colors duration-300">
      {/* Top Navigation */}
      <TopNav />
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto bg-background px-12 py-10 custom-scrollbar relative">
          <div className="max-w-[1600px] mx-auto w-full">
            {children}
          </div>
          
          <AmbientBackground />
        </main>
      </div>
    </div>
  );
}
