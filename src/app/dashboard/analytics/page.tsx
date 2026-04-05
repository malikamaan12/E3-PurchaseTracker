"use client";

import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, Users, Activity, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';

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

const statusBreakdown = [
  { name: 'Approved', value: 400 },
  { name: 'Pending', value: 300 },
  { name: 'Rejected', value: 300 },
  { name: 'Draft', value: 200 },
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
          { title: "Total Spending", value: "$45,232", change: "+20.1%", icon: DollarSign },
          { title: "Active Vendors", value: "2,350", change: "+180 new", icon: Users },
          { title: "Purchase Requests", value: "12,234", change: "+19%", icon: Activity },
          { title: "Fulfillment Time", value: "4.2 Days", change: "-0.5 days", icon: TrendingUp },
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
            <div className="text-xs text-brand-secondary font-semibold">{kpi.change} from last month</div>
            {/* Subtle background glow */}
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
                  data={statusBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {statusBreakdown.map((entry, index) => (
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
