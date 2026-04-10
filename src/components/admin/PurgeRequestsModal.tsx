"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertCircle, X, ShieldAlert, Loader2, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PurgeRequestsModalProps {
  trigger?: React.ReactNode;
}

export function PurgeRequestsModal({ trigger }: PurgeRequestsModalProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const queryClient = useQueryClient();

  const purgeMutation = useMutation({
    mutationFn: async (pwd: string) => {
      const response = await fetch("/api/admin/purge-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || "Purge failed");
      return data;
    },
    onSuccess: () => {
      toast.success("Institutional data purged successfully.");
      // Invalidate all dependent caches to prevent stale data anywhere in the UI
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["requests-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      setIsOpen(false);
      setPassword("");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handlePurge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast.error("Institutional verification required.");
      return;
    }
    purgeMutation.mutate(password);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        {trigger || (
          <Button variant="destructive" className="h-12 px-6 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Purge Test Requests
          </Button>
        )}
      </Dialog.Trigger>
      
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[1000] animate-in fade-in duration-300" />
        <Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[95vw] max-w-[480px] z-[1001] outline-none">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="glass-card border-rose-500/20 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 bg-rose-500/5 border-b border-rose-500/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-500">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <Dialog.Title className="text-sm font-black text-foreground uppercase tracking-widest">
                    Danger Zone: System Purge
                  </Dialog.Title>
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter opacity-60">
                    Institutional Reset Authorization
                  </p>
                </div>
              </div>
              <Dialog.Close className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
                <X className="w-4 h-4" />
              </Dialog.Close>
            </div>

            <div className="p-8 space-y-6">
              {/* WARNING BOX */}
              <div className="flex items-start gap-4 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[11px] font-black uppercase tracking-widest leading-none">Critical Warning</p>
                  <p className="text-[10px] leading-relaxed opacity-90 font-medium">
                    This action is **irreversible**. All purchase requests, approvals, payment installments, 
                    and linked file attachments will be permanently deleted from the database.
                  </p>
                </div>
              </div>

              <form onSubmit={handlePurge} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Admin Password Verification
                  </label>
                  <Input 
                    type="password"
                    placeholder="Enter your administrative password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 bg-white/5 border-white/10 focus:border-[#5B4B8A] transition-all rounded-xl text-xs font-bold"
                    autoFocus
                  />
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <Dialog.Close asChild>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      className="flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-secondary"
                    >
                      Cancel Operation
                    </Button>
                  </Dialog.Close>
                  <Button 
                    type="submit"
                    disabled={purgeMutation.isPending}
                    className="flex-1 h-12 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-600/20 flex items-center justify-center gap-2 group transition-all active:scale-[0.98]"
                  >
                    {purgeMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      Authorize Purge
                    </span>
                  </Button>
                </div>
              </form>
            </div>
            
            {/* BRAND FOOTER */}
            <div className="p-4 bg-secondary/30 flex items-center justify-center border-t border-white/5">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#5B4B8A] opacity-40">
                PurchaseTracker Institutional Governance
              </span>
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
