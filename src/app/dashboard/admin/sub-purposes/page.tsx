"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { FileCheck, Plus, Trash2, Snowflake } from "lucide-react";

export default function SubPurposesPage() {
  const queryClient = useQueryClient();
  const [newSubPurpose, setNewSubPurpose] = useState({ name: "", purposeType: "Project" });

  const { data: subPurposes = [], isLoading } = useQuery({
    queryKey: ["admin_sub_purposes"],
    queryFn: () => apiClient.admin.subPurposes.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient.admin.subPurposes.create(data),
    onSuccess: () => {
      toast.success("Sub-purpose created");
      setNewSubPurpose({ name: "", purposeType: "PROJECT" });
      queryClient.invalidateQueries({ queryKey: ["admin_sub_purposes"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to create"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.admin.subPurposes.delete(id),
    onSuccess: () => {
      toast.success("Deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["admin_sub_purposes"] });
    },
    onError: (err: any) => toast.error(err.message || "Cannot delete sub-purpose. Make sure it isn't linked to existing requests."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiClient.admin.subPurposes.update(id, data),
    onSuccess: () => {
      toast.success("Updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin_sub_purposes"] });
    },
    onError: (err: any) => toast.error(err.message || "Update failed"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubPurpose.name) return;
    createMutation.mutate(newSubPurpose);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground tracking-tight">Sub-purposes</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Manage dynamic dropdown catalogs for global purchase requests.</p>
        </div>
        
        {/* Create Form */}
        <form onSubmit={handleSubmit} className="bg-card p-2 rounded-2xl border border-border flex gap-2 w-full md:w-auto shadow-xl transition-colors">
          <select 
            className="bg-secondary border-border text-foreground rounded-xl px-4 py-2 text-sm appearance-none outline-none focus:ring-2 focus:ring-brand-primary/20 border min-w-[120px] transition-all"
            value={newSubPurpose.purposeType}
            onChange={(e) => setNewSubPurpose(s => ({ ...s, purposeType: e.target.value }))}
          >
            <option value="PROJECT">Project</option>
            <option value="E3 EVENT">Event</option>
            <option value="MALL">Mall</option>
            <option value="BUSINESS GROWTH">Growth</option>
          </select>
          <input 
            type="text" 
            placeholder="New Category Name..."
            className="bg-secondary border border-border text-foreground rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-primary/20 flex-1 min-w-[200px] transition-all"
            value={newSubPurpose.name}
            onChange={(e) => setNewSubPurpose(s => ({ ...s, name: e.target.value }))}
          />
          <button 
            type="submit" 
            disabled={createMutation.isPending || !newSubPurpose.name}
            className="bg-primary hover:brightness-110 text-primary-foreground p-2 rounded-xl transition-all disabled:opacity-50 active:scale-95 shadow-lg"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>
      </div>

      <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[200px]">Purpose Type</th>
              <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Name</th>
              <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Status</th>
              <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {subPurposes.map((sub: any) => (
              <tr key={sub.id} className="hover:bg-secondary/50 transition-colors">
                <td className="p-4">
                  <span className="px-3 py-1 bg-secondary rounded-lg text-xs font-bold text-muted-foreground capitalize">
                    {sub.purpose_type}
                  </span>
                </td>
                <td className="p-4">
                  <span className="text-foreground font-bold">{sub.name}</span>
                </td>
                <td className="p-4">
                  {sub.is_frozen ? (
                    <span className="px-2 py-1 bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 rounded text-[10px] font-bold uppercase transition-colors">Frozen</span>
                  ) : (
                    <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded text-[10px] font-bold uppercase transition-colors">Active</span>
                  )}
                </td>
                <td className="p-4 text-right space-x-2">
                  <button 
                    onClick={() => updateMutation.mutate({ id: sub.id, data: { ...sub, is_frozen: !sub.is_frozen }})}
                    className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-cyan-500 transition-colors outline-none"
                    title={sub.is_frozen ? "Unfreeze" : "Freeze"}
                  >
                    <Snowflake className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                       if(confirm(`Delete ${sub.name}?`)) deleteMutation.mutate(sub.id)
                    }}
                    className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-rose-500 transition-colors outline-none"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
         {subPurposes.length === 0 && (
          <div className="p-8 text-center text-muted-foreground font-medium">No sub-purposes configured.</div>
        )}
      </div>
    </div>
  );
}
