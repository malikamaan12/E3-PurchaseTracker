"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { AnalyticsFilterBar, AnalyticsFilters } from "@/components/analytics/AnalyticsFilterBar"
import { apiClient } from "@/lib/apiClient"
import { 
  CashFlowChart, 
  BudgetSavingsChart, 
  DistributionDonut, 
  ComplianceRadar 
} from "@/components/analytics/AnalyticsCharts"
import { usePerformance } from "@/context/PerformanceContext"
import { cn } from "@/lib/utils"
import { 
  TrendingUp, 
  Zap, 
  Clock, 
  Target,
  Loader2,
  AlertCircle
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { initMagnetic, initGlow, pageLoad } from "@/lib/animations"
import Link from "next/link"

export default function AnalyticsDashboardPage() {
  const { highPerformanceMode } = usePerformance()
  const [filters, setFilters] = React.useState<AnalyticsFilters>({
    timeframe: "monthly"
  })

  // 1. Fetch Dashboard Data
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["analytics-dashboard", filters],
    queryFn: async () => {
      return apiClient.requests.dashboardAnalytics(filters)
    },
    staleTime: 60 * 1000 // 1 min freshness
  })

  React.useEffect(() => {
    if (!isLoading && !isError) {
      pageLoad(".glass-card, .chart-container, .dashboard-header");
    }
  }, [isLoading, isError]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6">
        <div className="relative">
          <Loader2 className="w-16 h-16 text-brand-primary animate-spin opacity-20" />
          <Loader2 className="w-16 h-16 text-brand-secondary animate-spin absolute inset-0 [animation-duration:1.5s]" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-primary/60 animate-pulse">
          Synchronizing Executive Ledger...
        </p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="p-6 bg-rose-500/10 rounded-full border border-rose-500/20">
          <AlertCircle className="w-10 h-10 text-rose-500" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-lg font-serif text-foreground">Intelligence Offline</p>
          <p className="text-sm text-muted-foreground/60 max-w-xs mx-auto">{(error as any).message}</p>
        </div>
      </div>
    )
  }

  const { cashFlow, budgetVsSavings, compliance, rui, cycleTime, distribution } = data

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Blobs */}
      <div className="fixed inset-0 pointer-events-none -z-10 bg-background transition-colors duration-700">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-primary/10 dark:bg-brand-primary/10 rounded-full blur-[120px] animate-fluid-drift" />
        <div className="absolute bottom-[20%] left-[-5%] w-[35%] h-[35%] bg-brand-secondary/10 dark:bg-brand-secondary/10 rounded-full blur-[100px] animate-fluid-drift [animation-delay:4s]" />
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" style={{ backgroundImage: "url('/noise.svg')" }} />
      </div>

      <div className="flex-1 space-y-12 p-8 pt-6 max-w-[1440px] mx-auto relative z-10">
        <div className="dashboard-header flex flex-col lg:flex-row lg:items-center justify-between gap-6 opacity-0">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="flex items-center group">
                 <img src="/logo-color.png" alt="E3" className="h-10 w-auto dark:hidden transition-transform group-hover:scale-105" />
                 <img src="/logo-white.png" alt="E3" className="h-10 w-auto hidden dark:block transition-transform group-hover:scale-105" />
              </Link>
              <div className="h-8 w-px bg-border/20 mx-2" />
              <h1 className="text-3xl lg:text-4xl font-serif tracking-tighter text-foreground">
                Intelligence <span className="text-brand-primary">Console</span>
              </h1>
            </div>
            <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-[0.2em] opacity-60 pl-1">
              Global procurement velocity and liquidity forecast engine.
            </p>
          </div>
          <AnalyticsFilterBar filters={filters} setFilters={setFilters} />
        </div>

        {/* KPI Overlays */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard 
            title="Cycle Velocity" 
            value={`${cycleTime} Days`} 
            description="Creation to sign-off"
            icon={<Clock className="w-5 h-5" />}
            trend="+12% efficiency"
          />
          <KpiCard 
            title="Budget Adherence" 
            value={`${compliance.budgetAdherence}%`} 
            description="Zero-variation PRs"
            icon={<Target className="w-5 h-5" />}
            trend="Baseline Met"
          />
          <KpiCard 
            title="Forecasted Liability" 
            value={`${cashFlow[0]?.amount.toLocaleString()} QAR`} 
            description="Next 30D projected"
            icon={<TrendingUp className="w-5 h-5" />}
            trend="Liquid"
          />
          <KpiCard 
            title="Negotiated Savings" 
            value={`${budgetVsSavings.reduce((acc: number, curr: any) => acc + curr.savings, 0).toLocaleString()} QAR`} 
            description="Recovered capital"
            icon={<Zap className="w-5 h-5" />}
            trend={`${budgetVsSavings.length} Depts`}
            positive
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          <div className={cn(
            "col-span-full lg:col-span-4 glass-card p-8 border-white/10 opacity-0 relative overflow-hidden",
            highPerformanceMode && "backdrop-blur-none"
          )}>
            <div className="flex flex-col gap-1 mb-10">
              <h3 className="text-2xl font-serif tracking-tight">Financial Liquidity</h3>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest opacity-60">Cash Flow Projection Matrix</p>
            </div>
            <div className="chart-container h-[350px]">
              <CashFlowChart data={cashFlow} />
            </div>
          </div>

          <div className={cn(
            "col-span-full lg:col-span-3 glass-card p-8 border-white/10 opacity-0",
            highPerformanceMode && "backdrop-blur-none"
          )}>
            <div className="flex flex-col gap-1 mb-10">
              <h3 className="text-2xl font-serif tracking-tight">Compliance Score</h3>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest opacity-60">Adherence vs Burn Velocity</p>
            </div>
            <div className="chart-container h-[350px] flex items-center justify-center">
              <ComplianceRadar data={compliance} />
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 h-auto lg:h-[600px]">
          <div className={cn(
            "col-span-full lg:col-span-3 glass-card p-8 border-white/10 opacity-0 flex flex-col h-[400px] lg:h-full",
            highPerformanceMode && "backdrop-blur-none"
          )}>
             <div className="flex flex-col gap-1 mb-10">
              <h3 className="text-2xl font-serif tracking-tight">Department Yield</h3>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest opacity-60">Spent vs Savings Recovery</p>
            </div>
            <div className="chart-container flex-1 min-h-[300px]">
              <BudgetSavingsChart data={budgetVsSavings} />
            </div>
          </div>

          <div className={cn(
            "col-span-full lg:col-span-2 glass-card p-8 border-white/10 opacity-0 flex flex-col h-auto lg:h-full justify-around items-center gap-8",
            highPerformanceMode && "backdrop-blur-none"
          )}>
            <div className="w-full flex-1 min-h-[250px]">
              <DistributionDonut data={distribution.vendor} name="Vendor Concentration" />
            </div>
            <div className="w-full flex-1 min-h-[250px]">
              <DistributionDonut data={distribution.purpose} name="Purpose Allocation" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ title, value, description, icon, trend, positive }: any) {
  const { highPerformanceMode } = usePerformance()
  const cardRef = React.useRef<HTMLDivElement>(null)
  const glowRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!highPerformanceMode && cardRef.current && glowRef.current) {
      const cleanMagnetic = initMagnetic(cardRef.current);
      const cleanGlow = initGlow(cardRef.current, glowRef.current);
      return () => {
        cleanMagnetic?.();
        cleanGlow?.();
      };
    }
  }, [highPerformanceMode]);
  
  return (
    <div 
      ref={cardRef}
      className={cn(
        "glass-card p-8 relative group overflow-hidden opacity-0 cursor-default",
        highPerformanceMode && "backdrop-blur-none transform-none"
      )}
    >
      {/* Dynamic Cursor Glow */}
      <div 
        ref={glowRef}
        className={cn(
          "absolute w-64 h-64 rounded-full blur-[100px] opacity-0 pointer-events-none -translate-x-1/2 -translate-y-1/2 z-0",
          positive ? "bg-brand-secondary/20" : "bg-brand-primary/20"
        )}
      />
      
      <div className="relative z-10">
        <div className="flex flex-row items-center justify-between space-y-0 pb-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity">
            {title}
          </h3>
          <div className="w-12 h-12 rounded-2xl bg-white/5 dark:bg-white/[0.03] border border-white/10 flex items-center justify-center shadow-inner group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
            {icon}
          </div>
        </div>
        <div>
          <div className="text-4xl font-serif font-bold tracking-tighter text-foreground group-hover:text-brand-primary transition-colors duration-500">
            {value}
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-2 font-bold uppercase tracking-widest">
            {description}
          </p>
          <div className={cn(
            "mt-6 inline-flex items-center px-4 py-1.5 rounded-full text-[9px] font-black tracking-[0.2em] uppercase border shadow-sm transition-all duration-500",
            positive 
              ? "bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20 hover:bg-brand-secondary/20 hover:scale-105" 
              : "bg-brand-primary/10 text-brand-primary border-brand-primary/20 hover:bg-brand-primary/20 hover:scale-105"
          )}>
            {trend}
          </div>
        </div>
      </div>
    </div>
  )
}
