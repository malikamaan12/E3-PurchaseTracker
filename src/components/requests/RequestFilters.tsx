"use client";

import { useState, useEffect } from "react";
import { 
  Search, 
  Filter, 
  X, 
  ChevronDown, 
  Calendar, 
  DollarSign, 
  Building2, 
  Tag, 
  User,
  AlertCircle,
  Archive,
  TrendingUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

interface RequestFiltersProps {
  filters: any;
  setFilters: (filters: any) => void;
  metadata: {
    departments: any[];
    vendors: any[];
    purposes: any[];
    subPurposes?: any[];
  };
  counts?: {
    all?: number;
    pending?: number;
    approved?: number;
    rejected?: number;
    myQueue?: number;
  };
}

export function RequestFilters({ filters, setFilters, metadata, counts }: RequestFiltersProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  
  // 1. Basic Search: Still automatic with debounce
  const [localSearch, setLocalSearch] = useState(filters.search || "");
  
  // 2. Advanced: Manual apply to prevent premature range filtering
  const [pendingAdvanced, setPendingAdvanced] = useState({
    priority: filters.priority || "all",
    department: filters.department || "all",
    purpose: filters.purpose || "all",
    purposeCategoryId: filters.purposeCategoryId || "all",
    subPurposeId: filters.subPurposeId || "all",
    vendor: filters.vendor || "all",
    dateFrom: filters.dateFrom || "",
    dateTo: filters.dateTo || "",
    costMin: filters.costMin || "",
    costMax: filters.costMax || "",
    requestNo: filters.requestNo || ""
  });

  const activeFilterCount = Object.keys(filters).filter(key => {
    if (key === "status" && filters[key] === "all") return false;
    if (key === "search" && !filters[key]) return false;
    if (filters[key] === "all" || filters[key] === "") return false;
    return true;
  }).length;

  // Debounce main search board
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev: any) => {
        if (localSearch !== prev.search) {
          return { ...prev, search: localSearch };
        }
        return prev;
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [localSearch, setFilters]);

  // Sync pending when panel opens or when parent filters change (e.g. clear)
  useEffect(() => {
    setPendingAdvanced({
      priority: filters.priority || "all",
      department: filters.department || "all",
      purpose: filters.purpose || "all",
      purposeCategoryId: filters.purposeCategoryId || "all",
      subPurposeId: filters.subPurposeId || "all",
      vendor: filters.vendor || "all",
      dateFrom: filters.dateFrom || "",
      dateTo: filters.dateTo || "",
      costMin: filters.costMin || "",
      costMax: filters.costMax || "",
      requestNo: filters.requestNo || ""
    });
    if (!filters.search) setLocalSearch("");
  }, [filters, isAdvancedOpen]);

  const updatePending = (key: string, value: any) => {
    setPendingAdvanced(prev => ({ ...prev, [key]: value }));
    setFilters((prev: any) => ({ ...prev, [key]: value }));
  };

  const applyAdvanced = () => {
    setFilters({
      ...filters,
      ...pendingAdvanced
    });
    setIsAdvancedOpen(false);
  };

  const clearFilters = () => {
    const defaultFilters = {
      status: "all",
      priority: "all",
      department: "all",
      vendor: "all",
      purpose: "all",
      purposeCategoryId: "all",
      subPurposeId: "all",
      dateFrom: "",
      dateTo: "",
      costMin: "",
      costMax: "",
      search: "",
      requestNo: ""
    };
    setFilters(defaultFilters);
    setLocalSearch("");
    setPendingAdvanced(defaultFilters);
  };

  const statusOptions = ["all", "pending", "approved", "rejected", "draft", "changes_requested"];
  const priorityOptions = ["all", "low", "medium", "high"];
  const purposeTypes = ["all", "PROJECT", "MALL", "E3 EVENT", "BUSINESS GROWTH"];

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Search and Basic Status */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between w-full">
        <div className="flex-1 w-full max-w-xl relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-brand-primary transition-colors z-10" />
          <Input 
            placeholder="Search by title, PR #, vendor, department, requester, purpose..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-11 h-11 min-h-[44px] rounded-xl text-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
          <div className="flex p-1 bg-secondary/60 border border-border rounded-xl shrink-0">
            {statusOptions.slice(0, 4).map(status => {
              const count = counts ? (counts as any)[status] : undefined;
              const isActive = filters.status === status;
              return (
                <button
                  key={status}
                  onClick={() => {
                    if (filters.status !== status) {
                      setFilters({ ...filters, status });
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold capitalize transition-all whitespace-nowrap min-h-[38px] ${
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{status}</span>
                  {typeof count === 'number' && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                      isActive 
                        ? "bg-white/20 text-white" 
                        : "bg-secondary text-muted-foreground"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <Button 
            variant={isAdvancedOpen || activeFilterCount > 0 ? "secondary" : "outline"}
            size="sm"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="flex items-center gap-2 h-11 min-h-[44px] px-3.5 rounded-xl shrink-0"
          >
            <Filter className="w-4 h-4" />
            <span className="text-xs font-semibold">Filters</span>
            {activeFilterCount > 0 && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-brand-primary text-white text-[11px] font-bold">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={`w-4 h-4 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} />
          </Button>

          {activeFilterCount > 0 && (
            <button 
              onClick={clearFilters}
              className="p-2.5 rounded-xl border border-border bg-secondary/50 text-muted-foreground hover:text-rose-500 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
              title="Clear all filters"
              aria-label="Clear all filters"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <AnimatePresence>
        {isAdvancedOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-card border border-border rounded-2xl p-5 mt-2 shadow-lg relative overflow-visible flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Priority */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-primary" /> Priority
                  </label>
                  <Select 
                    value={pendingAdvanced.priority}
                    onValueChange={(val) => updatePending("priority", val)}
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map(p => (
                        <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Department */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-primary" /> Department
                  </label>
                  <Select 
                    value={pendingAdvanced.department}
                    onValueChange={(val) => updatePending("department", val)}
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {(metadata.departments || []).map(d => (
                        <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Vendor */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-primary" /> Vendor
                  </label>
                  <Select 
                    value={pendingAdvanced.vendor.toString()}
                    onValueChange={(val) => updatePending("vendor", val)}
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Vendors</SelectItem>
                      {(metadata.vendors || []).map(v => (
                        <SelectItem key={v.id} value={v.id.toString()}>{v.companyName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Request Number */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-primary" /> PR Number
                  </label>
                  <Input 
                    placeholder="e.g. PR-202608..."
                    value={pendingAdvanced.requestNo}
                    onChange={(e) => updatePending("requestNo", e.target.value)}
                    className="h-10 rounded-xl text-sm"
                  />
                </div>

                {/* Purpose Type */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-primary" /> Purpose Type
                  </label>
                  <Select 
                    value={pendingAdvanced.purpose}
                    onValueChange={(val) => {
                      updatePending("purpose", val);
                      updatePending("purposeCategoryId", "all");
                      updatePending("subPurposeId", "all");
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {purposeTypes.map(pt => (
                        <SelectItem key={pt} value={pt}>{pt === "all" ? "All Purpose Types" : pt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Purpose Category */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-primary" /> Category
                  </label>
                  <Select 
                    value={pendingAdvanced.purposeCategoryId.toString()}
                    onValueChange={(val) => {
                      updatePending("purposeCategoryId", val);
                      updatePending("subPurposeId", "all");
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {(metadata.purposes || [])
                        .filter(p => pendingAdvanced.purpose === "all" || p.type === pendingAdvanced.purpose)
                        .map(p => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sub Purpose */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-primary" /> Sub-Purpose
                  </label>
                  <Select 
                    value={pendingAdvanced.subPurposeId.toString()}
                    onValueChange={(val) => updatePending("subPurposeId", val)}
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Sub-Purpose" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sub-Purposes</SelectItem>
                      {(metadata.subPurposes || [])
                        .filter(sp => pendingAdvanced.purposeCategoryId === "all" || sp.purposeId?.toString() === pendingAdvanced.purposeCategoryId)
                        .map(sp => (
                          <SelectItem key={sp.id} value={sp.id.toString()}>{sp.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" /> Date Range
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input 
                      type="date"
                      value={pendingAdvanced.dateFrom}
                      onChange={(e) => updatePending("dateFrom", e.target.value)}
                      className="h-10 px-2 rounded-xl text-xs"
                    />
                    <Input 
                      type="date"
                      value={pendingAdvanced.dateTo}
                      onChange={(e) => updatePending("dateTo", e.target.value)}
                      className="h-10 px-2 rounded-xl text-xs"
                    />
                  </div>
                </div>

                {/* Cost Range */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-primary" /> Cost (QAR)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input 
                      type="number"
                      placeholder="Min"
                      value={pendingAdvanced.costMin}
                      onChange={(e) => updatePending("costMin", e.target.value)}
                      className="h-10 rounded-xl text-sm"
                    />
                    <Input 
                      type="number"
                      placeholder="Max"
                      value={pendingAdvanced.costMax}
                      onChange={(e) => updatePending("costMax", e.target.value)}
                      className="h-10 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end items-center gap-2.5 pt-3 border-t border-border">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={clearFilters}
                  className="px-5 rounded-xl text-xs font-semibold"
                >
                  Reset All
                </Button>
                <Button 
                  size="sm"
                  onClick={applyAdvanced}
                  className="px-6 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-sm hover:bg-primary/90"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
