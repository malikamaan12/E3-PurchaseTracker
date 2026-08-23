"use client";

import React, { useState, useEffect } from "react";
import { Search, Filter, Calendar, X, Building2, UserCircle, Tag } from "lucide-react";
import { apiClient } from "@/lib/apiClient";

interface Filters {
  startDate: string;
  endDate: string;
  departmentId: string;
  vendorId: string;
  status: string;
}

interface AnalyticsFiltersProps {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  isAdmin: boolean;
}

export default function AnalyticsFilters({ filters, setFilters, isAdmin }: AnalyticsFiltersProps) {
  const [depts, setDepts] = useState<any[]>([]);
  const [vendorsList, setVendorsList] = useState<any[]>([]);

  useEffect(() => {
    if (isAdmin) {
      apiClient.departments.list().then(setDepts);
    }
    apiClient.vendors.list().then(setVendorsList);
  }, [isAdmin]);

  const handleChange = (key: keyof Filters, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      departmentId: "",
      vendorId: "",
      status: "",
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== "");

  return (
    <div className="sticky top-[80px] z-30 pb-6 pointer-events-none">
      <div className="glass-card p-4 pointer-events-auto shadow-2xl shadow-purple-500/5 border-purple-500/10">
        <div className="flex flex-wrap items-center gap-4">
          
          <div className="flex items-center gap-2 px-3 py-2 bg-secondary/30 rounded-xl border border-border focus-within:border-primary/40 transition-all">
            <Calendar className="w-4 h-4 text-[#2FB7B2]" />
            <input 
              type="date" 
              value={filters.startDate}
              onChange={(e) => handleChange("startDate", e.target.value)}
              className="bg-transparent text-xs font-bold text-foreground outline-none w-28"
              placeholder="From"
            />
            <span className="text-muted-foreground">→</span>
            <input 
              type="date" 
              value={filters.endDate}
              onChange={(e) => handleChange("endDate", e.target.value)}
              className="bg-transparent text-xs font-bold text-foreground outline-none w-28"
              placeholder="To"
            />
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 px-3 py-2 bg-secondary/30 rounded-xl border border-border focus-within:border-primary/40 transition-all">
              <Building2 className="w-4 h-4 text-purple-400" />
              <select 
                value={filters.departmentId}
                onChange={(e) => handleChange("departmentId", e.target.value)}
                className="bg-transparent text-xs font-bold text-foreground outline-none min-w-[120px]"
              >
                <option value="" className="bg-card text-foreground">All Departments</option>
                {depts.map(d => (
                  <option key={d.id} value={d.name} className="bg-card text-foreground">{d.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2 px-3 py-2 bg-secondary/30 rounded-xl border border-border focus-within:border-primary/40 transition-all">
            <UserCircle className="w-4 h-4 text-sky-400" />
            <select 
              value={filters.vendorId}
              onChange={(e) => handleChange("vendorId", e.target.value)}
              className="bg-transparent text-xs font-bold text-foreground outline-none min-w-[120px]"
            >
              <option value="" className="bg-card text-foreground">All Vendors</option>
              {vendorsList.map(v => (
                <option key={v.id} value={v.id} className="bg-card text-foreground">{v.companyName}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-secondary/30 rounded-xl border border-border focus-within:border-primary/40 transition-all">
            <Tag className="w-4 h-4 text-emerald-400" />
            <select 
              value={filters.status}
              onChange={(e) => handleChange("status", e.target.value)}
              className="bg-transparent text-xs font-bold text-foreground outline-none min-w-[100px]"
            >
              <option value="" className="bg-card text-foreground">Any Status</option>
              <option value="pending" className="bg-card text-foreground">Pending</option>
              <option value="approved" className="bg-card text-foreground">Approved</option>
              <option value="rejected" className="bg-card text-foreground">Rejected</option>
              <option value="variation_pending" className="bg-card text-foreground">Variation</option>
            </select>
          </div>

          <div className="flex-1" />

          {hasActiveFilters && (
            <button 
              onClick={clearFilters}
              className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
            >
              <X className="w-3 h-3" /> Clear Filters
            </button>
          )}

          <div className="px-4 py-2 bg-purple-500/10 text-[#5B4B8A] rounded-xl flex items-center gap-2">
            <Filter className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Active Engine</span>
          </div>
        </div>
      </div>
    </div>
  );
}
