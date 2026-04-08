"use client";

import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, LineChart, Line
} from 'recharts';
import { motion } from "framer-motion";
import { 
  Info, TrendingDown, Target, Zap, 
  ShieldCheck, Hourglass, FolderKanban 
} from "lucide-react";

const E3_PALETTE = [
  '#5B4B8A', // Purple
  '#2FB7B2', // Teal
  '#9B8CC5', // Light Purple
  '#6ACECB', // Light Teal
  '#2E2A5E', // Dark Indigo
];

interface DashboardChartsProps {
  data: {
    cashFlow: Array<{ month: string; value: number }>;
    bottlenecks: Array<{ subject: string; A: number }>;
    vendorRisk: Array<{ name: string; value: number }>;
    budgets: Array<{ name: string; allocated: number; actual: number }>;
    compliance: Array<{ name: string; value: number }>;
    cycleTime: Array<{ month: string; days: number }>;
    projectSpend: Array<{ name: string; spent: number; budget: number }>;
  };
}

export default function DashboardCharts({ data }: DashboardChartsProps) {
  const cashFlow = data?.cashFlow || [];
  const bottlenecks = data?.bottlenecks || [];
  const vendorRisk = data?.vendorRisk || [];
  const budgets = data?.budgets || [];
  const compliance = data?.compliance || [];
  const cycleTime = data?.cycleTime || [];
  const projectSpend = data?.projectSpend || [];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.3 }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="grid gap-6 md:grid-cols-2 lg:grid-cols-12"
    >
      {/* 1. Cash Flow Forecast - Predictive Area Chart */}
      <motion.div variants={item} className="glass-card p-6 lg:col-span-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-[#2FB7B2]" />
              Cash Flow Projection
            </h3>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">Next 90-Day Liquidity Forecast</p>
          </div>
        </div>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cashFlow} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2FB7B2" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#5B4B8A" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 700 }} />
              <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} tick={{ fontWeight: 700 }} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 12, 33, 0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '16px' }} itemStyle={{ color: '#2FB7B2' }} />
              <Area type="monotone" dataKey="value" stroke="#2FB7B2" strokeWidth={4} fillOpacity={1} fill="url(#colorCash)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* 2. NEW: Payment Compliance - Doughnut Chart */}
      <motion.div variants={item} className="glass-card p-6 lg:col-span-4">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Payment Compliance
          </h3>
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">On-Time Accuracy Rate</p>
        </div>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={compliance}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={85}
                dataKey="value"
                stroke="none"
              >
                <Cell fill="#2FB7B2" />
                <Cell fill="#5B4B8A" />
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 12, 33, 0.9)', border: 'none', borderRadius: '12px' }} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* 3. NEW: Project Spend - Stacked Bar Chart */}
      <motion.div variants={item} className="glass-card p-6 lg:col-span-12">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-sky-400" />
            Project Spend vs. Total Budget
          </h3>
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">Multi-Project Burn rate Analysis</p>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={projectSpend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tick={{ fontWeight: 800 }} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'rgba(15, 12, 33, 0.95)', border: 'none', borderRadius: '16px' }} />
              <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 800, paddingBottom: '10px' }} />
              <Bar dataKey="spent" name="Consumed Budget" stackId="a" fill="#2FB7B2" radius={[0, 0, 0, 0]} barSize={40} />
              <Bar dataKey="budget" name="Remaining Allocation" stackId="a" fill="#5B4B8A" radius={[6, 6, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* 4. NEW: Cycle Time Trend - Line Chart */}
      <motion.div variants={item} className="glass-card p-6 lg:col-span-8">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
            <Hourglass className="w-5 h-5 text-amber-400" />
            Procurement Velocity Trend
          </h3>
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">Average Days from Submission to Approval</p>
        </div>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cycleTime} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} unit=" Days" />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 12, 33, 0.95)', border: 'none', borderRadius: '16px' }} />
              <Line type="monotone" dataKey="days" stroke="#2FB7B2" strokeWidth={4} dot={{ fill: '#2FB7B2', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* 5. Bottleneck Matrix - Radar Chart */}
      <motion.div variants={item} className="glass-card p-6 lg:col-span-4">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
            <Zap className="w-5 h-5 text-fuchsia-400" />
            Approval Bottlenecks
          </h3>
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">Departmental Turnaround Hour Index</p>
        </div>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={bottlenecks}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontWeight: 700 }} />
              <Radar name="Hours" dataKey="A" stroke="#5B4B8A" fill="#5B4B8A" fillOpacity={0.6} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 12, 33, 0.9)', border: 'none', borderRadius: '12px' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* 6. Budget Utilization - Progress Bars */}
      <motion.div variants={item} className="glass-card p-6 lg:col-span-12">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
              <Info className="w-5 h-5 text-sky-400" />
              Departmental Budget Health
            </h3>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">Resource Utilization Index</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets.map((b, i) => {
            const percent = b.allocated > 0 ? (b.actual / b.allocated) * 100 : 0;
            const isCritical = percent > 90;
            return (
              <div key={i} className="space-y-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-black text-foreground uppercase tracking-tight">{b.name}</span>
                  <span className={`text-xs font-mono font-black ${isCritical ? "text-rose-500" : "text-[#2FB7B2]"}`}>
                    {percent.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2.5 bg-secondary/30 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(percent, 100)}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className={`h-full ${isCritical ? 'bg-rose-500' : 'bg-[#5B4B8A]'}`}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground/50">
                  <span>Actual: {b.actual.toLocaleString()}</span>
                  <span>Budget: {b.allocated.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
