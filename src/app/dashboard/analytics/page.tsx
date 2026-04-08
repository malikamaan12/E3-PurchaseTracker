"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BarChart3, RefreshCcw, LayoutDashboard, 
  ChevronRight, CalendarDays, Loader2, AlertCircle 
} from "lucide-react";
import AnalyticsSummary from "@/components/analytics/AnalyticsSummary";
import AnalyticsFilters from "@/components/analytics/AnalyticsFilters";

// Lazy load charts to keep initial bundle light and avoid SSR hydration mismatches with Recharts
const DashboardCharts = dynamic(() => import("@/components/analytics/DashboardCharts"), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] w-full glass-card flex flex-col items-center justify-center gap-4 bg-secondary/5">
      <Loader2 className="w-8 h-8 text-[#5B4B8A] animate-spin" />
      <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.3em]">
        Initializing Analytics Engine...
      </p>
    </div>
  ),
});

export default function AnalyticsDashboard() {
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    departmentId: "",
    vendorId: "",
    status: "",
  });

  // Fetch user for RBAC checking on frontend
  const { data: user } = useQuery({
    queryKey: ["auth-user"],
    queryFn: () => apiClient.auth.getUser(),
  });

  const { 
    data: analyticsData, 
    isLoading, 
    isError, 
    refetch, 
    isRefetching 
  } = useQuery({
    queryKey: ["requests-analytics-filtered", filters],
    queryFn: () => apiClient.requests.analytics(filters),
    staleTime: 300000, // 5 minutes stale time for heavy analytics
    gcTime: 1800000,   // 30 minutes garbage collection
  });

  const isAdmin = user?.role === 'admin' || ["finance", "ceo office", "management"].includes(user?.department?.toLowerCase() || "");

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-6 px-4">
        <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-rose-500" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold font-serif text-foreground">Analytics Sync Failed</h2>
          <p className="text-muted-foreground max-w-sm">We encountered an error while aggregating your financial data. This could be due to complex cross-table joins or session expiry.</p>
        </div>
        <button 
          onClick={() => refetch()}
          className="px-6 py-2.5 bg-[#5B4B8A] text-white rounded-xl font-bold uppercase text-xs tracking-widest hover:brightness-110 transition-all flex items-center gap-2 shadow-lg shadow-[#5B4B8A]/20"
        >
          <RefreshCcw className="w-4 h-4" /> Retry Aggregation
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="max-w-[1600px] mx-auto px-6 pt-10 lg:px-10">
        
        {/* ─── Header ─────────────────────────────────────────────────── */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-1"
          >
            <div className="flex items-center gap-2 text-[#5B4B8A] font-black uppercase tracking-[0.2em] text-[10px]">
              <LayoutDashboard className="w-3.5 h-3.5" />
              Corporate Intelligence
            </div>
            <h1 className="text-4xl md:text-5xl font-serif text-foreground tracking-tight leading-none">
              Control <span className="text-[#2FB7B2]">Analytics</span>
            </h1>
            <p className="text-muted-foreground font-medium text-sm flex items-center gap-2 pt-2">
              <CalendarDays className="w-4 h-4" />
              Real-time procurement metrics for {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3"
          >
            <button 
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
              className="p-3 bg-secondary/50 rounded-xl hover:bg-secondary border border-border transition-all disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCcw className={`w-5 h-5 text-foreground ${isRefetching ? 'animate-spin' : ''}`} />
            </button>
            <div className="h-12 w-px bg-border mx-2 hidden md:block" />
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#2FB7B2]">Aggregation Scope</span>
              <span className="text-xs font-mono font-bold text-muted-foreground uppercase">{isAdmin ? 'Enterprise' : 'Departmental'}</span>
            </div>
          </motion.div>
        </header>

        {/* ─── Dynamic Filtering Engine ────────────────────────────────── */}
        <AnalyticsFilters 
          filters={filters} 
          setFilters={setFilters} 
          isAdmin={isAdmin} 
        />

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-10"
            >
              <div className="grid gap-6 md:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-40 glass-card animate-pulse bg-secondary/10 rounded-2xl" />
                ))}
              </div>
              <div className="h-[500px] glass-card animate-pulse bg-secondary/10 rounded-2xl" />
            </motion.div>
          ) : (
            <motion.div 
              key="content"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="space-y-10"
            >
              {/* Top Row KPI Cards */}
              <AnalyticsSummary data={analyticsData} />

              {/* Main Visualization Grid */}
              <DashboardCharts data={analyticsData} />

              {/* Quick Actions / Footer Scoping */}
              <footer className="flex items-center justify-between pt-10 border-t border-border">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <BarChart3 className="w-4 h-4" />
                  Engine Cluster: <span className="text-[#5B4B8A] font-black">E3-PURCHASE-AGGR-V4</span>
                </div>
                <div className="flex gap-4">
                  <button className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    Export Raw JSON <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </footer>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
