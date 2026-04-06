"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  X, 
  Plus, 
  Trash2, 
  Loader2, 
  Calendar, 
  DollarSign, 
  Building2, 
  Save,
  AlertCircle,
  Briefcase
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const budgetSplitSchema = z.object({
  departmentId: z.coerce.number().positive("Select department"),
  amount: z.coerce.number().min(0, "Amount cannot be negative"),
});

const projectSchema = z.object({
  name: z.string().min(3, "Project name must be at least 3 characters"),
  purposeCategoryId: z.coerce.number().optional().nullable(),
  totalBudget: z.coerce.number().min(0, "Total budget cannot be negative"),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
  budgetSplits: z.array(budgetSplitSchema).optional().default([]),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number | null;
  departments: any[];
  purposeCategoryId?: number | null;
  onSuccess: () => void;
}

export default function ProjectModal({ isOpen, onClose, projectId, departments, purposeCategoryId, onSuccess }: ProjectModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors }
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      purposeCategoryId: purposeCategoryId || null,
      totalBudget: 0,
      budgetSplits: []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "budgetSplits"
  });

  const formBudgetSplits = watch("budgetSplits") || [];
  const totalAllocated = formBudgetSplits.reduce((sum, split) => sum + (Number(split.amount) || 0), 0);
  const totalBudget = watch("totalBudget") || 0;
  const isOverAllocated = totalAllocated > totalBudget;

  useEffect(() => {
    if (isOpen && projectId) {
      fetchProjectDetails(projectId);
    } else if (isOpen) {
      reset({
        purposeCategoryId: purposeCategoryId || null,
        totalBudget: 0,
        budgetSplits: []
      });
    }
  }, [isOpen, projectId]);

  const fetchProjectDetails = async (id: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/sub-purposes/${id}`);
      if (!res.ok) throw new Error("Failed to load project details");
      const data = await res.json();
      
      reset({
        name: data.name,
        purposeCategoryId: data.purposeCategoryId,
        totalBudget: data.totalBudget,
        validFrom: data.validFrom ? new Date(data.validFrom).toISOString().split('T')[0] : null,
        validTo: data.validTo ? new Date(data.validTo).toISOString().split('T')[0] : null,
        budgetSplits: data.budgetSplits?.map((s: any) => ({
          departmentId: s.departmentId,
          amount: s.allocatedAmount
        })) || []
      });
    } catch (error) {
      toast.error("Failed to load project details");
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: ProjectFormValues) => {
    if (isOverAllocated) {
      toast.error("Total departmental allocations cannot exceed the project budget limit.");
      return;
    }

    setIsSubmitting(true);
    try {
      const method = projectId ? "PATCH" : "POST";
      const url = projectId ? `/api/admin/sub-purposes/${projectId}` : "/api/admin/sub-purposes";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to save project");

      toast.success(projectId ? "Project updated successfully" : "Project initialized successfully");
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
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
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
            className="relative w-full max-w-3xl bg-card border border-border rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-8 border-b border-border flex items-center justify-between bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Briefcase className="text-primary w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-serif font-black tracking-tight">
                    {projectId ? "Modify Strategic Project" : "Initialize New Project"}
                  </h2>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Project Governance Framework</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-secondary rounded-xl text-muted-foreground transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Synchronizing Project Data...</p>
                </div>
              ) : (
                <form id="project-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="col-span-2 space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Project Identifier</label>
                       <input 
                         {...register("name")}
                         className="w-full bg-secondary border border-border rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                         placeholder="e.g., Doha Logistics Expansion Phase II"
                       />
                       {errors.name && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-tighter ml-1">{errors.name.message}</p>}
                    </div>

                     <div className="space-y-2 col-span-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Total Allocated Budget (QAR)</label>
                        <div className="relative">
                           <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
                           <input 
                             type="number"
                             {...register("totalBudget")}
                             className="w-full bg-secondary border border-border rounded-2xl pl-12 pr-5 py-4 text-sm font-black focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                             placeholder="0.00"
                           />
                        </div>
                     </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Valid From</label>
                       <div className="relative">
                          <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
                          <input 
                            type="date"
                            {...register("validFrom")}
                            className="w-full bg-secondary border border-border rounded-2xl pl-12 pr-5 py-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                          />
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Valid To</label>
                       <div className="relative">
                          <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
                          <input 
                            type="date"
                            {...register("validTo")}
                            className="w-full bg-secondary border border-border rounded-2xl pl-12 pr-5 py-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                          />
                       </div>
                    </div>
                  </div>

                  {/* Departmental Splits */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-4">
                       <div>
                          <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                             <Building2 className="w-4 h-4 text-primary" />
                             Departmental Budget Splits
                          </h3>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Provision specific ceilings for individual departments</p>
                       </div>
                       <button 
                         type="button"
                         onClick={() => append({ departmentId: 0, amount: 0 })}
                         className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
                       >
                         <Plus className="w-3 h-3" />
                         Add Allocation
                       </button>
                    </div>

                    <div className="space-y-3">
                       {fields.map((field, index) => (
                         <motion.div 
                           initial={{ opacity: 0, y: -10 }}
                           animate={{ opacity: 1, y: 0 }}
                           key={field.id} 
                           className="flex items-center gap-4 bg-secondary/30 p-4 rounded-2xl border border-border/50 group"
                         >
                           <div className="flex-1">
                              <select 
                                {...register(`budgetSplits.${index}.departmentId` as const)}
                                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/10 outline-none appearance-none"
                              >
                                <option value="0">Select Department...</option>
                                {departments.map(d => (
                                  <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                              </select>
                           </div>
                           <div className="flex-1 relative">
                              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/30" />
                              <input 
                                type="number"
                                {...register(`budgetSplits.${index}.amount` as const)}
                                className="w-full bg-secondary border border-border rounded-xl pl-9 pr-4 py-3 text-xs font-black focus:ring-2 focus:ring-primary/10 outline-none"
                                placeholder="Amount"
                              />
                           </div>
                           <button 
                             type="button"
                             onClick={() => remove(index)}
                             className="p-3 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 rounded-xl transition-all"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </motion.div>
                       ))}

                       {fields.length === 0 && (
                         <div className="py-10 text-center border-2 border-dashed border-border rounded-[2rem] bg-secondary/10">
                            <Building2 className="w-8 h-8 text-muted-foreground/10 mx-auto mb-2" />
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest transition-opacity hover:opacity-100 opacity-60">
                               No departmental splits provisioned.
                            </p>
                         </div>
                       )}
                    </div>

                    {/* Summary Section */}
                    <div className={`mt-6 p-6 rounded-[2rem] border transition-all ${
                      isOverAllocated ? 'bg-rose-500/10 border-rose-500/30' : 'bg-primary/5 border-primary/20'
                    }`}>
                       <div className="flex justify-between items-center">
                          <div>
                             <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Allocation Variance</span>
                             <div className="flex items-center gap-3 mt-1">
                                <span className={`text-xl font-serif font-black ${isOverAllocated ? 'text-rose-500' : 'text-primary'}`}>
                                   QAR {totalAllocated.toLocaleString()} / {totalBudget.toLocaleString()}
                                </span>
                                {isOverAllocated && (
                                  <span className="inline-flex items-center gap-1 text-rose-500">
                                     <AlertCircle className="w-4 h-4" />
                                     <span className="text-[9px] font-black uppercase tracking-tighter">Budget Exceeded</span>
                                  </span>
                                )}
                             </div>
                          </div>
                          <div className="text-right">
                             <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Remaining Capacity</span>
                             <span className={`text-sm font-black ${totalBudget - totalAllocated < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                QAR {(totalBudget - totalAllocated).toLocaleString()}
                             </span>
                          </div>
                       </div>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="p-8 border-t border-border bg-secondary/30 flex items-center justify-between">
              <button 
                type="button"
                onClick={onClose}
                className="px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-muted-foreground hover:bg-secondary transition-all"
              >
                Discard Changes
              </button>
              <button 
                form="project-form"
                type="submit"
                disabled={isSubmitting || isLoading || isOverAllocated}
                className="bg-primary text-primary-foreground px-10 py-4 rounded-[1.25rem] font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:grayscale transition-all flex items-center gap-3"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {projectId ? "Commit Updates" : "Initialize Infrastructure"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
