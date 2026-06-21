"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ShieldOff } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { isAdmin, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && !isAdmin) {
      toast.error("Access denied. Admin privileges required.");
      router.replace("/dashboard/requests");
    }
  }, [isAdmin, isLoading, user]);

  // Still loading auth state AND no user payload — show spinner
  // If we have a user from optimistic hydration, we skip this to prevent flicker
  if (isLoading && !user) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full"
        />
        <p className="text-muted-foreground text-xs font-mono tracking-widest uppercase animate-pulse">
          Verifying privileges...
        </p>
      </div>
    );
  }

  // Not admin — show blocked UI while redirect fires
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center">
          <ShieldOff className="w-8 h-8 text-rose-500" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          You don&apos;t have permission to view the Admin panel. Redirecting...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-8 min-h-[calc(100vh-120px)] w-full">
      {/* Admin specific sidebar - Dynamic width enabled */}
      <AdminSidebar />

      {/* Main admin content area */}
      <div className="flex-1 w-full bg-card p-8 rounded-3xl border border-border relative shadow-xl overflow-hidden transition-all duration-500">
        <div className="absolute inset-0 bg-background mix-blend-saturation pointer-events-none opacity-20" />
        <div className="relative z-10">
          {children}
        </div>
      </div>
    </div>
  );
}
