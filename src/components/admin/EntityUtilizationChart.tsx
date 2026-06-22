"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const colors = ["hsl(var(--brand-primary))", "hsl(var(--brand-secondary))", "#F59E0B", "#EF4444", "#10B981", "#06b6d4"];

export default function EntityUtilizationChart({ stats }: { stats: any[] }) {
  return (
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
          {stats.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={colors[index % colors.length]} 
              fillOpacity={0.8}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
