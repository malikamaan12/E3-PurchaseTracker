"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, XCircle, RotateCcw, AlertTriangle } from "lucide-react";

interface ConfirmActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  type: "approve" | "reject" | "changes";
  comments?: string;
  isPending?: boolean;
}

export function ConfirmActionDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  type,
  comments,
  isPending = false
}: ConfirmActionDialogProps) {
  
  const safeType = ['approve', 'reject', 'changes'].includes(type) ? type : 'approve';

  const colors = {
    approve: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20",
    reject: "text-rose-400 bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/20",
    changes: "text-amber-400 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20"
  };

  const icons = {
    approve: <CheckCircle2 className="w-6 h-6 text-emerald-400" />,
    reject: <XCircle className="w-6 h-6 text-rose-400" />,
    changes: <RotateCcw className="w-6 h-6 text-amber-400" />
  };

  const colorStyle = colors[safeType as keyof typeof colors];
  const iconElement = icons[safeType as keyof typeof icons];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-card w-full max-w-md border border-border rounded-3xl shadow-2xl relative overflow-hidden"
          >
            {/* Header Branding */}
            <div className={`h-1.5 w-full ${
              safeType === 'approve' ? 'bg-emerald-500' : 
              safeType === 'reject' ? 'bg-rose-500' : 'bg-amber-500'
            }`} />

            <div className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 rounded-2xl border ${colorStyle.replace('text-', 'border-').replace('bg-', 'bg-')}`}>
                  {iconElement}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{title}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{description}</p>
                </div>
              </div>

              {comments && (
                <div className="mb-6 p-4 rounded-2xl bg-secondary/30 border border-border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">Final Comments</span>
                  <p className="text-sm text-foreground italic">"{comments}"</p>
                </div>
              )}

              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  disabled={isPending}
                  className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg border ${colors[type]}`}
                >
                  {isPending ? "Processing..." : "Confirm Action"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
