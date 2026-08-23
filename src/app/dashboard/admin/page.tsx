"use client";

import {
  Users,
  Shield,
  Lock,
  Globe,
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart3,
  Calendar,
  AlertCircle,
  Archive,
  ArrowRight,
  Briefcase
} from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";

const ProjectUtilizationChart = dynamic(() => import("@/components/admin/ProjectUtilizationChart"), {
  ssr: false,
  loading: () => <div className="h-[400px] flex items-center justify-center text-muted-foreground text-xs uppercase tracking-widest animate-pulse border border-dashed border-border rounded-3xl">Loading Chart...</div>
});

const CategorySpendChart = dynamic(() => import("@/components/admin/CategorySpendChart"), {
  ssr: false,
  loading: () => <div className="h-[250px] flex items-center justify-center text-muted-foreground text-xs uppercase tracking-widest animate-pulse">Loading Chart...</div>
});
import { PurgeRequestsModal } from "@/components/admin/PurgeRequestsModal";
import { ShieldAlert } from "lucide-react";
import { Building2, FolderKanban } from "lucide-react";
import { usePageTitle } from "@/lib/hooks/usePageTitle";

export default function AdminOverviewPage() {
  usePageTitle("Admin Overview");
  const { user, isLoading: isAuthLoading, isSuperAdmin } = useAuth();

  const { data: analytics, isLoading, error, refetch } = useQuery({
    queryKey: ["admin_analytics"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics");
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    enabled: !!user && !isAuthLoading
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.3em] animate-pulse">Syncing Command Center...</p>
      </div>
    );
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  if (error) {
    return (
      <div className="p-8 bg-destructive/10 border border-destructive/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-destructive">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <div>
            <p className="font-semibold text-sm">Analytics data is temporarily unavailable.</p>
            <p className="text-xs text-muted-foreground mt-0.5">The command center could not load analytics. Please try refreshing.</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-destructive/20 hover:bg-destructive/30 text-destructive text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shrink-0"
        >
          Retry
        </button>
      </div>
    );
  }

  const COLORS = ['#5B4B8A', '#2FB7B2', '#F59E0B', '#EF4444', '#10B981'];

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground tracking-tight">Financial Command Center</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2 font-medium">Real-time budget utilization and cross-departmental spend analysis.</p>
        </div>
        <div className="flex items-center gap-2 bg-secondary/50 px-3.5 py-2 rounded-xl border border-border">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Top Level Stats */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
      >
        {[
          {
            label: "Total Projects",
            value: analytics?.totalActiveProjects ?? analytics?.projects?.length ?? 0,
            sub: "Active Validated",
            icon: <BarChart3 className="w-5 h-5 text-primary" />,
            trend: "+12%"
          },
          {
            label: "Categories",
            value: analytics?.categories?.length || 0,
            sub: "CAPEX / OPEX Split",
            icon: <PieChartIcon className="w-5 h-5 text-emerald-500" />,
            trend: "Optimal"
          },
          {
            label: "Departments",
            value: analytics?.departmental?.length || 0,
            sub: "Involved in Spend",
            icon: <Users className="w-5 h-5 text-blue-500" />,
            trend: "Global"
          },
          {
            label: "System Health",
            value: "100%",
            sub: "Serverless Native",
            icon: <Globe className="w-5 h-5 text-primary" />,
            trend: "Stable"
          },
        ].map((stat, i) => (
          <motion.div
            variants={item}
            key={i}
            className="glass p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-border/40 shadow-xl hover:shadow-primary/10 transition-all group relative overflow-hidden"
          >
             <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-3xl rounded-full -mr-12 -mt-12 group-hover:bg-primary/10 transition-colors" />
             <div className="flex justify-between items-start relative">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-secondary/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors border border-border/50">
                  {stat.icon}
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-tighter">{stat.trend}</span>
                  <TrendingUp className="w-4 h-4 text-emerald-500 opacity-20 group-hover:opacity-100 transition-opacity" />
                </div>
             </div>
            <div className="mt-4 sm:mt-6">
              <p className="text-3xl sm:text-4xl font-serif font-black text-foreground tracking-tight group-hover:translate-x-1 transition-transform">{stat.value}</p>
              <div className="flex justify-between items-end mt-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="text-[11px] text-primary font-bold uppercase tracking-tight">{stat.sub}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Advanced Project Utilization Chart */}
        <div className="lg:col-span-2">
           <ProjectUtilizationChart data={analytics?.projects || []} />
        </div>

        {/* Category Distribution */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-card p-6 rounded-3xl border border-border shadow-sm"
        >
          <div className="mb-8">
            <h3 className="text-lg font-serif font-bold flex items-center gap-2">
               <PieChartIcon className="w-5 h-5 text-primary" />
               Category Spend
            </h3>
            <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-widest leading-none">Hierarchical Classification</p>
          </div>
          <div className="h-[250px] flex items-center justify-center relative">
            <CategorySpendChart data={analytics?.categories || []} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Spent</span>
                <span className="text-lg font-serif font-bold text-foreground">
                   {(analytics?.categories || []).reduce((acc: number, curr: any) => acc + curr.spent, 0).toLocaleString()}
                </span>
            </div>
          </div>
          <div className="mt-8 space-y-3">
             {(analytics?.categories || []).map((cat: any, i: number) => (
               <div key={i} className="flex justify-between items-center bg-secondary/30 p-2 rounded-xl">
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                    <span className="text-[10px] font-bold uppercase tracking-wider">{cat.categoryName}</span>
                 </div>
                 <span className="text-[10px] font-bold text-primary">QAR {cat.spent.toLocaleString()}</span>
               </div>
             ))}
          </div>
        </motion.div>
      </div>

      {/* System Tools & Quick Access */}
      <motion.div
        variants={item}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <div className="col-span-1 md:col-span-2 lg:col-span-4">
           <h3 className="text-sm font-black uppercase tracking-[0.3em] text-muted-foreground mb-4 pl-1">Institutional System Tools</h3>
        </div>

        {[
          ...(isSuperAdmin ? [
            {
              title: "Enterprise Backups",
              sub: "Cloud Vault & Orchestration",
              path: "/dashboard/admin/backups",
              icon: <Archive className="w-5 h-5" />,
              colorClass: "bg-primary/10 border-primary/20 text-primary"
            },
            {
              title: "Identity Controls",
              sub: "User Access & Permissions",
              path: "/dashboard/admin/users",
              icon: <Users className="w-5 h-5" />,
              colorClass: "bg-blue-500/10 border-blue-500/20 text-blue-500"
            },
          ] : [
            {
              title: "Department Matrix",
              sub: "Organization & Structure",
              path: "/dashboard/admin/departments",
              icon: <Building2 className="w-5 h-5" />,
              colorClass: "bg-primary/10 border-primary/20 text-primary"
            },
            {
              title: "Project Budgets",
              sub: "Budget & Allocation Management",
              path: "/dashboard/admin/sub-purposes",
              icon: <Briefcase className="w-5 h-5" />,
              colorClass: "bg-purple-500/10 border-purple-500/20 text-purple-500"
            },
          ]),
          {
            title: "Budget Taxonomy",
            sub: "Purpose & Category Matrix",
            path: "/dashboard/admin/purposes",
            icon: <BarChart3 className="w-5 h-5" />,
            colorClass: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
          },
          {
            title: "System Diagnostics",
            sub: "Heuristic & Audit Logs",
            path: "/dashboard/admin/diagnostics",
            icon: <AlertCircle className="w-5 h-5" />,
            colorClass: "bg-amber-500/10 border-amber-500/20 text-amber-500"
          }
        ].map((tool, i) => (
          <Link key={i} href={tool.path}>
            <div className="glass-card p-6 border-border hover:border-primary/40 transition-all group flex flex-col gap-4">
               <div className={cn(
                 "w-12 h-12 rounded-2xl flex items-center justify-center border transition-colors group-hover:scale-110",
                 tool.colorClass
               )}>
                  {tool.icon}
               </div>
               <div>
                  <h4 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">{tool.title}</h4>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-1">{tool.sub}</p>
               </div>
               <div className="flex items-center gap-2 mt-2 text-xs font-bold text-primary uppercase opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0">
                  Access Protocol <ArrowRight className="w-3.5 h-3.5" />
               </div>
            </div>
          </Link>
        ))}
      </motion.div>

      {/* Dept Spend Summary Table */}
      <motion.div
        variants={item}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="glass p-6 sm:p-10 rounded-[2.5rem] border border-border/40 shadow-2xl relative overflow-hidden"
      >
         <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/5 blur-[100px] rounded-full -mr-48 -mb-48" />

         <div className="flex justify-between items-center mb-8 sm:mb-10 relative">
            <div>
              <h3 className="text-xl sm:text-2xl font-serif font-black text-foreground tracking-tight">Departmental Breakdown</h3>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Cross-Functional Capital Allocation</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
               <TrendingUp className="w-6 h-6 text-emerald-500" />
            </div>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative">
            {(analytics?.departmental || []).map((dept: any, i: number) => (
               <div key={i} className="flex flex-col gap-4 p-6 bg-secondary/20 hover:bg-secondary/40 rounded-[2rem] border border-border/50 transition-all group cursor-default">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm border border-primary/20 group-hover:scale-110 transition-transform">
                          {dept.department.charAt(0)}
                       </div>
                       <div>
                          <p className="text-xs font-black uppercase tracking-widest text-foreground group-hover:text-primary transition-colors">{dept.department}</p>
                          <p className="text-xs text-muted-foreground font-semibold tracking-tight">{dept.count} Validated Requests</p>
                       </div>
                    </div>
                  </div>
                  <div className="space-y-2 mt-2">
                     <div className="flex justify-between items-end">
                        <p className="text-xl font-serif font-black text-foreground">QAR {dept.totalCost.toLocaleString()}</p>
                        <span className="text-[10px] font-bold text-emerald-500 uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">Active</span>
                     </div>
                     <div className="h-2 bg-secondary/50 rounded-full overflow-hidden border border-border/40">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: '65%' }}
                          transition={{ duration: 1, delay: i * 0.05 }}
                          className="h-full bg-primary rounded-full relative shadow-[0_0_10px_rgba(111,42,230,0.3)]"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
                        </motion.div>
                     </div>
                  </div>
               </div>
            ))}
         </div>
      </motion.div>

      {/* Danger Zone: Institutional Purge (Super Admin Only) */}
      {isSuperAdmin && (
        <motion.div
          variants={item}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="glass-card p-10 border-rose-500/20 bg-rose-500/5 shadow-2xl shadow-rose-500/5 relative overflow-hidden"
        >
           <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 blur-[80px] rounded-full -mr-32 -mt-32" />

           <div className="flex flex-col md:flex-row justify-between items-center gap-8 relative">
              <div className="flex items-center gap-6">
                 <div className="w-16 h-16 rounded-[2rem] bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-500 shadow-xl shadow-rose-500/10">
                    <ShieldAlert className="w-8 h-8" />
                 </div>
                 <div>
                    <h3 className="text-2xl font-serif font-black text-foreground tracking-tight uppercase">System Management & Danger Zone</h3>
                    <p className="text-[10px] font-black text-rose-500/60 uppercase tracking-[0.2em] mt-1">Institutional Reset & Test Data Purge</p>
                    <p className="text-xs text-muted-foreground mt-3 max-w-md leading-relaxed">
                      This section is reserved for Super Admin governance. Use the "Purge" protocol only before a production launch to eliminate all test purchase requests and reset the procurement state.
                    </p>
                 </div>
              </div>

              <div className="shrink-0">
                 <PurgeRequestsModal />
              </div>
           </div>
        </motion.div>
      )}
    </div>
  );
}
