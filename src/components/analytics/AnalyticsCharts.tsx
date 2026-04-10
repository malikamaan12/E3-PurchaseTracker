"use client"

import * as React from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Legend,
  TooltipProps
} from "recharts"
import { usePerformance } from "@/context/PerformanceContext"
import { cn } from "@/lib/utils"

// ─── BRAND CONSTANTS (DYNAMIC) ──────────────────────────────────────────────
const COLOR_PRIMARY = "hsl(var(--brand-primary))"
const COLOR_SECONDARY = "hsl(var(--brand-secondary))"
const COLOR_FOREGROUND = "hsl(var(--foreground))"

// ─── PREMIUM GLASS TOOLTIP ────────────────────────────────────────────────
const GlassTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="z-[2000] glass p-4 border border-white/20 shadow-[0_16px_32px_-8px_rgba(0,0,0,0.3)] backdrop-blur-xl rounded-2xl relative overflow-hidden">
        {/* Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-brand-gradient opacity-80" />
        
        <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-muted-foreground">
          {label}
        </p>
        <div className="space-y-3">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(167,139,250,0.5)]" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-[11px] font-bold text-foreground/80 lowercase tracking-wide">
                  {entry.name}
                </span>
              </div>
              <span className="text-xs font-black tabular-nums text-foreground">
                {entry.value?.toLocaleString()} <span className="text-[8px] opacity-40 font-bold uppercase tracking-tighter">QAR</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

// ─── COMPONENT 1: CASH FLOW AREA ───────────────────────────────────────────
export function CashFlowChart({ data }: { data: any[] }) {
  const { highPerformanceMode } = usePerformance()
  
  return (
    <div className="h-full w-full">
      {(!data || data.length === 0) ? (
        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-muted-foreground uppercase tracking-widest border border-dashed border-border/50 rounded-xl">No Data for Period</div>
      ) : (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="premiumFlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLOR_PRIMARY} stopOpacity={0.2}/>
              <stop offset="100%" stopColor={COLOR_PRIMARY} stopOpacity={0}/>
            </linearGradient>
            <filter id="shadow" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
              <feOffset dx="0" dy="4" result="offsetblur" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.3" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="rgba(255,255,255,0.03)" />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9, fontWeight: 700 }}
            dy={10}
            tickFormatter={(str) => {
              const date = new Date(str);
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9, fontWeight: 700 }}
            tickFormatter={(val) => `${val / 1000}K`}
          />
          <Tooltip 
            content={<GlassTooltip />} 
            cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1, strokeDasharray: "5 5" }}
          />
          <Area 
            type="monotone" 
            dataKey="amount" 
            stroke={COLOR_PRIMARY} 
            strokeWidth={4}
            fillOpacity={1} 
            fill="url(#premiumFlow)"
            isAnimationActive={!highPerformanceMode}
            animationDuration={1500}
            dot={{ r: 4, fill: COLOR_PRIMARY, strokeWidth: 2, stroke: COLOR_FOREGROUND, opacity: 0 }}
            activeDot={{ r: 6, fill: COLOR_FOREGROUND, stroke: COLOR_PRIMARY, strokeWidth: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      )}
    </div>
  )
}

// ─── COMPONENT 2: BUDGET VS SAVINGS STACKED BAR ──────────────────────────────
export function BudgetSavingsChart({ data }: { data: any[] }) {
  const { highPerformanceMode } = usePerformance()

  return (
    <div className="h-full w-full">
      {(!data || data.length === 0) ? (
        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-muted-foreground uppercase tracking-widest border border-dashed border-border/50 rounded-xl">No Data for Period</div>
      ) : (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: -20, right: 30 }} barGap={0}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.03)" />
          <XAxis 
            type="number" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9, fontWeight: 700 }}
          />
          <YAxis 
            type="category" 
            dataKey="department" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: 700 }}
            width={100}
          />
          <Tooltip content={<GlassTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar 
            dataKey="spent" 
            name="Expenditure" 
            stackId="a" 
            fill={COLOR_PRIMARY} 
            radius={[0, 0, 0, 0]}
            isAnimationActive={!highPerformanceMode}
            barSize={12}
          />
          <Bar 
            dataKey="savings" 
            name="Savings Yield" 
            stackId="a" 
            fill={COLOR_SECONDARY} 
            radius={[0, 8, 8, 0]} 
            isAnimationActive={!highPerformanceMode}
            barSize={12}
          />
        </BarChart>
      </ResponsiveContainer>
      )}
    </div>
  )
}

// ─── COMPONENT 3: TWIN DONUT CHARTS ───────────────────────────────────────
export function DistributionDonut({ data, name }: { data: any[], name: string }) {
  const { highPerformanceMode } = usePerformance()

  return (
    <div className="h-full w-full flex flex-col items-center justify-center">
      <p className="text-[10px] font-black tracking-[0.3em] uppercase opacity-40 mb-6">{name}</p>
      {(!data || data.length === 0) ? (
        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-muted-foreground uppercase tracking-widest border border-dashed border-border/50 rounded-xl">No Data for Period</div>
      ) : (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={75}
            outerRadius={100}
            paddingAngle={8}
            dataKey="value"
            isAnimationActive={!highPerformanceMode}
            minAngle={15}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={index % 2 === 0 ? COLOR_PRIMARY : COLOR_SECONDARY}
                style={{ filter: "drop-shadow(0px 8px 16px rgba(0,0,0,0.4))" }}
              />
            ))}
          </Pie>
          <Tooltip content={<GlassTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      )}
    </div>
  )
}

// ─── COMPONENT 4: COMPLIANCE RADAR ──────────────────────────────────────────
export function ComplianceRadar({ data }: { data: any }) {
  const { highPerformanceMode } = usePerformance()
  
  const formattedData = [
    { subject: 'Adherence', value: data.budgetAdherence, fullMark: 100 },
    { subject: 'On-Time', value: data.paymentOnTime, fullMark: 100 },
    { subject: 'Efficiency', value: 95, fullMark: 100 },
    { subject: 'Accuracy', value: 88, fullMark: 100 },
  ]

  return (
    <div className="h-full w-full flex items-center justify-center">
      {(!data || Object.keys(data).length === 0) ? (
         <div className="flex h-full w-full items-center justify-center text-xs font-bold text-muted-foreground uppercase tracking-widest border border-dashed border-border/50 rounded-xl">No Data for Period</div>
      ) : (
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={formattedData}>
          <PolarGrid stroke="rgba(255,255,255,0.05)" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 900 }} 
          />
          <Radar
            name="Compliance"
            dataKey="value"
            stroke={COLOR_SECONDARY}
            fill={COLOR_SECONDARY}
            fillOpacity={0.4}
            isAnimationActive={!highPerformanceMode}
            dot={{ r: 4, fill: COLOR_SECONDARY, strokeWidth: 2, stroke: COLOR_FOREGROUND }}
          />
          <Tooltip content={<GlassTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
      )}
    </div>
  )
}
