"use client";

import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { TrendingUp, Users, Activity, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';

// Lazy load the entire Charts component to resolve type errors with individual Recharts exports
const DashboardCharts = dynamic(() => import('@/components/analytics/DashboardCharts'), { 
  ssr: false,
  loading: () => <div className="h-[600px] w-full glass animate-pulse rounded-2xl flex items-center justify-center text-muted-foreground font-mono text-xs uppercase tracking-widest">Loading Analytics Engine...</div>
});

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
            <div className="text-3xl font-serif text-foreground mt-2">{kpi.value.toLocaleString()}</div>
            <div className="text-xs text-brand-secondary font-semibold transition-colors">{kpi.change}</div>
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-brand-primary/5 rounded-full blur-3xl group-hover:bg-brand-primary/10 transition-all" />
          </motion.div>
        ))}
      </div>

      <DashboardCharts 
        monthlyData={monthlyData}
        statusData={statusData}
        vendorPerformanceData={vendorPerformanceData}
        departmentalData={departmentalData}
      />
    </div>
  );
}
