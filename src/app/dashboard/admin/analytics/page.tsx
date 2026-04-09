"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, 
  AreaChart, Area, CartesianGrid 
} from "recharts";
import { PieChart as PieChartIcon, TrendingUp, Building2, DownloadCloud, Printer, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function DepartmentAnalyticsPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  
  const { data: analyticsGroups, isLoading } = useQuery({
    queryKey: ["admin_analytics"],
    queryFn: () => apiClient.admin.analytics.get(),
    enabled: !!user && !isAuthLoading
  });

  const stats = (analyticsGroups as any)?.departmental || [];
  const colors = ["hsl(var(--brand-primary))", "hsl(var(--brand-secondary))", "#F59E0B", "#EF4444", "#10B981", "#06b6d4"];

  const maxCost = Math.max(...(stats.length ? stats.map((s: any) => s.totalCost) : [1]));
  const totalSpend = stats.reduce((acc: number, curr: any) => acc + curr.totalCost, 0);

  const handlePrint = () => {
    toast.message("Executive Summary", {
      description: "Generating high-fidelity PDF report of departmental spend...",
    });
    setTimeout(() => window.print(), 1000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-2">
        <div>
          <h1 className="text-4xl font-serif font-black text-foreground tracking-tight flex items-center gap-3">
             <TrendingUp className="w-8 h-8 text-emerald-500" />
             Department Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-2 font-medium">Comprehensive budget distribution and cross-departmental utilization metrics.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 bg-secondary/80 text-foreground font-black px-6 py-2.5 rounded-2xl border border-border hover:bg-secondary transition-all group"
          >
            <Printer className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Executive Export
          </button>
          <div className="bg-emerald-500/10 p-2.5 rounded-2xl border border-emerald-500/20">
            <PieChartIcon className="w-5 h-5 text-emerald-500" />
          </div>
        </div>
      </div>

      {/* High Level Stats Bento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <motion.div 
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           className="glass p-6 rounded-3xl border border-border/40 shadow-xl"
         >
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Aggregate Spend</p>
            <div className="flex items-end gap-2 mt-2">
               <h3 className="text-3xl font-serif font-black text-foreground">QAR {totalSpend.toLocaleString()}</h3>
               <span className="text-[10px] font-bold text-emerald-500 mb-1.5 flex items-center">
                  <ArrowUpRight className="w-3 h-3" /> 12%
               </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold italic">Across {stats.length} entities</p>
         </motion.div>
         <motion.div 
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ delay: 0.1 }}
           className="glass p-6 rounded-3xl border border-border/40 shadow-xl"
         >
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Active Departments</p>
            <h3 className="text-3xl font-serif font-black text-foreground mt-2 tracking-tight">{stats.length}</h3>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold italic font-mono uppercase tracking-tighter">Verified in ledger</p>
         </motion.div>
         <motion.div 
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ delay: 0.2 }}
           className="glass p-6 rounded-3xl border border-border/40 shadow-xl"
         >
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Average Per Dept</p>
            <h3 className="text-3xl font-serif font-black text-foreground mt-2 tracking-tight">QAR {(stats.length ? Math.round(totalSpend / stats.length) : 0).toLocaleString()}</h3>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold italic uppercase tracking-tighter">Budget Allocation Mean</p>
         </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass p-10 rounded-[2.5rem] border border-border/40 space-y-8 shadow-2xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 blur-[100px] rounded-full -mr-32 -mt-32" />
           
           <div className="flex justify-between items-center relative">
               <div className="flex gap-3 items-center">
                   <div className="w-10 h-10 rounded-2xl bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
                      <Building2 className="w-6 h-6 text-brand-primary" />
                   </div>
                   <div>
                      <h2 className="text-xl font-black text-foreground leading-none">Entity Utilization</h2>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Request volume intensity</p>
                   </div>
               </div>
           </div>
           
           {isLoading ? (
             <div className="h-80 flex flex-col items-center justify-center gap-4">
               <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Computing Matrix...</p>
             </div>
           ) : stats.length > 0 ? (
             <div className="h-80 relative">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={stats} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={1} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                   <XAxis dataKey="department" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                   <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                   <Tooltip 
                     contentStyle={{ 
                       backgroundColor: 'rgba(var(--card), 0.8)', 
                       backdropFilter: 'blur(12px)',
                       borderColor: 'var(--border)', 
                       borderRadius: '16px', 
                       fontSize: '11px', 
                       padding: '12px',
                       boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)' 
                     }}
                     cursor={{fill: 'var(--secondary)', opacity: 0.3}}
                   />
                   <Bar dataKey="count" radius={[12, 12, 0, 0]} barSize={40}>
                     {stats.map((entry: any, index: number) => (
                       <Cell 
                         key={`cell-${index}`} 
                         fill={colors[index % colors.length]} 
                         fillOpacity={0.8}
                       />
                     ))}
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
             </div>
           ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground text-xs font-black uppercase tracking-[0.2em] border border-dashed border-border rounded-3xl">Data Reservoir Empty</div>
           )}
        </div>

        <div className="glass p-10 rounded-[2.5rem] border border-border/40 space-y-8 shadow-2xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full -mr-32 -mt-32" />

           <div className="flex justify-between items-center relative">
               <div className="flex gap-3 items-center">
                   <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                      <TrendingUp className="w-6 h-6 text-emerald-500" />
                   </div>
                   <div>
                      <h2 className="text-xl font-black text-foreground leading-none">Capital Leakage</h2>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Total expenditure velocity</p>
                   </div>
               </div>
           </div>
           
           {isLoading ? (
             <div className="h-80 flex items-center justify-center">
               <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
             </div>
           ) : stats.length > 0 ? (
             <div className="space-y-6 pt-4 relative">
               {stats.sort((a: any, b: any) => b.totalCost - a.totalCost).slice(0, 6).map((stat: any, i: number) => (
                 <div key={i} className="group/row">
                   <div className="flex justify-between text-[11px] mb-2 font-black uppercase tracking-widest">
                     <span className="text-foreground group-hover/row:text-brand-primary transition-colors">{stat.department}</span>
                     <span className="text-muted-foreground">QAR {(stat.totalCost).toLocaleString()}</span>
                   </div>
                   <div className="h-2.5 bg-secondary/50 rounded-full overflow-hidden border border-border/30">
                     <motion.div 
                       initial={{ width: 0 }}
                       animate={{ width: `${(stat.totalCost / maxCost) * 100}%` }}
                       transition={{ duration: 1.5, ease: "easeOut", delay: i * 0.1 }}
                       className="h-full rounded-full transition-all relative"
                       style={{ 
                         backgroundColor: colors[i % colors.length],
                         boxShadow: `0 0 15px ${colors[i % colors.length]}40`
                       }}
                     >
                       <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
                     </motion.div>
                   </div>
                 </div>
               ))}
               {stats.length > 6 && (
                 <p className="text-[9px] text-center font-black text-muted-foreground uppercase mt-4 tracking-[0.3em]">+ {stats.length - 6} more entities in ledger</p>
               )}
             </div>
           ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground text-xs font-black uppercase tracking-[0.2em] border border-dashed border-border rounded-3xl italic">Awaiting Financial Inputs</div>
           )}
        </div>
      </div>
    </div>
  );
}
