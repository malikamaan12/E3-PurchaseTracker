"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  Edit2,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { usePageTitle } from "@/lib/hooks/usePageTitle";

export default function DepartmentsPage() {
  usePageTitle("Department Management");
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<any>(null);

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: () => apiClient.admin.departments.list(),
    enabled: !!user && !isAuthLoading
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient.admin.departments.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Department created successfully");
      setIsModalOpen(false);
    },
    onError: (error: any) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiClient.admin.departments.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Department updated successfully");
      setIsModalOpen(false);
    },
    onError: (error: any) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.admin.departments.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Department removed");
    },
    onError: (error: any) => toast.error(error.message),
  });

  const filtered = departments.filter((d: any) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-serif text-foreground tracking-tight flex items-center gap-3">
            <Building2 className="w-10 h-10 text-brand-primary" />
            Departments
          </h1>
          <p className="text-muted-foreground mt-2 font-medium tracking-wide">Manage organizational units and approval authority</p>
        </div>

        <button
          onClick={() => { setEditingDept(null); setIsModalOpen(true); }}
          className="bg-primary text-primary-foreground px-6 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:brightness-110 shadow-xl transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-5 h-5" /> NEW DEPARTMENT
        </button>
      </div>

      {/* Search & Stats Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-foreground transition-colors" />
          <input
            type="text"
            placeholder="Search departments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-secondary/50 border border-border rounded-2xl pl-12 pr-6 py-4 text-foreground focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
          />
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex flex-col justify-center text-center">
          <div className="text-[10px] uppercase font-bold text-emerald-500/60 tracking-widest">Total Units</div>
          <div className="text-2xl font-serif text-emerald-500">{departments.length}</div>
        </div>
      </div>

      {/* Mobile Department Cards */}
      <div className="md:hidden space-y-4">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={`mob-skel-${i}`} className="bg-card p-5 rounded-2xl border border-border animate-pulse space-y-3">
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="bg-card p-12 text-center rounded-2xl border border-border text-muted-foreground font-medium">
            No departments found.
          </div>
        ) : (
          filtered.map((dept: any) => (
            <div key={dept.id} className="bg-card p-5 rounded-2xl border border-border shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-bold text-foreground truncate">{dept.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Created: {new Date(dept.createdAt).toLocaleDateString()}</p>
                </div>
                {dept.isApprover ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20 shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5" /> AUTHORIZED
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground text-[10px] font-bold border border-border shrink-0">
                    <ShieldAlert className="w-3.5 h-3.5" /> NO AUTH
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
                <button
                  onClick={() => { setEditingDept(dept); setIsModalOpen(true); }}
                  aria-label={`Edit department ${dept.name}`}
                  className="min-h-[44px] px-4 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border flex items-center gap-1.5"
                >
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
                <button
                  onClick={() => { if(confirm(`Remove department "${dept.name}"?`)) deleteMutation.mutate(dept.id); }}
                  aria-label={`Delete department ${dept.name}`}
                  className="min-h-[44px] px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-500/20 flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Departments Table */}
      <div className="hidden md:block bg-card overflow-hidden border border-border rounded-3xl shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th scope="col" className="px-6 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Department Name</th>
                <th scope="col" className="px-6 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Approval Authority</th>
                <th scope="col" className="px-6 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Created Date</th>
                <th scope="col" className="px-6 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <AnimatePresence mode="wait">
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="animate-pulse">
                      <td colSpan={4} className="px-6 py-8"><div className="h-4 bg-muted/40 rounded w-full" /></td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr key="empty">
                    <td colSpan={4} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <Building2 className="w-12 h-12 opacity-20" />
                        <p className="font-medium">No departments found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((dept: any) => (
                    <motion.tr
                      key={dept.id}
                      layout
                      layoutId={`dept-${dept.id}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="group hover:bg-secondary transition-colors"
                    >
                      <td className="px-6 py-5">
                        <div className="font-semibold text-foreground">{dept.name}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex justify-center">
                          {dept.isApprover ? (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                              <ShieldCheck className="w-3 h-3" /> AUTHORIZED
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground text-[10px] font-bold border border-border">
                              <ShieldAlert className="w-3 h-3" /> NO AUTHORITY
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm text-muted-foreground">
                        {new Date(dept.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => { setEditingDept(dept); setIsModalOpen(true); }}
                            aria-label={`Edit department ${dept.name}`}
                            className="min-h-[36px] min-w-[36px] p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-all active:scale-90 flex items-center justify-center"
                            title="Edit Department"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { if(confirm(`Remove department "${dept.name}"?`)) deleteMutation.mutate(dept.id); }}
                            aria-label={`Delete department ${dept.name}`}
                            className="min-h-[36px] min-w-[36px] p-2 rounded-xl hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 transition-all active:scale-90 flex items-center justify-center"
                            title="Delete Department"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card w-full max-w-md p-8 border border-border shadow-2xl relative overflow-hidden rounded-3xl"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-brand-primary" />

              <h2 className="text-2xl font-serif text-foreground mb-6 flex items-center gap-3">
                {editingDept ? <Edit2 className="w-6 h-6 text-brand-primary" /> : <Plus className="w-6 h-6 text-brand-primary" />}
                {editingDept ? 'Edit Department' : 'New Department'}
              </h2>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const data = {
                    name: formData.get('name'),
                    isApprover: Number(formData.get('isApprover')) === 1
                  };
                  if (editingDept) {
                    updateMutation.mutate({ id: editingDept.id, data });
                  } else {
                    createMutation.mutate(data);
                  }
                }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Name</label>
                  <input
                    name="name"
                    required
                    defaultValue={editingDept?.name}
                    className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                    placeholder="e.g. Legal Affairs"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest block">Authorization</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${editingDept?.isApprover ? 'bg-secondary/20 border-border opacity-50' : 'bg-primary/5 border-primary text-primary'}`}>
                      <input type="radio" name="isApprover" value="0" defaultChecked={!editingDept?.isApprover} className="hidden" />
                      Standard Unit
                    </label>
                    <label className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${editingDept?.isApprover ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500 shadow-lg shadow-emerald-500/10' : 'bg-secondary/20 border-border'}`}>
                      <input type="radio" name="isApprover" value="1" defaultChecked={editingDept?.isApprover} className="hidden" />
                      Approval Auth
                    </label>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 text-muted-foreground hover:text-foreground font-bold transition-all"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="flex-[2] bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-xl font-bold tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-xl"
                  >
                    {(createMutation.isPending || updateMutation.isPending) ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>CONFIRM CHANGES</>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
