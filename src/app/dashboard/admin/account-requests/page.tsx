"use client";

import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { CopyPlus, ShieldPlus, Check, X, Building2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export default function AccountRequestsPage() {
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["admin_account_requests"],
    queryFn: () => apiClient.admin.accountRequests.list({ status: "pending" }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => apiClient.admin.accountRequests.approve(id),
    onSuccess: () => {
      toast.success("Account request approved");
      queryClient.invalidateQueries({ queryKey: ["admin_account_requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    },
    onError: (error: any) => toast.error(error.message || "Failed to approve request"),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => apiClient.admin.accountRequests.reject(id),
    onSuccess: () => {
      toast.success("Account request rejected");
      queryClient.invalidateQueries({ queryKey: ["admin_account_requests"] });
    },
    onError: (error: any) => toast.error(error.message || "Failed to reject request"),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground tracking-tight">Account Requests</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium italic">Review and approve new user registrations pending access.</p>
        </div>
        <div className="bg-secondary/50 px-4 py-2 rounded-xl flex items-center gap-2 border border-border transition-colors">
          <ShieldPlus className="w-5 h-5 text-amber-500" />
          <span className="text-foreground font-bold">{requests.length} Pending</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {requests.map((req: any) => (
          <div key={req.id} className="bg-card p-6 rounded-3xl border border-border flex flex-col justify-between hover:border-brand-primary/20 transition-all shadow-xl group">
            
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold text-lg uppercase border border-brand-primary/20">
                  {req.username.substring(0,2)}
                </div>
                <div className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] uppercase font-bold tracking-widest">
                  Pending
                </div>
              </div>
              
              <div>
                <h3 className="text-xl font-bold text-foreground tracking-tight group-hover:text-brand-primary transition-colors">{req.username}</h3>
                <p className="text-sm text-muted-foreground">{req.email}</p>
                <div className="flex gap-4 mt-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><CopyPlus className="w-3 h-3"/>{req.contact_number}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3"/>{req.department}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-50">Requested Role</p>
                <p className="text-sm font-bold text-foreground capitalize">{req.role}</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter opacity-50 font-bold">Applied: {format(new Date(req.createdAt), 'MMM dd, yyyy')}</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => approveMutation.mutate(req.id)}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                className="flex-1 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-500 font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Check className="w-4 h-4"/> Approve
              </button>
              <button 
                onClick={() => rejectMutation.mutate(req.id)}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                className="flex-1 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-500 font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <X className="w-4 h-4"/> Reject
              </button>
            </div>
          </div>
        ))}
        
        {requests.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground font-bold uppercase tracking-widest text-[10px] bg-secondary/20 rounded-3xl border border-border border-dashed">
            No pending account requests at this time.
          </div>
        )}
      </div>
    </div>
  );
}
