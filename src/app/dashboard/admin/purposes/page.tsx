"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { FolderTree, Plus, Trash2, Snowflake, Edit3, Check, X } from "lucide-react";

export default function PurposeCategoriesPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "", description: "" });

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["admin_purpose_categories"],
    queryFn: async () => {
      const res = await fetch("/api/admin/purposes");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
    enabled: !!user && !isAuthLoading
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/admin/purposes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create category");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Category created successfully");
      setIsAdding(false);
      setNewCategory({ name: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ["admin_purpose_categories"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/admin/purposes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["admin_purpose_categories"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-bold mb-2 uppercase tracking-wider border border-brand-primary/20">
            <FolderTree className="w-3 h-3" />
            Financial Hierarchy
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground tracking-tight">Purpose Categories</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Define high-level financial classifications like CAPEX, OPEX, and Internal IT.</p>
        </div>

        <button 
          onClick={() => setIsAdding(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-2xl transition-all shadow-xl font-bold flex items-center gap-2 active:scale-95 group"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
          Create Category
        </button>
      </div>

      {isAdding && (
        <div className="bg-card p-6 rounded-3xl border border-brand-primary/30 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-lg font-bold">New Category Definition</h3>
            <button onClick={() => setIsAdding(false)} className="text-muted-foreground hover:text-foreground p-1 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Category Name</label>
              <input 
                type="text" 
                placeholder="e.g., CAPEX 2026"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium"
                value={newCategory.name}
                onChange={(e) => setNewCategory(s => ({ ...s, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Description</label>
              <input 
                type="text" 
                placeholder="Brief purpose description..."
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium"
                value={newCategory.description}
                onChange={(e) => setNewCategory(s => ({ ...s, description: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button 
              onClick={() => setIsAdding(false)}
              className="px-6 py-2 rounded-xl text-sm font-bold hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => createMutation.mutate(newCategory)}
              disabled={!newCategory.name || createMutation.isPending}
              className="bg-brand-primary text-white px-8 py-2 rounded-xl text-sm font-bold shadow-lg shadow-brand-primary/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {createMutation.isPending ? "Defining..." : "Confirm Definition"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="p-5 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Classification</th>
              <th className="p-5 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Description</th>
              <th className="p-5 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Status</th>
              <th className="p-5 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Governance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {categories.map((cat: any) => (
              <tr key={cat.id} className="hover:bg-secondary/50 transition-colors group">
                <td className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-brand-primary rounded-full group-hover:scale-y-125 transition-transform" />
                    <span className="text-foreground font-bold text-lg tracking-tight leading-none">{cat.name}</span>
                  </div>
                </td>
                <td className="p-5">
                  <p className="text-sm text-muted-foreground font-medium line-clamp-1">{cat.description || "No description provided."}</p>
                </td>
                <td className="p-5">
                  {cat.status === 'frozen' ? (
                    <span className="px-3 py-1 bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 rounded-lg text-[10px] font-black uppercase tracking-tighter">Frozen</span>
                  ) : (
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-[10px] font-black uppercase tracking-tighter">Active</span>
                  )}
                </td>
                <td className="p-5 text-right space-x-2">
                  <button 
                    onClick={() => toggleStatusMutation.mutate({ id: cat.id, status: cat.status === 'active' ? 'frozen' : 'active' })}
                    className="p-2.5 hover:bg-secondary rounded-xl text-muted-foreground hover:text-cyan-500 transition-all outline-none"
                    title={cat.status === 'active' ? "Freeze Category" : "Activate Category"}
                  >
                    <Snowflake className={`w-5 h-5 ${cat.status === 'frozen' ? 'fill-cyan-500/20' : ''}`} />
                  </button>
                  <button 
                    className="p-2.5 hover:bg-secondary rounded-xl text-muted-foreground hover:text-rose-500 transition-all outline-none"
                    title="Archive"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {categories.length === 0 && !isAdding && (
          <div className="p-20 text-center">
            <div className="bg-secondary/50 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-border">
              <FolderTree className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <h3 className="text-lg font-bold text-foreground">No Categories Defined</h3>
            <p className="text-muted-foreground font-medium">Start by defining CAPEX or OPEX to organize your projects.</p>
          </div>
        )}
      </div>
    </div>
  );
}
