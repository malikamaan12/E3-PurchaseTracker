"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import React from "react";

export interface ActionConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "primary" | "success";
  isLoading?: boolean;
}

export function ActionConfirmDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "primary",
  isLoading = false,
}: ActionConfirmDialogProps) {
  const getIcon = () => {
    switch (variant) {
      case "danger":
        return <AlertCircle className="w-7 h-7 text-rose-500" />;
      case "warning":
        return <AlertTriangle className="w-7 h-7 text-amber-500" />;
      case "success":
        return <CheckCircle2 className="w-7 h-7 text-emerald-500" />;
      case "primary":
      default:
        return <ShieldCheck className="w-7 h-7 text-brand-primary" />;
    }
  };

  const getConfirmStyle = () => {
    switch (variant) {
      case "danger":
        return "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20";
      case "warning":
        return "bg-amber-500 hover:bg-amber-600 text-black shadow-amber-500/20";
      case "success":
        return "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20";
      case "primary":
      default:
        return "bg-brand-primary hover:brightness-110 text-white shadow-brand-primary/20";
    }
  };

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
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                className="fixed left-[50%] top-[50%] z-[201] w-[92vw] max-w-md translate-x-[-50%] translate-y-[-50%] p-2 focus:outline-none"
              >
                <div className="bg-card border border-border rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-7 text-center">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-secondary/80 flex items-center justify-center mb-4 border border-border">
                    {getIcon()}
                  </div>

                  <AlertDialog.Title className="text-xl font-serif font-bold text-foreground tracking-tight">
                    {title}
                  </AlertDialog.Title>

                  <AlertDialog.Description asChild>
                    <div className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {description}
                    </div>
                  </AlertDialog.Description>

                  <div className="mt-8 flex gap-3 justify-center">
                    <AlertDialog.Cancel asChild>
                      <button
                        type="button"
                        className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary transition-all border border-border touch-target"
                      >
                        {cancelText}
                      </button>
                    </AlertDialog.Cancel>

                    <AlertDialog.Action asChild>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          onConfirm();
                        }}
                        disabled={isLoading}
                        className={`flex-1 min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 touch-target ${getConfirmStyle()}`}
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {confirmText}
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
