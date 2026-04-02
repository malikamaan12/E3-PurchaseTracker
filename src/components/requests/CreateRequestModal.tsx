"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  X, 
  Plus, 
  AlertCircle, 
  Loader2, 
  DollarSign, 
  Layout, 
  AlignLeft,
  Truck,
  Briefcase
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";

const requestSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  totalEstimatedCost: z.coerce.number().positive("Amount must be greater than 0"),
  vendorId: z.coerce.number().positive("Please select a vendor"),
  purposeType: z.enum(["E3 EVENT", "PROJECT", "MALL", "BUSINESS GROWTH", "General"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
});

type RequestFormValues = z.infer<typeof requestSchema>;

interface CreateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateRequestModal({ isOpen, onClose, onSuccess }: CreateRequestModalProps) {
  const [vendors, setVendors] = useState<any[]>([]);
  const [isLoadingVendors, setIsLoadingVendors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      purposeType: "General",
      priority: "medium",
    }
  });

  useEffect(() => {
    if (isOpen) {
      fetchVendors();
    }
  }, [isOpen]);

  const fetchVendors = async () => {
    setIsLoadingVendors(true);
    try {
      const data = await apiClient.vendors.list();
      setVendors(data);
    } catch (error) {
      toast.error("Failed to load vendors");
    } finally {
      setIsLoadingVendors(false);
    }
  };

  const onSubmit = async (data: RequestFormValues) => {
    setIsSubmitting(true);
    try {
      await apiClient.requests.create(data);
      toast.success("Purchase request created successfully");
      reset();
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to create request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-brand-primary/10 to-transparent">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-primary/20 flex items-center justify-center">
                  <Plus className="text-brand-primary w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-serif font-bold text-white tracking-tight">Create Request</h2>
                  <p className="text-xs text-zinc-500 font-bold tracking-widest uppercase">New Purchase Order</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-xl text-zinc-500 hover:text-white transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Title */}
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Request Title</label>
                  <div className="relative group">
                    <Layout className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-brand-primary transition-colors" />
                    <input
                      {...register("title")}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-12 py-3.5 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:bg-white/10 transition-all"
                      placeholder="e.g. Office Equipment for Q2"
                    />
                    {errors.title && <p className="text-[10px] text-rose-500 mt-1.5 font-bold uppercase tracking-wider">{errors.title.message}</p>}
                  </div>
                </div>

                {/* Amount */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Estimated Cost (QAR)</label>
                  <div className="relative group">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-brand-primary transition-colors" />
                    <input
                      type="number"
                      {...register("totalEstimatedCost")}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-12 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:bg-white/10 transition-all"
                    />
                    {errors.totalEstimatedCost && <p className="text-[10px] text-rose-500 mt-1.5 font-bold uppercase tracking-wider">{errors.totalEstimatedCost.message}</p>}
                  </div>
                </div>

                {/* Vendor Select */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Preferred Vendor</label>
                  <div className="relative group">
                    <Truck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-brand-primary transition-colors" />
                    <select
                      {...register("vendorId")}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-12 py-3.5 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:bg-white/10 transition-all"
                    >
                      <option value="" disabled className="bg-zinc-900">Select Vendor...</option>
                      {vendors.map(v => (
                        <option key={v.id} value={v.id} className="bg-zinc-900">{v.companyName}</option>
                      ))}
                    </select>
                    {errors.vendorId && <p className="text-[10px] text-rose-500 mt-1.5 font-bold uppercase tracking-wider">{errors.vendorId.message}</p>}
                  </div>
                </div>

                {/* Purpose Type */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Purpose Category</label>
                  <div className="relative group">
                    <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-brand-primary transition-colors" />
                    <select
                      {...register("purposeType")}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-12 py-3.5 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:bg-white/10 transition-all"
                    >
                      <option value="General" className="bg-zinc-900">General</option>
                      <option value="E3 EVENT" className="bg-zinc-900">E3 EVENT</option>
                      <option value="PROJECT" className="bg-zinc-900">PROJECT</option>
                      <option value="MALL" className="bg-zinc-900">MALL</option>
                      <option value="BUSINESS GROWTH" className="bg-zinc-900">BUSINESS GROWTH</option>
                    </select>
                  </div>
                </div>

                {/* Priority */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Priority Level</label>
                  <div className="flex gap-2 p-1.5 bg-white/5 rounded-xl border border-white/5">
                    {["low", "medium", "high", "urgent"].map((p) => (
                      <label key={p} className="flex-1 cursor-pointer group">
                        <input type="radio" {...register("priority")} value={p} className="hidden peer" />
                        <div className="py-2 text-center rounded-lg text-[10px] font-bold uppercase transition-all border border-transparent peer-checked:bg-white/10 peer-checked:text-white peer-checked:border-white/10 text-zinc-600 group-hover:text-zinc-400">
                          {p}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Requirement Details</label>
                  <div className="relative group">
                    <AlignLeft className="absolute left-4 top-4 w-4 h-4 text-zinc-600 group-focus-within:text-brand-primary transition-colors" />
                    <textarea
                      {...register("description")}
                      rows={4}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-12 py-4 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:bg-white/10 transition-all resize-none"
                      placeholder="Explain the necessity and items required..."
                    />
                    {errors.description && <p className="text-[10px] text-rose-500 mt-1.5 font-bold uppercase tracking-wider">{errors.description.message}</p>}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-4 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 rounded-xl text-sm font-bold text-zinc-500 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-3 bg-brand-primary text-white px-8 py-3 rounded-xl text-sm font-bold shadow-lg shadow-brand-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Request"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
