"use client";

import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)'
];

interface DashboardChartsProps {
  monthlyData: any[];
  statusData: any[];
  vendorPerformanceData: any[];
  departmentalData: any[];
}

export default function DashboardCharts({ 
  monthlyData, 
  statusData, 
  vendorPerformanceData, 
  departmentalData 
}: DashboardChartsProps) {
  return (
    <>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
        {/* Monthly Spending Area Chart */}
        <div className="glass-card p-6 lg:col-span-4">
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
        </div>

        {/* Request Status Breakdown Pie Chart */}
        <div className="glass-card p-6 lg:col-span-3">
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
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
        {/* Vendor Performance Bar Chart */}
        <div className="glass-card p-6 lg:col-span-3">
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
        </div>

        {/* Departmental Budgets Bar Chart */}
        <div className="glass-card p-6 lg:col-span-4">
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
        </div>
      </div>
    </>
  );
}
