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
}

export function RequestFilters({ filters, setFilters, metadata }: RequestFiltersProps) {
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
      if (localSearch !== filters.search) {
        setFilters({ ...filters, search: localSearch });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [localSearch]);

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
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex-1 w-full max-w-xl relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-brand-primary transition-colors z-10" />
          <Input 
            placeholder="Search by title or request number..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-12"
          />
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
          <div className="flex p-1 glass rounded-xl">
            {statusOptions.slice(0, 4).map(status => (
              <button
                key={status}
                onClick={() => {
                  if (filters.status !== status) {
                    setFilters({ ...filters, status });
                  }
                }}
                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${filters.status === status ? "bg-brand-primary text-white shadow-lg" : "text-muted-foreground hover:text-foreground"}`}
              >
                {status}
              </button>
            ))}
          </div>

          <Button 
            variant={isAdvancedOpen || activeFilterCount > 0 ? "secondary" : "outline"}
            size="sm"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="flex items-center gap-2 h-11"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-brand-secondary text-white text-[10px]">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} />
          </Button>

          {activeFilterCount > 0 && (
            <button 
              onClick={clearFilters}
              className="p-3 rounded-xl glass text-muted-foreground hover:text-rose-500 transition-colors"
              title="Clear all filters"
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
            <div className="glass-card p-4 mt-2 relative overflow-visible flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Priority */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <AlertCircle className="w-2.5 h-2.5" /> Priority
                  </label>
                  <Select 
                    value={pendingAdvanced.priority}
                    onValueChange={(val) => updatePending("priority", val)}
                  >
                    <SelectTrigger className="h-10">
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
                  <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="w-2.5 h-2.5" /> Dept
                  </label>
                  <Select 
                    value={pendingAdvanced.department}
                    onValueChange={(val) => updatePending("department", val)}
                  >
                    <SelectTrigger className="h-10">
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
                  <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <User className="w-2.5 h-2.5" /> Vendor
                  </label>
                  <Select 
                    value={pendingAdvanced.vendor.toString()}
                    onValueChange={(val) => updatePending("vendor", val)}
                  >
                    <SelectTrigger className="h-10">
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
                  <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Tag className="w-2.5 h-2.5" /> Req No
                  </label>
                  <Input 
                    placeholder="PR-..."
                    value={pendingAdvanced.requestNo}
                    onChange={(e) => updatePending("requestNo", e.target.value)}
                    className="h-10"
                  />
                </div>

                {/* Purpose Type */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Tag className="w-2.5 h-2.5" /> Type
                  </label>
                  <Select 
                    value={pendingAdvanced.purpose}
                    onValueChange={(val) => updatePending("purpose", val)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {purposeTypes.map(pt => (
                        <SelectItem key={pt} value={pt}>{pt === "all" ? "All" : pt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Purpose Category */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Archive className="w-2.5 h-2.5" /> Category
                  </label>
                  <Select 
                    value={pendingAdvanced.purposeCategoryId.toString()}
                    onValueChange={(val) => updatePending("purposeCategoryId", val)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {(metadata?.purposes || []).map((p: any) => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sub-Purpose */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="w-2.5 h-2.5" /> Sub-Purpose
                  </label>
                  <Select 
                    value={pendingAdvanced.subPurposeId.toString()}
                    onValueChange={(val) => updatePending("subPurposeId", val)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Sub-Purpose" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sub-Purposes</SelectItem>
                      {(metadata?.subPurposes || []).map((sp: any) => (
                        <SelectItem key={sp.id} value={sp.id.toString()}>{sp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-2.5 h-2.5" /> Date Range
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input 
                      type="date"
                      value={pendingAdvanced.dateFrom}
                      onChange={(e) => updatePending("dateFrom", e.target.value)}
                      className="h-10 px-2"
                    />
                    <Input 
                      type="date"
                      value={pendingAdvanced.dateTo}
                      onChange={(e) => updatePending("dateTo", e.target.value)}
                      className="h-10 px-2"
                    />
                  </div>
                </div>

                {/* Cost Range */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <DollarSign className="w-2.5 h-2.5" /> Cost (QAR)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input 
                      type="number"
                      placeholder="Min"
                      value={pendingAdvanced.costMin}
                      onChange={(e) => updatePending("costMin", e.target.value)}
                      className="h-10"
                    />
                    <Input 
                      type="number"
                      placeholder="Max"
                      value={pendingAdvanced.costMax}
                      onChange={(e) => updatePending("costMax", e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end items-center gap-2 pt-4 border-t border-white/5">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={clearFilters}
                  className="px-6"
                >
                  Reset All
                </Button>
                <Button 
                  variant="premium" 
                  size="sm"
                  onClick={applyAdvanced}
                  className="px-10"
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
