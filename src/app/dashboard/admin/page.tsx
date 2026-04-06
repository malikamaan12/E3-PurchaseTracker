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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { 
            label: "Total Projects", 
            value: analytics?.projects?.length || 0, 
            sub: "Active Validated", 
            icon: <BarChart3 className="w-5 h-5 text-primary" /> 
          },
          { 
            label: "Categories", 
            value: analytics?.categories?.length || 0, 
            sub: "CAPEX / OPEX Split", 
            icon: <PieChartIcon className="w-5 h-5 text-emerald-500" /> 
          },
          { 
            label: "Departments", 
            value: analytics?.departmental?.length || 0, 
            sub: "Involved in Spend", 
            icon: <Users className="w-5 h-5 text-blue-500" /> 
          },
          { 
            label: "System Health", 
            value: "100%", 
            sub: "Serverless Native", 
            icon: <Globe className="w-5 h-5 text-cyan-500" /> 
          },
        ].map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={i} 
            className="bg-card p-5 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all group"
          >
             <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  {stat.icon}
                </div>
                <TrendingUp className="w-4 h-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
             </div>
            <div className="mt-4">
              <p className="text-3xl font-serif font-black text-foreground tracking-tight">{stat.value}</p>
              <div className="flex justify-between items-end mt-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                <p className="text-[10px] text-emerald-500 font-bold uppercase">{stat.sub}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

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
      <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
         <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-serif font-bold">Departmental Breakdown</h3>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(analytics?.departmental || []).map((dept: any, i: number) => (
               <div key={i} className="flex items-center justify-between p-4 bg-secondary/20 rounded-2xl border border-border/50">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                        {dept.department.charAt(0)}
                     </div>
                     <div>
                        <p className="text-xs font-bold uppercase tracking-widest">{dept.department}</p>
                        <p className="text-[10px] text-muted-foreground font-medium">{dept.count} Requests</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className="text-sm font-bold text-foreground">QAR {dept.totalCost.toLocaleString()}</p>
                     <div className="w-16 h-1 bg-secondary rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: '65%' }}></div>
                     </div>
                  </div>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
}
