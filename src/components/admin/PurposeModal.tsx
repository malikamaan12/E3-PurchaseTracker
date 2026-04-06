"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  X, 
  Loader2, 
  Save,
  Briefcase,
  AlertCircle,
  FileText
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

const purposeSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional().nullable(),
  status: z.enum(["active", "frozen"]).default("active"),
});

type PurposeFormValues = z.infer<typeof purposeSchema>;

interface PurposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  purposeId: number | null;
  onSuccess: () => void;
}

export default function PurposeModal({ isOpen, onClose, purposeId, onSuccess }: PurposeModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<PurposeFormValues>({
    resolver: zodResolver(purposeSchema),
    defaultValues: {
      status: "active",
    }
  });

  useEffect(() => {
    if (isOpen && purposeId) {
      fetchPurposeDetails(purposeId);
    } else if (isOpen) {
      reset({
        name: "",
        description: "",
        status: "active",
      });
    }
  }, [isOpen, purposeId]);

  const fetchPurposeDetails = async (id: number) => {
    setIsLoading(true);
    try {
      // We'll use the list and find locally for simplicity if we don't have a dedicated single GET
      // but let's assume we can fetch it or just use the catalog data if passed.
      // For Phase 6 completeness, we'll fetch from /api/admin/purposes/[id]
      const res = await fetch(`/api/admin/purposes/${id}`);
      if (!res.ok) throw new Error("Failed to load category details");
      const data = await res.json();
      
      reset({
        name: data.name,
        description: data.description,
        status: data.status,
      });
    } catch (error) {
      toast.error("Failed to load category details");
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: PurposeFormValues) => {
    setIsSubmitting(true);
    try {
      if (purposeId) {
        await apiClient.admin.purposes.update(purposeId, data);
        toast.success("Governance category updated");
      } else {
        await apiClient.admin.purposes.create(data);
        toast.success("Strategic category initialized");
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-card border border-border rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-8 border-b border-border flex items-center justify-between bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Briefcase className="text-primary w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-serif font-black tracking-tight">
                    {purposeId ? "Modify Strategic Category" : "Category Initialization"}
                  </h2>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">High-Level Governance Framework</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-secondary rounded-xl text-muted-foreground transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Synchronizing Metadata...</p>
                </div>
              ) : (
                <form id="purpose-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Category Nomenclature</label>
                    <div className="relative group">
                       <Briefcase className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                       <input 
                         {...register("name")}
                         className="w-full bg-secondary border border-border rounded-2xl pl-12 pr-5 py-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/20"
                         placeholder="e.g., CAPEX, OPEX, Internal IT"
                       />
                    </div>
                    {errors.name && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-tighter ml-1">{errors.name.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Strategic Description</label>
                    <div className="relative group">
                       <FileText className="absolute left-5 top-5 w-4 h-4 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                       <textarea 
                         {...register("description")}
                         rows={4}
                         className="w-full bg-secondary border border-border rounded-2xl pl-12 pr-5 py-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none placeholder:text-muted-foreground/20"
                         placeholder="Provision the operational scope for this category..."
                       />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Governance Status</label>
                    <select 
                      {...register("status")}
                      className="w-full bg-secondary border border-border rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none appearance-none"
                    >
                      <option value="active">Active (Available for Requests)</option>
                      <option value="frozen">Frozen (Restricted/Immutable)</option>
                    </select>
                  </div>
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="p-8 border-t border-border bg-secondary/30 flex items-center justify-between">
              <button 
                type="button"
                onClick={onClose}
                className="px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-secondary transition-all"
              >
                Discard
              </button>
              <button 
                form="purpose-form"
                type="submit"
                disabled={isSubmitting || isLoading}
                className="bg-primary text-primary-foreground px-10 py-4 rounded-[1.25rem] font-black text-[10px] uppercase tracking-widest shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-3"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Commit Category
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
