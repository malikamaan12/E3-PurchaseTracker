"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { AnalyticsFilterBar, AnalyticsFilters } from "@/components/analytics/AnalyticsFilterBar"
import { apiClient } from "@/lib/apiClient"
import dynamic from "next/dynamic"

const CashFlowChart = dynamic(() => import("@/components/analytics/AnalyticsCharts").then(mod => mod.CashFlowChart), { 
  ssr: false, 
  loading: () => <div className="animate-pulse bg-secondary/50 w-full h-full rounded-xl" /> 
})
const BudgetSavingsChart = dynamic(() => import("@/components/analytics/AnalyticsCharts").then(mod => mod.BudgetSavingsChart), { 
  ssr: false, 
  loading: () => <div className="animate-pulse bg-secondary/50 w-full h-full rounded-xl" /> 
})
const DistributionDonut = dynamic(() => import("@/components/analytics/AnalyticsCharts").then(mod => mod.DistributionDonut), { 
  ssr: false, 
  loading: () => <div className="animate-pulse bg-secondary/50 w-full h-full rounded-xl" /> 
})
const ComplianceRadar = dynamic(() => import("@/components/analytics/AnalyticsCharts").then(mod => mod.ComplianceRadar), { 
  ssr: false, 
  loading: () => <div className="animate-pulse bg-secondary/50 w-full h-full rounded-xl" /> 
})
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
      pageLoad(".chart-container, .dashboard-header");
    }
  }, [isLoading, isError]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6">
        <div className="relative">
          <Loader2 className="w-16 h-16 text-primary animate-spin opacity-20" />
          <Loader2 className="w-16 h-16 text-emerald-500 animate-spin absolute inset-0 [animation-duration:1.5s]" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-primary/80 animate-pulse">
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
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 dark:bg-primary/10 rounded-full blur-[120px] animate-fluid-drift" />
        <div className="absolute bottom-[20%] left-[-5%] w-[35%] h-[35%] bg-emerald-500/10 dark:bg-emerald-500/10 rounded-full blur-[100px] animate-fluid-drift [animation-delay:4s]" />
      </div>

      <div className="flex-1 space-y-8 md:space-y-12 p-4 md:p-8 pt-6 w-full relative z-10">
        <div className="dashboard-header flex flex-col lg:flex-row lg:items-center justify-between gap-6 opacity-0">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="flex items-center group">
                 <img src="/logo-color.png" alt="E3" className="h-10 w-auto dark:hidden transition-transform group-hover:scale-105" />
                 <img src="/logo-white.png" alt="E3" className="h-10 w-auto hidden dark:block transition-transform group-hover:scale-105" />
              </Link>
              <div className="h-8 w-px bg-border/20 mx-2" />
              <h1 className="text-3xl lg:text-4xl font-serif tracking-tighter text-foreground">
                Intelligence <span className="text-primary">Console</span>
              </h1>
            </div>
            <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider pl-1">
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
            index={0}
          />
          <KpiCard 
            title="Budget Adherence" 
            value={`${compliance.budgetAdherence}%`} 
            description="Zero-variation PRs"
            icon={<Target className="w-5 h-5" />}
            trend="Baseline Met"
            index={1}
          />
          <KpiCard 
            title="Forecasted Liability" 
            value={`${cashFlow[0]?.amount.toLocaleString()} QAR`} 
            description="Next 30D projected"
            icon={<TrendingUp className="w-5 h-5" />}
            trend="Liquid"
            index={2}
          />
          <KpiCard 
            title="Negotiated Savings" 
            value={`${budgetVsSavings.reduce((acc: number, curr: any) => acc + curr.savings, 0).toLocaleString()} QAR`} 
            description="Recovered capital"
            icon={<Zap className="w-5 h-5" />}
            trend={`${budgetVsSavings.length} Depts`}
            positive
            index={3}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          <div className={cn(
            "col-span-full lg:col-span-4 bg-background/80 backdrop-blur-xl p-8 rounded-3xl border border-border/50 shadow-lg relative overflow-hidden transition-all duration-300 hover:border-primary/40 animate-slide-up",
            highPerformanceMode && "backdrop-blur-none"
          )} style={{ animationDelay: "0.2s" }}>
            <div className="flex flex-col gap-1 mb-10">
              <h3 className="text-2xl font-serif tracking-tight text-foreground">Financial Liquidity</h3>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Cash Flow Projection Matrix</p>
            </div>
            <div className="chart-container h-[350px]">
              <CashFlowChart data={cashFlow} />
            </div>
          </div>

          <div className={cn(
            "col-span-full lg:col-span-3 bg-background/80 backdrop-blur-xl p-8 rounded-3xl border border-border/50 shadow-lg transition-all duration-300 hover:border-primary/40 animate-slide-up",
            highPerformanceMode && "backdrop-blur-none"
          )} style={{ animationDelay: "0.25s" }}>
            <div className="flex flex-col gap-1 mb-10">
              <h3 className="text-2xl font-serif tracking-tight text-foreground">Compliance Score</h3>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Adherence vs Burn Velocity</p>
            </div>
            <div className="chart-container h-[350px] flex items-center justify-center">
              <ComplianceRadar data={compliance} />
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 h-auto lg:h-[600px]">
          <div className={cn(
            "col-span-full lg:col-span-3 bg-background/80 backdrop-blur-xl p-8 rounded-3xl border border-border/50 shadow-lg flex flex-col h-[400px] lg:h-full transition-all duration-300 hover:border-primary/40 animate-slide-up",
            highPerformanceMode && "backdrop-blur-none"
          )} style={{ animationDelay: "0.3s" }}>
             <div className="flex flex-col gap-1 mb-10">
              <h3 className="text-2xl font-serif tracking-tight text-foreground">Department Yield</h3>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Spent vs Savings Recovery</p>
            </div>
            <div className="chart-container flex-1 min-h-[300px]">
              <BudgetSavingsChart data={budgetVsSavings} />
            </div>
          </div>

          <div className={cn(
            "col-span-full lg:col-span-2 bg-background/80 backdrop-blur-xl p-8 rounded-3xl border border-border/50 shadow-lg flex flex-col h-auto lg:h-full justify-around items-center gap-8 transition-all duration-300 hover:border-primary/40 animate-slide-up",
            highPerformanceMode && "backdrop-blur-none"
          )} style={{ animationDelay: "0.35s" }}>
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

function KpiCard({ title, value, description, icon, trend, positive, index = 0 }: any) {
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
        "bg-background/80 backdrop-blur-xl p-8 rounded-3xl border border-border/50 shadow-lg relative group overflow-hidden cursor-default transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/40 animate-slide-up",
        highPerformanceMode && "backdrop-blur-none transform-none"
      )}
      style={{ animationDelay: `${Math.min(index * 0.05, 0.3)}s` }}
    >
      {/* Dynamic Cursor Glow */}
      <div 
        ref={glowRef}
        className={cn(
          "absolute w-64 h-64 rounded-full blur-[100px] opacity-0 pointer-events-none -translate-x-1/2 -translate-y-1/2 z-0",
          positive ? "bg-emerald-500/20" : "bg-primary/20"
        )}
      />
      
      <div className="relative z-10">
        <div className="flex flex-row items-center justify-between space-y-0 pb-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
            {title}
          </h3>
          <div className="w-12 h-12 rounded-2xl bg-secondary/50 border border-border flex items-center justify-center shadow-inner group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500 text-primary">
            {icon}
          </div>
        </div>
        <div>
          <div className="text-4xl font-serif font-bold tracking-tighter text-foreground group-hover:text-primary transition-colors duration-500">
            {value}
          </div>
          <p className="text-xs text-muted-foreground mt-2 font-semibold uppercase tracking-wider">
            {description}
          </p>
          <div className={cn(
            "mt-6 inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase border shadow-sm transition-all duration-500",
            positive 
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 hover:scale-105" 
              : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 hover:scale-105"
          )}>
            {trend}
          </div>
        </div>
      </div>
    </div>
  )
}
