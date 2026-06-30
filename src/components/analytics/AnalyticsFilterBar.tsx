"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/apiClient"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/Select"
import { Combobox } from "@/components/ui/Combobox"
import { usePerformance } from "@/context/PerformanceContext"
import { cn } from "@/lib/utils"
import { Filter, X, ChevronRight } from "lucide-react"

export interface AnalyticsFilters {
  timeframe: "weekly" | "monthly" | "yearly"
  departmentId?: string
  projectId?: string
  purposeId?: string
  vendorId?: string
  startDate?: Date
  endDate?: Date
}

interface AnalyticsFilterBarProps {
  filters: AnalyticsFilters
  setFilters: React.Dispatch<React.SetStateAction<AnalyticsFilters>>
}

export function AnalyticsFilterBar({ filters, setFilters }: AnalyticsFilterBarProps) {
  const { highPerformanceMode } = usePerformance()

  // 1. Fetch Filter Options
  const { data: depts } = useQuery({
    queryKey: ["departments"],
    queryFn: () => apiClient.departments.list(),
  })

  const { data: vendors } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => apiClient.vendors.list(),
  })

  const { data: subPurposes } = useQuery({
    queryKey: ["sub-purposes"],
    queryFn: () => apiClient.requests.getSubPurposes(),
  })

  const { data: purposes } = useQuery({
    queryKey: ["purposes"],
    queryFn: () => apiClient.purposes.list(),
  })

  const handleReset = () => {
    setFilters({
      timeframe: "monthly"
    })
  }

  const activeFiltersCount = [
    filters.departmentId, 
    filters.projectId, 
    filters.vendorId, 
    filters.purposeId
  ].filter(Boolean).length

  return (
    <div className={cn(
      "bg-background/80 backdrop-blur-md p-1.5 rounded-2xl border border-border/50 shadow-lg flex items-center gap-1.5 transition-all duration-500",
      highPerformanceMode && "backdrop-blur-none"
    )}>
      {/* Timeframe Select - Compact & Elegant */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-secondary/50 rounded-xl border border-border/50">
        <div className="p-1 bg-primary/10 rounded-md">
            <Filter className="w-3 h-3 text-primary" />
        </div>
        <Select 
          value={filters.timeframe} 
          onValueChange={(val: any) => setFilters(prev => ({ ...prev, timeframe: val }))}
        >
          <SelectTrigger className="border-none bg-transparent hover:bg-transparent h-7 p-0 px-2 text-xs font-bold uppercase tracking-wider min-w-[100px]">
            <SelectValue placeholder="Timeframe" />
          </SelectTrigger>
          <SelectContent className="glass">
            <SelectItem value="weekly">Weekly View</SelectItem>
            <SelectItem value="monthly">Monthly View</SelectItem>
            <SelectItem value="yearly">Yearly View</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground/50" />

      {/* Advanced Filters Trigger/Container */}
      <div className="flex items-center gap-2">
        <div className="w-[180px]">
          <Combobox 
            placeholder="Departments"
            options={(depts || []).map(d => ({ value: d.id.toString(), label: d.name }))}
            value={filters.departmentId}
            onChange={(val) => setFilters(prev => ({ ...prev, departmentId: val }))}
            className="h-9 border-none bg-secondary/50 text-xs uppercase font-bold tracking-wider hover:bg-secondary transition-colors"
          />
        </div>

        <div className="w-[180px]">
          <Combobox 
            placeholder="Projects"
            options={(subPurposes || []).map(p => ({ value: p.id.toString(), label: p.name }))}
            value={filters.projectId}
            onChange={(val) => setFilters(prev => ({ ...prev, projectId: val }))}
            className="h-9 border-none bg-secondary/50 text-xs uppercase font-bold tracking-wider hover:bg-secondary transition-colors"
          />
        </div>

        <div className="w-[180px]">
          <Combobox 
            placeholder="Vendors"
            options={(vendors || []).map(v => ({ value: v.id.toString(), label: v.companyName }))}
            value={filters.vendorId}
            onChange={(val) => setFilters(prev => ({ ...prev, vendorId: val }))}
            className="h-9 border-none bg-secondary/50 text-xs uppercase font-bold tracking-wider hover:bg-secondary transition-colors"
          />
        </div>
      </div>

      {activeFiltersCount > 0 && (
        <>
          <div className="w-[1px] h-4 bg-border/50 mx-1" />
          <button 
            onClick={handleReset}
            className="p-2 hover:bg-rose-500/10 text-rose-500/80 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider group"
          >
            <X className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-300" />
            <span className="hidden lg:inline">Clear</span>
            <span className="bg-rose-500/10 px-1.5 py-0.5 rounded-md text-[10px]">{activeFiltersCount}</span>
          </button>
        </>
      )}
    </div>
  )
}
