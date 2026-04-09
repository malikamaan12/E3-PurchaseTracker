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
  AlertCircle
} from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  Legend
} from "recharts";
import ProjectUtilizationChart from "@/components/admin/ProjectUtilizationChart";

export default function AdminOverviewPage() {
  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ["admin_analytics"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics");
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    }
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] animate-pulse">Syncing Command Center...</p>
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
      <div className="p-8 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center gap-4 text-destructive">
        <AlertCircle className="w-6 h-6" />
        <p className="font-medium">Failed to load analytics engine. Please check your database connection.</p>
      </div>
    );
  }

  const COLORS = ['#6F2AE6', '#15CDD8', '#F59E0B', '#EF4444', '#10B981'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground tracking-tight">Financial Command Center</h1>
          <p className="text-sm text-muted-foreground mt-2 font-medium">Real-time budget utilization and cross-departmental spend analysis.</p>
        </div>
        <div className="flex items-center gap-2 bg-secondary/50 px-4 py-2 rounded-xl border border-border">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Top Level Stats */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {[
          { 
            label: "Total Projects", 
            value: analytics?.projects?.length || 0, 
            sub: "Active Validated", 
            icon: <BarChart3 className="w-5 h-5 text-brand-primary" />,
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
            icon: <Globe className="w-5 h-5 text-cyan-500" />,
            trend: "Stable"
          },
        ].map((stat, i) => (
          <motion.div 
            variants={item}
            key={i} 
            className="glass p-6 rounded-3xl border border-border/40 shadow-xl hover:shadow-brand-primary/10 transition-all group relative overflow-hidden"
          >
             <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/5 blur-3xl rounded-full -mr-12 -mt-12 group-hover:bg-brand-primary/10 transition-colors" />
             <div className="flex justify-between items-start relative">
                <div className="w-12 h-12 rounded-2xl bg-secondary/50 flex items-center justify-center group-hover:bg-brand-primary/10 transition-colors border border-border/50">
                  {stat.icon}
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter">{stat.trend}</span>
                  <TrendingUp className="w-4 h-4 text-emerald-500 opacity-20 group-hover:opacity-100 transition-opacity" />
                </div>
             </div>
            <div className="mt-6">
              <p className="text-4xl font-serif font-black text-foreground tracking-tight group-hover:translate-x-1 transition-transform">{stat.value}</p>
              <div className="flex justify-between items-end mt-2">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                <p className="text-[9px] text-brand-primary font-black uppercase tracking-tighter opacity-70">{stat.sub}</p>
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
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics?.categories || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="spent"
                  nameKey="categoryName"
                >
                  {(analytics?.categories || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="hsl(var(--card))" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    borderColor: 'hsl(var(--border))', 
                    borderRadius: '12px',
                    fontSize: '11px'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
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

      {/* Dept Spend Summary Table */}
      <motion.div 
        variants={item}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="glass p-10 rounded-[2.5rem] border border-border/40 shadow-2xl relative overflow-hidden"
      >
         <div className="absolute bottom-0 right-0 w-96 h-96 bg-brand-primary/5 blur-[100px] rounded-full -mr-48 -mb-48" />
         
         <div className="flex justify-between items-center mb-10 relative">
            <div>
              <h3 className="text-2xl font-serif font-black text-foreground tracking-tight">Departmental Breakdown</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1">Cross-Functional Capital Allocation</p>
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
                       <div className="w-10 h-10 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary font-black text-sm border border-brand-primary/20 group-hover:scale-110 transition-transform">
                          {dept.department.charAt(0)}
                       </div>
                       <div>
                          <p className="text-xs font-black uppercase tracking-widest text-foreground group-hover:text-brand-primary transition-colors">{dept.department}</p>
                          <p className="text-[9px] text-muted-foreground font-black uppercase tracking-tighter">{dept.count} Validated Requests</p>
                       </div>
                    </div>
                  </div>
                  <div className="space-y-2 mt-2">
                     <div className="flex justify-between items-end">
                        <p className="text-xl font-serif font-black text-foreground">QAR {dept.totalCost.toLocaleString()}</p>
                        <span className="text-[9px] font-black text-emerald-500 uppercase">Active</span>
                     </div>
                     <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          whileInView={{ width: '65%' }}
                          transition={{ duration: 1, delay: i * 0.05 }}
                          className="h-full bg-brand-primary rounded-full relative shadow-[0_0_10px_rgba(111,42,230,0.3)]"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
                        </motion.div>
                     </div>
                  </div>
               </div>
            ))}
         </div>
      </motion.div>
    </div>
  );
}
