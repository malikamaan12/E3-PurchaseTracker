"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { CopyPlus, ShieldPlus, Check, X, Building2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { safeFormatDate } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import { ActionConfirmDialog } from "@/components/ui/ActionConfirmDialog";

export default function AccountRequestsPage() {
  usePageTitle("Account Requests");
  const { user, isLoading: isAuthLoading, isSuperAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<{ request: any; type: 'approve' | 'reject' } | null>(null);

  useEffect(() => {
    if (!isAuthLoading && user && !isSuperAdmin) {
      toast.error("Access denied. Governance & System is restricted to Super Admin.");
      router.replace("/dashboard/admin");
    }
  }, [isAuthLoading, user, isSuperAdmin, router]);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["admin_account_requests"],
    queryFn: () => apiClient.admin.accountRequests.list({ status: "pending" }),
    enabled: !!user && !isAuthLoading && !!isSuperAdmin
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
      setConfirmAction(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reject request");
      setConfirmAction(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground tracking-tight">Account Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">Review and approve self-service employee registration requests.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {requests.map((req: any) => (
          <div key={req.id} className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold text-lg uppercase border border-brand-primary/20">
                  {req.username.substring(0,2)}
                </div>
              </div>
              
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-foreground tracking-tight group-hover:text-brand-primary transition-colors truncate" title={req.username}>{req.username}</h3>
                <p className="text-sm text-muted-foreground truncate" title={req.email}>{req.email}</p>
                <div className="flex gap-4 mt-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><CopyPlus className="w-3 h-3"/>{req.contact_number}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3"/>{req.department}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-50">Requested Role</p>
                <p className="text-sm font-bold text-foreground capitalize">{req.role}</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter opacity-50 font-bold">Applied: {safeFormatDate(req.createdAt, 'MMM dd, yyyy')}</p>
              </div>
            </div>

            <div className="flex gap-2.5 mt-6 pt-4 border-t border-border/50">
              <button 
                onClick={() => setConfirmAction({ request: req, type: 'approve' })}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                aria-label={`Approve request for ${req.username}`}
                className="flex-[1.5] min-h-[44px] py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 touch-target shadow-sm"
              >
                <Check className="w-4 h-4"/> Approve
              </button>
              <button 
                onClick={() => setConfirmAction({ request: req, type: 'reject' })}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                aria-label={`Reject request for ${req.username}`}
                className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-secondary/80 hover:bg-rose-500/10 hover:border-rose-500/20 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 border border-border font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 touch-target"
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

      <ActionConfirmDialog
        isOpen={!!confirmAction}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
        title={confirmAction?.type === "approve" ? "Approve Account Request" : "Reject Account Request"}
        variant={confirmAction?.type === "approve" ? "success" : "danger"}
        confirmText={confirmAction?.type === "approve" ? "Grant Access & Activate" : "Reject Request"}
        isLoading={approveMutation.isPending || rejectMutation.isPending}
        onConfirm={() => {
          if (confirmAction) {
            if (confirmAction.type === "approve") {
              approveMutation.mutate(confirmAction.request.id);
            } else {
              rejectMutation.mutate(confirmAction.request.id);
            }
          }
        }}
        description={
          <div className="space-y-3 text-left">
            <p>
              {confirmAction?.type === "approve"
                ? `Are you sure you want to approve and provision access for this user?`
                : `Are you sure you want to reject this registration request?`}
            </p>
            <div className="p-3 bg-secondary/40 rounded-xl border border-border space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Username:</span>
                <span className="font-bold text-foreground">{confirmAction?.request?.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Email:</span>
                <span className="text-foreground truncate max-w-[200px]">{confirmAction?.request?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Department:</span>
                <span className="font-bold text-foreground">{confirmAction?.request?.department}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Requested Role:</span>
                <span className="font-bold capitalize text-brand-primary">{confirmAction?.request?.role}</span>
              </div>
            </div>
          </div>
        }
      />
    </div>
  );
}
