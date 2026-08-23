"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  Projector, Plus, Trash2, Snowflake,
  Calendar, DollarSign, Wallet, Users, Briefcase,
  ChevronRight, X, AlertCircle, Info, CheckCircle2, MoreHorizontal, ShieldAlert
} from "lucide-react";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import { ActionConfirmDialog } from "@/components/ui/ActionConfirmDialog";

export default function ProjectManagementPage() {
  usePageTitle("Project Management");
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<any>(null);
  const [projectToFreeze, setProjectToFreeze] = useState<any>(null);
  const [projectActionMenu, setProjectActionMenu] = useState<any>(null);
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

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.admin.subPurposes.delete(id),
    onSuccess: () => {
      toast.success("Project deleted successfully");
      setProjectToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["admin_projects"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete project"),
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
            value={`QAR ${projects.reduce((sum: number, p: any) => sum + (p.totalBudget || 0), 0).toLocaleString()}`}
            icon={<Wallet className="w-5 h-5 text-brand-primary" />}
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

      {/* Mobile Project Cards (< md) */}
      <div className="md:hidden space-y-4">
        {projects.length === 0 ? (
          <div className="p-12 text-center bg-card rounded-2xl border border-border">
            <Projector className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-base font-serif font-bold italic opacity-40">No Projects Found</h3>
            <p className="text-xs text-muted-foreground mt-1">Launch your first procurement project to begin tracking expenditures.</p>
          </div>
        ) : (
          projects.map((proj: any) => {
            const committed = Number(proj.committedAmount || 0);
            const total = Number(proj.totalBudget || 0);
            const remaining = total - committed;
            const pct = total > 0 ? Math.round((committed / total) * 100) : 0;
            const isOver = committed > total && total > 0;
            const categoryName = Array.isArray(categories) && categories.find((c: any) => c.id === proj.purposeCategoryId)?.name || "Uncategorized";

            return (
              <div
                key={proj.id}
                className={`p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4 ${
                  proj.status === 'frozen' ? 'border-l-4 border-l-cyan-500 bg-cyan-500/[0.02]' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-foreground truncate">{proj.name}</h3>
                    <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-tight flex items-center gap-1 mt-1">
                      <FolderTreeIcon className="w-3.5 h-3.5 text-brand-primary" />
                      {categoryName}
                    </p>
                  </div>
                  <StatusBadge status={proj.status} />
                </div>

                {/* Budget & Utilization */}
                <div className="space-y-2 p-3 rounded-xl bg-secondary/30 border border-border/50">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-medium">Budget Ceiling:</span>
                    <span className="font-serif font-black text-foreground">QAR {total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-medium">Committed:</span>
                    <span className={`font-mono font-bold ${isOver ? 'text-rose-500' : 'text-foreground'}`}>
                      QAR {committed.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden border border-border/60">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        isOver ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span>{pct}% Used</span>
                    <span className={remaining < 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                      {remaining < 0 ? `QAR ${Math.abs(remaining).toLocaleString()} Over` : `QAR ${remaining.toLocaleString()} Left`}
                    </span>
                  </div>
                </div>

                {/* Schedule & Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-border/40 gap-2">
                  <div className="text-[10px] text-muted-foreground font-medium">
                    <span>{proj.validFrom ? new Date(proj.validFrom).toLocaleDateString() : "Open"}</span>
                    <span className="mx-1">→</span>
                    <span>{proj.validTo ? new Date(proj.validTo).toLocaleDateString() : "Open"}</span>
                  </div>
                  <button
                    onClick={() => setProjectActionMenu(proj)}
                    aria-label={`More actions for project ${proj.name}`}
                    className="min-h-[44px] min-w-[44px] px-3.5 inline-flex items-center justify-center rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-colors touch-target"
                    title="More actions"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Mobile Project Action Sheet */}
      {projectActionMenu && (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-3 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{projectActionMenu.name}</p>
                <p className="text-xs text-muted-foreground">Status: <span className="font-bold capitalize">{projectActionMenu.status}</span></p>
              </div>
              <button
                onClick={() => setProjectActionMenu(null)}
                aria-label="Close actions menu"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground touch-target"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  setProjectToFreeze(projectActionMenu);
                  setProjectActionMenu(null);
                }}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-bold transition-colors border border-cyan-500/20 flex items-center justify-between touch-target"
              >
                <span>{projectActionMenu.status === "frozen" ? "Unfreeze Project" : "Freeze Project"}</span>
                <Snowflake className="w-4 h-4" />
              </button>

              <div className="pt-2 border-t border-border/50">
                <button
                  onClick={() => {
                    setProjectToDelete(projectActionMenu);
                    setProjectActionMenu(null);
                  }}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors border border-rose-500/20 flex items-center justify-between touch-target"
                >
                  <span>Delete Project (Destructive)</span>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accessible Confirmation Dialog for Project Freeze/Unfreeze */}
      <ActionConfirmDialog
        isOpen={!!projectToFreeze}
        onOpenChange={(open) => { if (!open) setProjectToFreeze(null); }}
        title={projectToFreeze?.status === "frozen" ? "Unfreeze Project" : "Freeze Project"}
        variant={projectToFreeze?.status === "frozen" ? "success" : "warning"}
        confirmText={projectToFreeze?.status === "frozen" ? "Unfreeze Project" : "Freeze Project"}
        isLoading={updateStatusMutation.isPending}
        onConfirm={() => {
          if (projectToFreeze) {
            updateStatusMutation.mutate({
              id: projectToFreeze.id,
              data: { status: projectToFreeze.status === "active" ? "frozen" : "active" }
            });
            setProjectToFreeze(null);
          }
        }}
        description={
          <div className="space-y-3 text-left">
            <p>
              Are you sure you want to {projectToFreeze?.status === "frozen" ? "unfreeze" : "freeze"} the project <span className="font-bold text-foreground">{projectToFreeze?.name}</span>?
            </p>
            <div className="p-3 bg-secondary/40 rounded-xl border border-border space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Budget:</span>
                <span className="font-bold text-foreground">QAR {(projectToFreeze?.totalBudget || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Action:</span>
                <span className="font-bold capitalize text-brand-primary">{projectToFreeze?.status === "frozen" ? "Restore to Active" : "Halt Expenditures (Freeze)"}</span>
              </div>
            </div>
          </div>
        }
      />

      {/* Accessible Confirmation Dialog for Project Deletion */}
      <ActionConfirmDialog
        isOpen={!!projectToDelete}
        onOpenChange={(open) => { if (!open) setProjectToDelete(null); }}
        title="Delete Project"
        variant="danger"
        confirmText="Delete Permanently"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (projectToDelete) {
            deleteMutation.mutate(projectToDelete.id);
          }
        }}
        description={
          <div className="space-y-3 text-left">
            <p>
              Are you sure you want to permanently delete the project <span className="font-bold text-foreground">{projectToDelete?.name}</span>?
            </p>
            <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
              Warning: Deleting this project is permanent. Associated historical expenditures may become unlinked from this project cap.
            </div>
          </div>
        }
      />

      {/* Desktop Project Table (>= md) */}
      <div className="hidden md:block bg-card rounded-[2.5rem] border border-border overflow-x-auto custom-scrollbar shadow-2xl relative">
        <div className="absolute inset-x-0 h-1 top-0 bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-primary opacity-50" />
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-secondary/20">
              <th className="p-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] whitespace-nowrap">Status</th>
              <th className="p-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] whitespace-nowrap">Project Identity</th>
              <th className="p-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] whitespace-nowrap">Budget Ceiling</th>
              <th className="p-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] whitespace-nowrap">Live Utilization</th>
              <th className="p-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] whitespace-nowrap">Schedule</th>
              <th className="p-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] whitespace-nowrap text-right">Governance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {projects.map((proj: any) => {
              const committed = Number(proj.committedAmount || 0);
              const total = Number(proj.totalBudget || 0);
              const remaining = total - committed;
              const pct = total > 0 ? Math.round((committed / total) * 100) : 0;
              const isOver = committed > total && total > 0;

              return (
                <tr key={proj.id} className={`transition-colors group ${proj.status === 'frozen' ? 'bg-cyan-500/[0.04] border-l-4 border-l-cyan-500' : 'hover:bg-secondary/30'}`}>
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
                  <td className="p-6 whitespace-nowrap">
                      <div className="flex flex-col">
                          <span className="text-foreground font-bold font-serif">QAR {(proj.totalBudget || 0).toLocaleString()}</span>
                          <span className="text-[10px] text-muted-foreground font-bold uppercase">Total Cap</span>
                      </div>
                  </td>
                  <td className="p-6 min-w-[200px]">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-muted-foreground">Committed:</span>
                        <span className={`font-mono font-bold ${isOver ? 'text-rose-500' : 'text-foreground'}`}>
                          QAR {committed.toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-secondary rounded-full overflow-hidden border border-border/60">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            isOver ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <span>{pct}% Used</span>
                        <span className={remaining < 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                          {remaining < 0 ? `QAR ${Math.abs(remaining).toLocaleString()} Over` : `QAR ${remaining.toLocaleString()} Left`}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground whitespace-nowrap">
                          <span className="opacity-50 font-medium">FROM:</span>
                          {proj.validFrom ? new Date(proj.validFrom).toLocaleDateString() : "INF"}
                          <ChevronRight className="w-3 h-3 mx-1 opacity-20" />
                          <span className="opacity-50 font-medium">TO:</span>
                          {proj.validTo ? new Date(proj.validTo).toLocaleDateString() : "INF"}
                      </div>
                  </td>
                  <td className="p-6 text-right space-x-1 whitespace-nowrap">
                     <button
                        onClick={() => updateStatusMutation.mutate({ id: proj.id, data: { status: proj.status === 'active' ? 'frozen' : 'active' }})}
                        className={`w-11 h-11 inline-flex items-center justify-center rounded-2xl transition-all shadow-none hover:shadow-xl active:scale-95 ${
                          proj.status === 'frozen'
                            ? 'bg-cyan-500/20 text-cyan-500 border border-cyan-500/30'
                            : 'hover:bg-secondary text-muted-foreground hover:text-cyan-500'
                        }`}
                        title={proj.status === 'frozen' ? "Unfreeze Project" : "Freeze Project"}
                      >
                        <Snowflake className={`w-5 h-5 ${proj.status === 'frozen' ? 'animate-pulse' : ''}`} />
                      </button>
                      <button
                        onClick={() => setProjectToDelete(proj)}
                        className="w-11 h-11 inline-flex items-center justify-center hover:bg-rose-500/10 rounded-2xl text-muted-foreground hover:text-rose-500 transition-all shadow-none hover:shadow-xl active:scale-95"
                        title="Delete Project"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                  </td>
                </tr>
              );
            })}
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4 animate-in fade-in duration-300">
           <div className="bg-card border border-border w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 h-full max-h-[90vh] flex flex-col">
              <div className="p-8 border-b border-border bg-secondary/20 flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-serif font-bold tracking-tight text-foreground">Launch Procurement Project</h2>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">Financial Commissioning & Budgeting</p>
                  </div>
                  <button onClick={() => setIsAdding(false)} className="bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground p-2.5 rounded-2xl border border-border transition-colors">
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
                           <span className="absolute left-4 top-1/2 -translate-y-1/2 font-sans font-bold text-xs text-muted-foreground">QAR</span>
                           <input
                              type="number"
                              className="w-full bg-secondary/50 border border-border rounded-2xl pl-14 pr-5 py-4 outline-none font-serif text-xl font-black text-brand-primary"
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
                             <div className="relative w-44">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-sans font-bold text-xs">QAR</span>
                                <input
                                   type="number"
                                   placeholder="0.00"
                                   className="w-full bg-secondary/30 border border-border rounded-xl pl-12 pr-4 py-3 outline-none text-sm font-black font-serif"
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
                               {isOverBudget ? <AlertCircle className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                            </div>
                            <div>
                               <span className="text-[10px] font-black uppercase tracking-widest block opacity-70">Allocated Balance</span>
                               <span className={`text-xl font-serif font-black ${isOverBudget ? 'text-rose-500' : 'text-emerald-500'}`}>
                                 QAR {totalAllocated.toLocaleString()}
                               </span>
                            </div>
                         </div>
                         <div className="text-right">
                             <span className="text-[10px] font-black uppercase tracking-widest block opacity-50">Ceiling Remaining</span>
                             <span className={`text-sm font-black ${isOverBudget ? 'text-rose-500' : 'text-muted-foreground'}`}>
                               {isOverBudget ? `OVER BY QAR ${(totalAllocated - formData.totalBudget).toLocaleString()}` : `QAR ${(formData.totalBudget - totalAllocated).toLocaleString()}`}
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

      {/* Delete / Freeze Safeguard Modal with Keyboard Tab Focus Navigation */}
      <DeleteSubPurposeModal
        project={projectToDelete}
        isOpen={Boolean(projectToDelete)}
        onClose={() => setProjectToDelete(null)}
        onConfirmDelete={(id) => deleteMutation.mutate(id)}
        onConfirmFreeze={(id) => {
          updateStatusMutation.mutate({ id, data: { status: "frozen" } });
          setProjectToDelete(null);
        }}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}

function DeleteSubPurposeModal({
  project,
  isOpen,
  onClose,
  onConfirmDelete,
  onConfirmFreeze,
  isDeleting
}: {
  project: any;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (id: number) => void;
  onConfirmFreeze: (id: number) => void;
  isDeleting: boolean;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const freezeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (Number(project?.committedAmount || 0) > 0) {
          freezeRef.current?.focus();
        } else {
          cancelRef.current?.focus();
        }
      }, 50);
    }
  }, [isOpen, project]);

  if (!isOpen || !project) return null;

  const usedAmount = Number(project.committedAmount || 0);
  const hasUsedAmount = usedAmount > 0;

  // Keyboard navigation & Focus trapping (Tab / Shift+Tab / Esc)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === "Tab") {
      const focusables = [
        cancelRef.current,
        hasUsedAmount ? freezeRef.current : deleteRef.current,
      ].filter(Boolean) as HTMLElement[];

      if (focusables.length === 0) return;

      const currentIndex = focusables.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey) {
        if (currentIndex <= 0) {
          e.preventDefault();
          focusables[focusables.length - 1].focus();
        }
      } else {
        if (currentIndex === focusables.length - 1) {
          e.preventDefault();
          focusables[0].focus();
        }
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in duration-200"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-card border border-border w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 overflow-hidden relative animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-4 mb-6">
          <div className={`p-4 rounded-2xl ${hasUsedAmount ? "bg-cyan-500/10 text-cyan-500 border border-cyan-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"}`}>
            {hasUsedAmount ? <Snowflake className="w-7 h-7 animate-pulse" /> : <Trash2 className="w-7 h-7" />}
          </div>
          <div>
            <h3 className="text-xl font-serif font-black tracking-tight text-foreground">
              {hasUsedAmount ? "Project Can Only Be Frozen" : "Delete Strategic Project"}
            </h3>
            <p className="text-xs font-mono font-bold text-muted-foreground mt-0.5 uppercase tracking-wider">{project.name}</p>
          </div>
        </div>

        {hasUsedAmount ? (
          <div className="bg-cyan-500/10 border border-cyan-500/30 p-5 rounded-2xl mb-6 space-y-2">
            <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-bold text-xs uppercase tracking-wider">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Financial Spending Detected</span>
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed font-medium">
              This project has committed/used funds of <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">QAR {usedAmount.toLocaleString()}</span>. Under governance rules, projects with spent funds <span className="font-bold underline">cannot be deleted</span>. You can freeze this project to restrict future requests while preserving audit logs.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed mb-6 font-medium">
            Are you sure you want to delete <span className="font-bold text-foreground">"{project.name}"</span>? This will permanently remove the project definition and budget allocations.
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            ref={cancelRef}
            type="button"
            tabIndex={0}
            onClick={onClose}
            className="px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest text-muted-foreground hover:bg-secondary border border-border/50 focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all cursor-pointer"
          >
            Cancel
          </button>

          {hasUsedAmount ? (
            <button
              ref={freezeRef}
              type="button"
              tabIndex={0}
              onClick={() => onConfirmFreeze(project.id)}
              className="px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-cyan-500 text-white hover:bg-cyan-600 shadow-lg shadow-cyan-500/20 focus:ring-2 focus:ring-cyan-500/40 outline-none transition-all flex items-center gap-2 cursor-pointer"
            >
              <Snowflake className="w-4 h-4" /> Freeze Project Now
            </button>
          ) : (
            <button
              ref={deleteRef}
              type="button"
              tabIndex={0}
              disabled={isDeleting}
              onClick={() => onConfirmDelete(project.id)}
              className="px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-500/20 focus:ring-2 focus:ring-rose-500/40 outline-none transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isDeleting ? "Deleting..." : <Trash2 className="w-4 h-4" />}
              Delete Project
            </button>
          )}
        </div>
      </div>
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
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 text-[10px] font-black uppercase tracking-widest font-bold shadow-sm">
        <Snowflake className="w-3 h-3 animate-pulse" />
        Frozen
      </span>
    );
  }
  if (status === 'closed') {
    return (
       <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border text-[10px] font-black uppercase tracking-widest font-bold">
        <Info className="w-3 h-3" />
        Closed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest font-bold">
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
