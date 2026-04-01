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

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6b7280'];

export default function AnalyticsDashboard() {
  return (
    <div className="flex flex-col gap-8 p-8 max-w-7xl mx-auto w-full">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif text-white tracking-tight">System Analytics</h1>
          <p className="text-zinc-400 mt-1">High-performance metrics and departmental insights</p>
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
              <span className="text-sm font-bold tracking-wider text-zinc-400 uppercase">{kpi.title}</span>
              <kpi.icon className="w-5 h-5 text-brand-primary" />
            </div>
            <div className="text-3xl font-serif text-white mt-2">{kpi.value}</div>
            <div className="text-xs text-brand-secondary font-semibold">{kpi.change} from last month</div>
            {/* Subtle background glow */}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-brand-primary/10 rounded-full blur-3xl group-hover:bg-brand-primary/20 transition-all" />
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
            <h2 className="text-lg font-bold text-white tracking-tight">Monthly Spending Trend</h2>
            <p className="text-xs text-zinc-500">Trailing 6 months overall expenditure</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSpending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7156a2" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#7156a2" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.9)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="spending" stroke="#7156a2" strokeWidth={3} fillOpacity={1} fill="url(#colorSpending)" />
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
            <h2 className="text-lg font-bold text-white tracking-tight">Status Breakdown</h2>
            <p className="text-xs text-zinc-500">Distribution of all active requests</p>
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
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.9)', borderColor: 'rgba(255,255,255,0.1)' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }}
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
            <h2 className="text-lg font-bold text-white tracking-tight">Vendor Quality Index</h2>
            <p className="text-xs text-zinc-500">Categorization by performance grade</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendorPerformanceData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} width={110} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.9)', borderColor: 'rgba(255,255,255,0.1)' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
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
            <h2 className="text-lg font-bold text-white tracking-tight">Departmental Budget vs Spend</h2>
            <p className="text-xs text-zinc-500">Remaining allocations per department</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentalData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                 <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                 <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                 <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.9)', borderColor: 'rgba(255,255,255,0.1)' }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                 />
                 <Legend wrapperStyle={{ fontSize: '12px' }} />
                 <Bar dataKey="budget" name="Total Budget" fill="#7156a2" radius={[4, 4, 0, 0]} barSize={20} />
                 <Bar dataKey="spent" name="Actual Spend" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
