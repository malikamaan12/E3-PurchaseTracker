"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { PieChart as PieChartIcon, TrendingUp, Building2 } from "lucide-react";

export default function DepartmentAnalyticsPage() {
  const { data: stats = [], isLoading } = useQuery({
    queryKey: ["admin_analytics"],
    queryFn: () => apiClient.admin.analytics.get(),
  });

  const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

  const maxCost = Math.max(...(stats.length ? stats.map((s: any) => s.totalCost) : [1]));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground tracking-tight">Department Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium italic">View budget distribution and request frequency across all departments.</p>
        </div>
        <div className="bg-secondary/50 px-4 py-2 rounded-xl flex items-center gap-2 border border-border transition-colors">
          <PieChartIcon className="w-5 h-5 text-emerald-500" />
        </div>
      </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card p-8 rounded-3xl border border-border space-y-6 shadow-xl transition-colors">
             <div className="flex gap-2 items-center">
                 <Building2 className="w-5 h-5 text-brand-primary" />
                 <h2 className="text-lg font-bold text-foreground">Request Volume by Dept</h2>
             </div>
             
             {isLoading ? (
               <div className="h-64 flex items-center justify-center">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
               </div>
             ) : stats.length > 0 ? (
               <div className="h-64">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={stats}>
                     <XAxis dataKey="department" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                     <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                     <Tooltip 
                       contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '12px', fontSize: '12px', color: 'var(--foreground)' }}
                       cursor={{fill: 'var(--secondary)', opacity: 0.5}}
                     />
                     <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                       {stats.map((entry: any, index: number) => (
                         <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                       ))}
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
               </div>
             ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm font-medium italic">No data available</div>
             )}
          </div>

          <div className="bg-card p-8 rounded-3xl border border-border space-y-6 shadow-xl transition-colors">
             <div className="flex gap-2 items-center">
                 <TrendingUp className="w-5 h-5 text-emerald-500" />
                 <h2 className="text-lg font-bold text-foreground">Total Expenditure (QAR)</h2>
             </div>
             
             {isLoading ? (
               <div className="h-64 flex items-center justify-center">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
               </div>
             ) : stats.length > 0 ? (
               <div className="space-y-4 pt-4">
                 {stats.sort((a: any, b: any) => b.totalCost - a.totalCost).map((stat: any, i: number) => (
                   <div key={i}>
                     <div className="flex justify-between text-xs mb-1">
                       <span className="font-bold text-foreground">{stat.department}</span>
                       <span className="font-mono text-muted-foreground font-bold">{(stat.totalCost).toLocaleString()} QAR</span>
                     </div>
                     <div className="h-2 bg-secondary rounded-full overflow-hidden">
                       <div 
                         className="h-full rounded-full transition-all duration-1000"
                         style={{ 
                           width: `${(stat.totalCost / maxCost) * 100}%`,
                           backgroundColor: colors[i % colors.length]
                         }}
                       />
                     </div>
                   </div>
                 ))}
               </div>
             ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm font-medium italic">No data available</div>
             )}
          </div>
       </div>
    </div>
  );
}
