"use client";

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  Legend
} from "recharts";
import { TrendingUp, Wallet, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

interface ProjectUtilizationChartProps {
  data: any[];
}

export default function ProjectUtilizationChart({ data }: ProjectUtilizationChartProps) {
  const chartData = data.map(project => ({
    name: project.projectName,
    allocated: Number(project.totalBudget),
    spent: Number(project.spent),
    utilization: project.totalBudget > 0 ? (project.spent / project.totalBudget) * 100 : 0
  }));

  const COLORS = ['#6F2AE6', '#15CDD8', '#F59E0B', '#EF4444', '#10B981'];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-card p-8 rounded-[2.5rem] border border-border shadow-2xl"
    >
      <div className="flex justify-between items-start mb-10">
        <div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 mb-3">
             <TrendingUp className="w-3 h-3" />
             Real-time Utilization
          </div>
          <h3 className="text-2xl font-serif font-bold flex items-center gap-2">
            Project Financial Exposure
          </h3>
          <p className="text-[10px] font-black text-muted-foreground mt-1 uppercase tracking-widest leading-none">Top 10 High-Spend Infrastructure Projects</p>
        </div>
        <div className="flex flex-col items-end">
           <span className="text-[10px] font-black bg-secondary/50 px-3 py-1.5 rounded-xl border border-border text-muted-foreground uppercase tracking-widest">QAR Currency</span>
        </div>
      </div>

      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={160}
              tick={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip 
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                borderColor: 'hsl(var(--border))', 
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 'bold',
                padding: '16px',
                boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)'
              }}
              formatter={(value, name) => [
                <span className="text-foreground">QAR {Number(value).toLocaleString()}</span>,
                <span className="uppercase text-[10px] tracking-widest opacity-60">{name}</span>
              ]}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36} 
              iconType="circle"
              wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: '20px' }}
            />
            <Bar dataKey="allocated" name="Budget Ceiling" fill="rgba(111, 42, 230, 0.1)" radius={[0, 10, 10, 0]} barSize={24} />
            <Bar dataKey="spent" name="Actual Spend" radius={[0, 10, 10, 0]} barSize={12}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.utilization > 90 ? '#EF4444' : (entry.utilization > 70 ? '#F59E0B' : '#6F2AE6')} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        {chartData.slice(0, 4).map((p, i) => (
          <div key={i} className="p-4 bg-secondary/30 rounded-2xl border border-border/50">
             <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest line-clamp-1">{p.name}</p>
             <div className="flex items-center justify-between mt-1">
                <span className={`text-sm font-black font-serif ${p.utilization > 90 ? 'text-rose-500' : 'text-foreground'}`}>
                   {p.utilization.toFixed(1)}%
                </span>
                <div className={`w-1.5 h-1.5 rounded-full ${p.utilization > 90 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
             </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
