"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DeleteRequestDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading?: boolean;
  requestNumber?: string;
}

/**
 * Apple-style fluid glassmorphism confirmation dialog for PR deletion.
 * Uses Radix UI for accessibility and Framer Motion for premium feel.
 */
export function DeleteRequestDialog({ 
  isOpen, 
  onOpenChange, 
  onConfirm, 
  isLoading, 
  requestNumber 
}: DeleteRequestDialogProps) {
  return (
    <AlertDialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {isOpen && (
          <AlertDialog.Portal forceMount>
            <AlertDialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
              />
            </AlertDialog.Overlay>
            <AlertDialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="fixed left-[50%] top-[50%] z-[201] w-[92vw] max-w-md translate-x-[-50%] translate-y-[-50%] p-2 focus:outline-none"
              >
                <div className="bg-card border border-border rounded-3xl shadow-2xl overflow-hidden p-8 text-center">
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-6">
                    <AlertCircle className="w-8 h-8 text-rose-500" />
                  </div>
                  
                  <AlertDialog.Title className="text-2xl font-serif font-bold text-foreground tracking-tight">
                    Confirm Deletion
                  </AlertDialog.Title>
                  
                  <AlertDialog.Description className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    Are you sure you want to permanently remove <span className="font-bold text-foreground">{requestNumber || "this request"}</span>? 
                    This action will invalidate all associated records and cannot be undone.
                  </AlertDialog.Description>

                  <div className="mt-10 flex gap-4 justify-center">
                    <AlertDialog.Cancel asChild>
                      <button className="flex-1 px-6 py-3 rounded-2xl text-xs font-bold text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary transition-all border border-border">
                        Dismiss
                      </button>
                    </AlertDialog.Cancel>
                    
                    <AlertDialog.Action asChild>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          onConfirm();
                        }}
                        disabled={isLoading}
                        className="flex-[1.5] bg-rose-500 text-white px-8 py-3 rounded-2xl text-xs font-bold hover:bg-rose-600 transition-all shadow-xl shadow-rose-500/30 active:scale-95 disabled:opacity-50 flex items-center justify-center min-w-[140px]"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Delete Permanently
                      </button>
                    </AlertDialog.Action>
                  </div>
                </div>
              </motion.div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        )}
      </AnimatePresence>
    </AlertDialog.Root>
  );
}
