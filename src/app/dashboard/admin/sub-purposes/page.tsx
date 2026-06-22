"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { 
  Projector, Plus, Trash2, Snowflake, 
  Calendar, DollarSign, Users, Briefcase,
  ChevronRight, X, AlertCircle, Info, CheckCircle2
} from "lucide-react";

export default function ProjectManagementPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    purposeCategoryId: "",
    purposeType: "PROJECT",
    totalBudget: 0,
    validFrom: "",
    validTo: "",
    budgetSplits: [] as { departmentId: string; amount: number }[]
  });

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["admin_projects"],
    queryFn: () => apiClient.admin.subPurposes.list(),
    enabled: !!user && !isAuthLoading
  });

  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["admin_purpose_categories"],
    queryFn: async () => {
      const res = await fetch("/api/admin/purposes");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
    enabled: !!user && !isAuthLoading
  });

  const { data: departments = [], isLoading: loadingDepts } = useQuery({
    queryKey: ["admin_departments"],
    queryFn: () => apiClient.admin.departments.list(),
    enabled: !!user && !isAuthLoading
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient.admin.subPurposes.create(data),
    onSuccess: () => {
      toast.success("Project launched successfully");
      setIsAdding(false);
      setFormData({
        name: "", purposeCategoryId: "", purposeType: "PROJECT",
        totalBudget: 0, validFrom: "", validTo: "", budgetSplits: []
      });
      queryClient.invalidateQueries({ queryKey: ["admin_projects"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to create project"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiClient.admin.subPurposes.update(id, data),
    onSuccess: () => {
      toast.success("Project status updated");
      queryClient.invalidateQueries({ queryKey: ["admin_projects"] });
    },
    onError: (err: any) => toast.error(err.message || "Update failed"),
  });

  const addBudgetSplit = () => {
    setFormData(s => ({
      ...s,
      budgetSplits: [...s.budgetSplits, { departmentId: "", amount: 0 }]
    }));
  };

  const removeBudgetSplit = (index: number) => {
    setFormData(s => ({
      ...s,
      budgetSplits: s.budgetSplits.filter((_, i) => i !== index)
    }));
  };

  const updateBudgetSplit = (index: number, field: string, value: any) => {
    const newSplits = [...formData.budgetSplits];
    newSplits[index] = { ...newSplits[index], [field]: value };
    setFormData(s => ({ ...s, budgetSplits: newSplits }));
  };

  const totalAllocated = formData.budgetSplits.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const isOverBudget = totalAllocated > formData.totalBudget;

  if (loadingProjects || loadingCategories || loadingDepts) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-bold mb-2 uppercase tracking-wider border border-brand-primary/20">
            <Briefcase className="w-3 h-3" />
            Project Lifecycle
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground tracking-tight">Project Financial Controller</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium italic">Manage project-specific allocations and departmental budget caps.</p>
        </div>

        <button 
          onClick={() => setIsAdding(true)}
          className="bg-brand-primary hover:brightness-110 text-white px-8 py-3 rounded-2xl transition-all shadow-[0_10px_30px_rgba(111,42,230,0.3)] font-bold flex items-center gap-2 active:scale-95 group"
        >
          <Plus className="w-5 h-5 transition-transform group-hover:rotate-90 duration-300" />
          Launch New Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <StatsCard 
            label="Active Projects" 
            value={projects.filter((p: any) => p.status === 'active').length} 
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} 
          />
          <StatsCard 
            label="Total Exposure" 
            value={`$${projects.reduce((sum: number, p: any) => sum + (p.totalBudget || 0), 0).toLocaleString()}`} 
            icon={<DollarSign className="w-5 h-5 text-brand-primary" />} 
          />
          <StatsCard 
            label="Frozen Assets" 
            value={projects.filter((p: any) => p.status === 'frozen').length} 
            icon={<Snowflake className="w-5 h-5 text-cyan-500" />} 
          />
          <StatsCard 
             label="Expiring Soon" 
             value={0} 
             icon={<Calendar className="w-5 h-5 text-amber-500" />} 
           />
      </div>

      {/* Project Table */}
      <div className="bg-card rounded-[2.5rem] border border-border overflow-x-auto custom-scrollbar shadow-2xl relative">
        <div className="absolute inset-x-0 h-1 top-0 bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-primary opacity-50" />
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-secondary/20">
              <th className="p-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] whitespace-nowrap">Status</th>
              <th className="p-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] whitespace-nowrap">Project Identity</th>
              <th className="p-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] whitespace-nowrap">Financial Ceiling</th>
              <th className="p-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] whitespace-nowrap">Schedule</th>
              <th className="p-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] whitespace-nowrap text-right">Governance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {projects.map((proj: any) => (
              <tr key={proj.id} className="hover:bg-secondary/30 transition-colors group">
                <td className="p-6">
                    <StatusBadge status={proj.status} />
                </td>
                <td className="p-6">
                   <div className="flex flex-col">
                      <span className="text-foreground font-black text-base">{proj.name}</span>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight flex items-center gap-1 mt-1">
                        <FolderTreeIcon className="w-3 h-3" />
                         {Array.isArray(categories) && categories.find((c: any) => c.id === proj.purposeCategoryId)?.name || "Uncategorized"}
                      </span>
                   </div>
                </td>
                <td className="p-6">
                    <div className="flex flex-col">
                        <span className="text-foreground font-bold font-serif">${(proj.totalBudget || 0).toLocaleString()}</span>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase">Total Allocation</span>
                    </div>
                </td>
                <td className="p-6">
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                        <span className="opacity-50 font-medium">FROM:</span>
                        {proj.validFrom ? new Date(proj.validFrom).toLocaleDateString() : "INF"}
                        <ChevronRight className="w-3 h-3 mx-1 opacity-20" />
                        <span className="opacity-50 font-medium">TO:</span>
                        {proj.validTo ? new Date(proj.validTo).toLocaleDateString() : "INF"}
                    </div>
                </td>
                <td className="p-6 text-right space-x-1">
                   <button 
                      onClick={() => updateStatusMutation.mutate({ id: proj.id, data: { status: proj.status === 'active' ? 'frozen' : 'active' }})}
                      className="w-11 h-11 flex items-center justify-center hover:bg-white rounded-2xl text-muted-foreground hover:text-brand-primary transition-all shadow-none hover:shadow-xl active:scale-95"
                      title="Toggle Freeze Status"
                    >
                      <Snowflake className={`w-5 h-5 ${proj.status === 'frozen' ? 'fill-brand-primary/20' : ''}`} />
                    </button>
                    <button 
                      className="w-11 h-11 flex items-center justify-center hover:bg-white rounded-2xl text-muted-foreground hover:text-rose-500 transition-all shadow-none hover:shadow-xl active:scale-95"
                      title="Archive Project"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
         {projects.length === 0 && (
          <div className="p-24 text-center">
            <Projector className="w-16 h-16 text-muted-foreground/10 mx-auto mb-6" />
            <h3 className="text-xl font-serif font-bold italic opacity-30">The control room is silent...</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mt-2 font-medium">Launch your first procurement project to begin tracking specific departmental expenditures.</p>
          </div>
        )}
      </div>

      {/* Advanced Project Creation Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
           <div className="bg-background border border-white/10 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 h-full max-h-[90vh] flex flex-col">
              <div className="p-8 border-b border-white/5 bg-secondary/20 flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-serif font-bold tracking-tight">Launch Procurement Project</h2>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">Financial Commissioning & Budgeting</p>
                  </div>
                  <button onClick={() => setIsAdding(false)} className="bg-white/5 hover:bg-white/10 p-2.5 rounded-2xl border border-white/5 transition-colors">
                    <X className="w-6 h-6" />
                  </button>
              </div>

              <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                  {/* Basic Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label="Project Title">
                       <input 
                          type="text" 
                          placeholder="Project Alpha..."
                          className="w-full bg-secondary/50 border border-border rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-brand-primary/10 transition-all font-black text-lg"
                          value={formData.name}
                          onChange={(e) => setFormData(s => ({ ...s, name: e.target.value }))}
                       />
                    </Field>
                    <Field label="Purpose Classification">
                        <select 
                          className="w-full bg-secondary/50 border border-border rounded-2xl px-5 py-4 outline-none appearance-none font-bold"
                          value={formData.purposeCategoryId}
                          onChange={(e) => setFormData(s => ({ ...s, purposeCategoryId: e.target.value }))}
                        >
                          <option value="">Select Category...</option>
                          {Array.isArray(categories) && categories.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <Field label="Total Exposure Ceiling">
                        <div className="relative">
                           <span className="absolute left-5 top-1/2 -translate-y-1/2 font-serif font-black text-xl text-muted-foreground">$</span>
                           <input 
                              type="number" 
                              className="w-full bg-secondary/50 border border-border rounded-2xl pl-10 pr-5 py-4 outline-none font-serif text-xl font-black text-brand-primary"
                              value={formData.totalBudget}
                              onChange={(e) => setFormData(s => ({ ...s, totalBudget: Number(e.target.value) }))}
                           />
                        </div>
                     </Field>
                     <Field label="Validity From">
                        <input 
                          type="date" 
                          className="w-full bg-secondary/50 border border-border rounded-2xl px-5 py-4 outline-none font-bold text-sm"
                          value={formData.validFrom}
                          onChange={(e) => setFormData(s => ({ ...s, validFrom: e.target.value }))}
                        />
                     </Field>
                     <Field label="Validity To">
                        <input 
                          type="date" 
                          className="w-full bg-secondary/50 border border-border rounded-2xl px-5 py-4 outline-none font-bold text-sm"
                          value={formData.validTo}
                          onChange={(e) => setFormData(s => ({ ...s, validTo: e.target.value }))}
                        />
                     </Field>
                  </div>

                  {/* Budget Splits */}
                  <div className="space-y-4 pt-4 border-t border-border">
                     <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                             <Users className="w-4 h-4 text-brand-primary" />
                             Departmental Allocations
                          </h4>
                          <p className="text-[10px] text-muted-foreground font-bold mt-1">Define specific budget caps for each participating department.</p>
                        </div>
                        <button 
                           onClick={addBudgetSplit}
                           className="text-[10px] font-black uppercase tracking-widest text-brand-primary hover:bg-brand-primary/10 px-3 py-1.5 rounded-lg transition-all"
                        >
                           + Add Split
                        </button>
                     </div>

                     <div className="space-y-3">
                        {formData.budgetSplits.map((split, index) => (
                           <div key={index} className="flex gap-3 animate-in fade-in slide-in-from-right-4 duration-300">
                             <select 
                                className="flex-1 bg-secondary/30 border border-border rounded-xl px-4 py-3 outline-none text-sm font-bold"
                                value={split.departmentId}
                                onChange={(e) => updateBudgetSplit(index, "departmentId", e.target.value)}
                             >
                               <option value="">Department...</option>
                               {departments.map((d: any) => (
                                 <option key={d.id} value={d.id}>{d.name}</option>
                               ))}
                             </select>
                             <div className="relative w-40">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-serif font-black text-sm">$</span>
                                <input 
                                   type="number" 
                                   placeholder="0.00"
                                   className="w-full bg-secondary/30 border border-border rounded-xl pl-7 pr-4 py-3 outline-none text-sm font-black font-serif"
                                   value={split.amount}
                                   onChange={(e) => updateBudgetSplit(index, "amount", e.target.value)}
                                />
                             </div>
                             <button 
                                onClick={() => removeBudgetSplit(index)}
                                className="p-3 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                           </div>
                        ))}
                     </div>

                     {/* Validation Display */}
                     <div className={`p-4 rounded-2xl flex justify-between items-center transition-all ${isOverBudget ? 'bg-rose-500/10 border border-rose-500/30' : 'bg-emerald-500/5 border border-emerald-500/20'}`}>
                         <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${isOverBudget ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'}`}>
                               {isOverBudget ? <AlertCircle className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}
                            </div>
                            <div>
                               <span className="text-[10px] font-black uppercase tracking-widest block opacity-70">Allocated Balance</span>
                               <span className={`text-xl font-serif font-black ${isOverBudget ? 'text-rose-500' : 'text-emerald-500'}`}>
                                 ${totalAllocated.toLocaleString()}
                               </span>
                            </div>
                         </div>
                         <div className="text-right">
                             <span className="text-[10px] font-black uppercase tracking-widest block opacity-50">Ceiling Remaining</span>
                             <span className={`text-sm font-black ${isOverBudget ? 'text-rose-500' : 'text-muted-foreground'}`}>
                               {isOverBudget ? `OVER BY $${(totalAllocated - formData.totalBudget).toLocaleString()}` : `$${(formData.totalBudget - totalAllocated).toLocaleString()}`}
                             </span>
                         </div>
                     </div>
                  </div>
              </div>

              <div className="p-8 border-t border-border bg-secondary/20 flex gap-4">
                  <button 
                    onClick={() => setIsAdding(false)} 
                    className="flex-1 px-8 py-4 rounded-2xl font-bold hover:bg-secondary transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => createMutation.mutate(formData)}
                    disabled={createMutation.isPending || isOverBudget || !formData.name || !formData.purposeCategoryId}
                    className="flex-[2] bg-brand-primary text-white py-4 rounded-2xl font-bold shadow-xl shadow-brand-primary/30 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {createMutation.isPending ? "Commissioning Project..." : "Authorize & Launch"}
                  </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

function StatsCard({ label, value, icon }: { label: string; value: any; icon: React.ReactNode }) {
  return (
    <div className="bg-card p-6 rounded-[2rem] border border-border flex items-center justify-between shadow-xl group hover:border-brand-primary/30 transition-all">
      <div>
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">{label}</span>
        <span className="text-2xl font-serif font-black text-foreground">{value}</span>
      </div>
      <div className="bg-secondary p-4 rounded-2xl group-hover:scale-110 transition-transform">
        {icon}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'frozen') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 text-[10px] font-black uppercase tracking-widest">
        <Snowflake className="w-3 h-3 animate-pulse" />
        Frozen
      </span>
    );
  }
  if (status === 'closed') {
    return (
       <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border text-[10px] font-black uppercase tracking-widest">
        <Info className="w-3 h-3" />
        Closed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest">
      <CheckCircle2 className="w-3 h-3" />
      Active
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{label}</label>
      {children}
    </div>
  );
}

function FolderTreeIcon(props: any) {
  return (
    <svg 
      {...props}
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    >
      <path d="M20 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
      <path d="M12 2v8" />
      <path d="m16 6-4 4-4-4" />
      <path d="M12 18v2" />
    </svg>
  );
}
