import { useState, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
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
  Briefcase,
  Layers,
  ShieldCheck,
  ChevronRight,
  ClipboardList,
  Paperclip,
  Sparkles,
  Building2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import RequestItemGrid, { RequestItem } from "./RequestItemGrid";
import DocumentUploadZone from "../shared/DocumentUploadZone";

const requestSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Requirement Overview must be at least 10 characters"),
  totalEstimatedCost: z.coerce.number().min(0),
  vendorId: z.coerce.number().positive("Please select a vendor"),
  purposeType: z.enum(["E3 EVENT", "PROJECT", "MALL", "BUSINESS GROWTH", "General"]),
  subPurposeId: z.coerce.number().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  currency: z.enum(["QAR", "USD", "EUR", "AED"]).default("QAR"),
  freightAmount: z.coerce.number().min(0).default(0),
  items: z.array(z.object({
    name: z.string().min(1, "Item name required"),
    quantity: z.number().positive(),
    estimatedCost: z.number().min(0),
    description: z.string().optional()
  })).min(1, "At least one item is required"),
  additionalApprovers: z.array(z.string()).default([]),
  attachmentIds: z.array(z.number()).default([])
});

type RequestFormValues = z.infer<typeof requestSchema>;

interface CreateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateRequestModal({ isOpen, onClose, onSuccess }: CreateRequestModalProps) {
  const { data: departments = [] } = useQuery({
    queryKey: ["departments-public"],
    queryFn: () => apiClient.departments.list(),
  });

  const [vendors, setVendors] = useState<any[]>([]);
  const [subPurposes, setSubPurposes] = useState<any[]>([]);
  const [isLoadingSubPurposes, setIsLoadingSubPurposes] = useState(false);
  const [isLoadingVendors, setIsLoadingVendors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "items" | "approvals">("general");

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors }
  } = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      purposeType: "General",
      priority: "medium",
      currency: "QAR",
      freightAmount: 0,
      items: [{ name: "", quantity: 1, estimatedCost: 0, description: "" }],
      additionalApprovers: [],
      attachmentIds: []
    }
  });

  const formItems = watch("items");
  const formPurposeType = watch("purposeType");

  // Sync total cost when items change
  const totals = useMemo(() => {
    const itemsTotal = formItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.estimatedCost || 0)), 0);
    return itemsTotal;
  }, [formItems]);

  useEffect(() => {
    setValue("totalEstimatedCost", totals);
  }, [totals, setValue]);

  useEffect(() => {
    if (isOpen) {
      fetchVendors();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && formPurposeType) {
      fetchSubPurposes(formPurposeType);
    }
  }, [isOpen, formPurposeType]);

  const fetchSubPurposes = async (type: string) => {
    setIsLoadingSubPurposes(true);
    try {
      const data = await apiClient.requests.subPurposes.list({ purposeType: type });
      setSubPurposes(data);
    } catch (error) {
      console.error("Failed to load sub-purposes", error);
    } finally {
      setIsLoadingSubPurposes(false);
    }
  };

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
    <AnimatePresence mode="wait">
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/90 backdrop-blur-md cursor-pointer"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            className="relative w-full max-w-5xl bg-card border border-border rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh] z-[101] transition-colors duration-500"
          >
            {/* Header */}
            <div className="p-10 border-b border-border flex items-center justify-between bg-gradient-to-br from-primary/10 via-card to-card">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-[1.25rem] bg-primary/20 flex items-center justify-center shadow-2xl shadow-primary/20">
                  <Plus className="text-primary w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-3xl font-serif font-bold text-foreground tracking-tight transition-colors">Create Purchase Request</h2>
                  <div className="flex items-center gap-3 mt-1.5">
                    <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">Internal Procurement Engine</p>
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                    <p className="text-[10px] text-primary font-bold tracking-widest uppercase">Draft Mode</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-3 hover:bg-secondary rounded-2xl text-muted-foreground hover:text-foreground transition-all border border-transparent hover:border-border"
              >
                <X className="w-7 h-7" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex px-10 gap-8 border-b border-border bg-secondary/20 transition-colors">
              {[
                { id: "general", label: "General Details", icon: <Layout className="w-4 h-4" /> },
                { id: "items", label: "Itemized Budget", icon: <ClipboardList className="w-4 h-4" /> },
                { id: "approvals", label: "Uploads & Approvals", icon: <ShieldCheck className="w-4 h-4" /> }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-6 text-xs font-bold uppercase tracking-widest flex items-center gap-3 transition-all relative ${
                    activeTab === tab.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full shadow-[0_0_20px_rgba(var(--brand-primary-rgb),0.5)]" />
                  )}
                </button>
              ))}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
              <form id="request-form" onSubmit={handleSubmit(onSubmit, (errs) => {
                const firstError = Object.values(errs)[0];
                if (firstError?.message) {
                  toast.error(`Validation Error: ${firstError.message}`);
                } else {
                  toast.error("Please fill in all required fields correctly.");
                }
              })} className="space-y-10">
                
                {/* 1. General Details Section */}
                <AnimatePresence mode="wait">
                  {activeTab === "general" && (
                    <motion.div
                      key="general"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="grid grid-cols-2 gap-8"
                    >
                      <div className="col-span-2 space-y-3">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Request Title</label>
                        <div className="relative group">
                          <Layout className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                          <input
                            {...register("title")}
                            className="w-full bg-secondary/50 border border-border rounded-2xl px-14 py-4 text-sm text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-secondary transition-all font-semibold"
                            placeholder="e.g. Q3 Logistics Support & Fleet Hub..."
                          />
                          {errors.title && <p className="text-[10px] text-rose-500 mt-2 font-bold uppercase tracking-wider pl-1">{errors.title.message}</p>}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Vendor Partnership</label>
                        <div className="relative group">
                          <Truck className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                          <select
                            {...register("vendorId")}
                            className="w-full bg-secondary/50 border border-border rounded-2xl px-14 py-4 text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-secondary transition-all font-semibold"
                          >
                            <option value="" disabled className="bg-card">Select active vendor...</option>
                            {vendors.map(v => (
                              <option key={v.id} value={v.id} className="bg-card">{v.companyName}</option>
                            ))}
                          </select>
                          {errors.vendorId && <p className="text-[10px] text-rose-500 mt-2 font-bold uppercase tracking-wider pl-1">{errors.vendorId.message}</p>}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Purpose Category</label>
                        <div className="relative group">
                          <Briefcase className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                          <select
                            {...register("purposeType")}
                            className="w-full bg-secondary/50 border border-border rounded-2xl px-14 py-4 text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-secondary transition-all font-semibold"
                          >
                            <option value="General" className="bg-card">General Requirement</option>
                            <option value="E3 EVENT" className="bg-card">E3 EVENT</option>
                            <option value="PROJECT" className="bg-card">PROJECT</option>
                            <option value="MALL" className="bg-card">MALL</option>
                            <option value="BUSINESS GROWTH" className="bg-card">BUSINESS GROWTH</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Sub Purpose</label>
                        <div className="relative group">
                          <Layers className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                          <select
                            {...register("subPurposeId")}
                            className="w-full bg-secondary/50 border border-border rounded-2xl px-14 py-4 text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-secondary transition-all font-semibold disabled:opacity-50"
                            disabled={isLoadingSubPurposes || subPurposes.length === 0}
                          >
                            <option value="" className="bg-card">Optional: Select Sub Purpose...</option>
                            {subPurposes.map(sp => (
                              <option key={sp.id} value={sp.id} className="bg-card">{sp.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Priority</label>
                        <div className="relative group">
                          <AlertCircle className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                          <select
                            {...register("priority")}
                            className="w-full bg-secondary/50 border border-border rounded-2xl px-14 py-4 text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-secondary transition-all font-semibold"
                          >
                            <option value="low" className="bg-card">Low Priority</option>
                            <option value="medium" className="bg-card">Medium Priority</option>
                            <option value="high" className="bg-card text-orange-500">High Priority</option>
                            <option value="urgent" className="bg-card text-rose-500">Urgent Requirement</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Currency</label>
                        <div className="relative group">
                          <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                          <select
                            {...register("currency")}
                            className="w-full bg-secondary/50 border border-border rounded-2xl px-14 py-4 text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-secondary transition-all font-semibold"
                          >
                            <option value="QAR" className="bg-card">QAR - Qatari Riyal</option>
                            <option value="USD" className="bg-card">USD - US Dollar</option>
                            <option value="EUR" className="bg-card">EUR - Euro</option>
                            <option value="AED" className="bg-card">AED - UAE Dirham</option>
                          </select>
                        </div>
                      </div>

                      <div className="col-span-2 space-y-3">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Requirement Overview</label>
                        <div className="relative group">
                          <AlignLeft className="absolute left-5 top-5 w-5 h-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                          <textarea
                            {...register("description")}
                            rows={4}
                            className="w-full bg-secondary/50 border border-border rounded-2xl px-14 py-5 text-sm text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-secondary transition-all resize-none font-medium leading-relaxed"
                            placeholder="Detail the scope of work and reason for purchase..."
                          />
                          {errors.description && <p className="text-[10px] text-rose-500 mt-2 font-bold uppercase tracking-wider pl-1">{errors.description.message}</p>}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* 2. Items Section */}
                  {activeTab === "items" && (
                    <motion.div
                      key="items"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                    >
                      <Controller
                        control={control}
                        name="items"
                        render={({ field }) => (
                          <RequestItemGrid 
                            items={field.value} 
                            onChange={field.onChange}
                            currency={watch("currency")}
                            freightAmount={watch("freightAmount")}
                            onFreightChange={(val) => setValue("freightAmount", val)}
                          />
                        )}
                      />
                      {errors.items && <p className="text-[10px] text-rose-500 mt-4 font-bold uppercase tracking-wider pl-1">{errors.items.message}</p>}
                    </motion.div>
                  )}

                  {/* 3. Uploads & Approvals Section */}
                  {activeTab === "approvals" && (
                    <motion.div
                      key="approvals"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-12"
                    >
                      {/* Documents */}
                      <DocumentUploadZone 
                        onUploadComplete={(files) => {
                          setValue("attachmentIds", files.map(f => f.id).filter(id => id !== undefined) as number[]);
                        }}
                      />

                      {/* Approval Departments */}
                      <div className="space-y-8">
                        <div>
                          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 transition-colors">
                            <ShieldCheck className="w-4 h-4 text-primary" />
                            Mandatory Approvers
                          </h3>
                          <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mt-1">System-Assigned Executives</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                            {["CEO Office", "Finance", "Director"].map((dept) => (
                              <div key={dept} className="bg-primary/10 px-4 py-3 rounded-xl border border-primary/30 text-primary text-xs font-bold text-center opacity-80 cursor-not-allowed transition-all">
                                {dept}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 transition-colors">
                            <ShieldCheck className="w-4 h-4 text-primary" />
                            Additional Approvals
                          </h3>
                          <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mt-1">Select departments required for secondary sign-off</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {departments.map((dept: any) => (
                            <label key={dept.id} className="group cursor-pointer">
                              <input 
                                type="checkbox" 
                                value={dept.name} 
                                {...register("additionalApprovers")} 
                                className="hidden peer" 
                              />
                              <div className="px-4 py-3 rounded-xl border border-border bg-secondary/50 text-xs font-bold text-muted-foreground transition-all peer-checked:bg-primary/10 peer-checked:text-primary peer-checked:border-primary/30 group-hover:border-primary/20 group-hover:text-foreground text-center">
                                {dept.name}
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </div>

            {/* Footer Actions */}
            <div className="p-10 border-t border-border bg-secondary/30 flex items-center justify-between transition-colors">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Calculated Budget</span>
                  <span className="text-xl font-serif font-bold text-foreground transition-colors">{watch("currency")} {(watch("totalEstimatedCost") + watch("freightAmount")).toLocaleString()}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-8 py-4 rounded-2xl text-sm font-bold text-muted-foreground hover:text-foreground transition-all"
                >
                  Close Draft
                </button>
                
                {activeTab !== "approvals" ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (activeTab === "general") setActiveTab("items");
                      else if (activeTab === "items") setActiveTab("approvals");
                    }}
                    className="flex items-center gap-3 bg-secondary hover:bg-secondary/80 text-foreground px-10 py-4 rounded-[1.25rem] text-sm font-bold border border-border transition-all font-serif hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Next Section
                    <ChevronRight className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    form="request-form"
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-4 bg-brand-primary text-white px-12 py-4 rounded-[1.25rem] text-sm font-bold shadow-[0_20px_40px_-10px_rgba(var(--brand-primary-rgb),0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale font-serif"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Finalizing...
                      </>
                    ) : (
                      <>
                        Initialize Workflow
                        <Sparkles className="w-5 h-5" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
