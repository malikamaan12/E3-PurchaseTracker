"use client";

import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { TrendingUp, Users, Activity, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';

// Lazy load Recharts components to reduce initial bundle size
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });
const AreaChart = dynamic(() => import('recharts').then(mod => mod.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then(mod => mod.Area), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const PieChart = dynamic(() => import('recharts').then(mod => mod.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then(mod => mod.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then(mod => mod.Cell), { ssr: false });
const Legend = dynamic(() => import('recharts').then(mod => mod.Legend), { ssr: false });
const BarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(mod => mod.Bar), { ssr: false });

// Mock data to unblock UI while preserving schema match
const monthlyData = [
  { name: 'Jan', spending: 4000, requests: 24, budget: 5000 },
  { name: 'Feb', spending: 3000, requests: 13, budget: 5000 },
  { name: 'Mar', spending: 2000, requests: 98, budget: 5000 },
  { name: 'Apr', spending: 2780, requests: 39, budget: 5000 },
  { name: 'May', spending: 1890, requests: 48, budget: 5000 },
  { name: 'Jun', spending: 2390, requests: 38, budget: 5000 },
];

const vendorPerformanceData = [
  { name: 'A-Grade (90-100)', value: 45 },
  { name: 'B-Grade (80-89)', value: 30 },
  { name: 'C-Grade (70-79)', value: 15 },
  { name: 'Poor (<70)', value: 10 },
];

const departmentalData = [
  { name: 'IT', budget: 4000, spent: 2400 },
  { name: 'HR', budget: 3000, spent: 1398 },
  { name: 'Operations', budget: 2000, spent: 9800 },
  { name: 'Marketing', budget: 2780, spent: 3908 },
  { name: 'Sales', budget: 1890, spent: 4800 },
];

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)'
];

export default function AnalyticsDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['requests-analytics-native'],
    queryFn: () => apiClient.requests.analytics(),
  });

  const approved = stats?.approved || { count: 0, total: 0 };
  const pending = stats?.pending || { count: 0, total: 0 };
  const rejected = stats?.rejected || { count: 0, total: 0 };
  const draft = stats?.draft || { count: 0, total: 0 };

  const statusData = [
    { name: 'Approved', value: approved.count },
    { name: 'Pending', value: pending.count },
    { name: 'Rejected', value: rejected.count },
    { name: 'Draft', value: draft.count },
  ];

  const totalVolume = approved.total + pending.total + rejected.total + draft.total;

  return (
    <div className="flex flex-col gap-8 p-8 max-w-7xl mx-auto w-full">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif text-foreground tracking-tight">System Analytics</h1>
          <p className="text-muted-foreground mt-1">High-performance metrics and departmental insights</p>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Total Volume", value: `${totalVolume.toLocaleString()} QAR`, change: "Cumulative", icon: DollarSign },
          { title: "Pending count", value: pending.count, change: "Awaiting Action", icon: Activity },
          { title: "Approved count", value: approved.count, change: "Finalized", icon: TrendingUp },
          { title: "Rejection Rate", value: `${((rejected.count / (approved.count + rejected.count || 1)) * 100).toFixed(1)}%`, change: "Total Lifecycle", icon: Users },
        ].map((kpi, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="glass-card p-6 flex flex-col gap-2 relative overflow-hidden group"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold tracking-wider text-muted-foreground uppercase">{kpi.title}</span>
              <kpi.icon className="w-5 h-5 text-brand-primary" />
            </div>
            <div className="text-3xl font-serif text-foreground mt-2">{kpi.value}</div>
            <div className="text-xs text-brand-secondary font-semibold transition-colors">{kpi.change}</div>
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-brand-primary/5 rounded-full blur-3xl group-hover:bg-brand-primary/10 transition-all" />
          </motion.div>
        ))}
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
        
        {/* Monthly Spending Area Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6 lg:col-span-4"
        >
          <div className="mb-6">
            <h2 className="text-lg font-bold text-foreground tracking-tight">Monthly Spending Trend</h2>
            <p className="text-xs text-muted-foreground">Trailing 6 months overall expenditure</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSpending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--brand-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '12px', color: 'var(--foreground)' }}
                  itemStyle={{ color: 'var(--foreground)' }}
                />
                <Area type="monotone" dataKey="spending" stroke="var(--brand-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorSpending)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Request Status Breakdown Pie Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6 lg:col-span-3"
        >
          <div className="mb-6">
            <h2 className="text-lg font-bold text-foreground tracking-tight">Status Breakdown</h2>
            <p className="text-xs text-muted-foreground">Distribution of all active requests</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '12px' }}
                  itemStyle={{ color: 'var(--foreground)' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  wrapperStyle={{ fontSize: '12px', color: 'var(--muted-foreground)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
        
        {/* Vendor Performance Bar Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-6 lg:col-span-3"
        >
          <div className="mb-6">
            <h2 className="text-lg font-bold text-foreground tracking-tight">Vendor Quality Index</h2>
            <p className="text-xs text-muted-foreground">Categorization by performance grade</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendorPerformanceData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={110} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '12px' }}
                  cursor={{ fill: 'var(--secondary)', opacity: 0.2 }}
                />
                <Bar dataKey="value" fill="var(--chart-2)" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Departmental Budgets Bar Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-6 lg:col-span-4"
        >
          <div className="mb-6">
            <h2 className="text-lg font-bold text-foreground tracking-tight">Departmental Budget vs Spend</h2>
            <p className="text-xs text-muted-foreground">Remaining allocations per department</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentalData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                 <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                 <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                 <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '12px' }}
                    cursor={{ fill: 'var(--secondary)', opacity: 0.2 }}
                 />
                 <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--muted-foreground)' }} />
                 <Bar dataKey="budget" name="Total Budget" fill="var(--chart-1)" radius={[4, 4, 0, 0]} barSize={20} />
                 <Bar dataKey="spent" name="Actual Spend" fill="var(--chart-4)" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
