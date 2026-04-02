import { useState, useEffect } from "react";
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
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import RequestItemGrid, { RequestItem } from "./RequestItemGrid";
import DocumentUploadZone from "../shared/DocumentUploadZone";

const requestSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  totalEstimatedCost: z.coerce.number().min(0),
  vendorId: z.coerce.number().positive("Please select a vendor"),
  purposeType: z.enum(["E3 EVENT", "PROJECT", "MALL", "BUSINESS GROWTH", "General"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
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

const DEPARTMENTS = [
  "Finance", "Legal", "Operations", "Procurement", "IT", "Marketing", "HR", "Logistics"
];

export default function CreateRequestModal({ isOpen, onClose, onSuccess }: CreateRequestModalProps) {
  const [vendors, setVendors] = useState<any[]>([]);
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
      items: [{ name: "", quantity: 1, estimatedCost: 0, description: "" }],
      additionalApprovers: [],
      attachmentIds: []
    }
  });

  const formItems = watch("items");

  // Sync total cost when items change
  useEffect(() => {
    const total = formItems.reduce((sum, item) => sum + (item.quantity * item.estimatedCost), 0);
    setValue("totalEstimatedCost", total);
  }, [formItems, setValue]);

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
            className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            className="relative w-full max-w-5xl bg-zinc-900 border border-white/10 rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-10 border-b border-white/5 flex items-center justify-between bg-gradient-to-br from-brand-primary/10 via-zinc-900 to-zinc-900">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-[1.25rem] bg-brand-primary/20 flex items-center justify-center shadow-2xl shadow-brand-primary/20">
                  <Plus className="text-brand-primary w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-3xl font-serif font-bold text-white tracking-tight">Create Purchase Request</h2>
                  <div className="flex items-center gap-3 mt-1.5">
                    <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Internal Procurement Engine</p>
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-primary/40" />
                    <p className="text-[10px] text-brand-primary font-bold tracking-widest uppercase">Draft Mode</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-3 hover:bg-white/5 rounded-2xl text-zinc-500 hover:text-white transition-all border border-transparent hover:border-white/10"
              >
                <X className="w-7 h-7" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex px-10 gap-8 border-b border-white/5 bg-zinc-900/50">
              {[
                { id: "general", label: "General Details", icon: <Layout className="w-4 h-4" /> },
                { id: "items", label: "Itemized Budget", icon: <ClipboardList className="w-4 h-4" /> },
                { id: "approvals", label: "Uploads & Approvals", icon: <ShieldCheck className="w-4 h-4" /> }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-6 text-xs font-bold uppercase tracking-widest flex items-center gap-3 transition-all relative ${
                    activeTab === tab.id ? "text-brand-primary" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-brand-primary rounded-t-full shadow-[0_0_20px_rgba(var(--brand-primary-rgb),0.5)]" />
                  )}
                </button>
              ))}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
              <form id="request-form" onSubmit={handleSubmit(onSubmit)} className="space-y-10">
                
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
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Request Title</label>
                        <div className="relative group">
                          <Layout className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-brand-primary transition-colors" />
                          <input
                            {...register("title")}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-14 py-4 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:bg-white/10 transition-all font-semibold"
                            placeholder="e.g. Q3 Logistics Support & Fleet Hub..."
                          />
                          {errors.title && <p className="text-[10px] text-rose-500 mt-2 font-bold uppercase tracking-wider pl-1">{errors.title.message}</p>}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Vendor Partnership</label>
                        <div className="relative group">
                          <Truck className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-brand-primary transition-colors" />
                          <select
                            {...register("vendorId")}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-14 py-4 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:bg-white/10 transition-all font-semibold"
                          >
                            <option value="" disabled className="bg-zinc-900">Select active vendor...</option>
                            {vendors.map(v => (
                              <option key={v.id} value={v.id} className="bg-zinc-900">{v.companyName}</option>
                            ))}
                          </select>
                          {errors.vendorId && <p className="text-[10px] text-rose-500 mt-2 font-bold uppercase tracking-wider pl-1">{errors.vendorId.message}</p>}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Purpose Category</label>
                        <div className="relative group">
                          <Briefcase className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-brand-primary transition-colors" />
                          <select
                            {...register("purposeType")}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-14 py-4 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:bg-white/10 transition-all font-semibold"
                          >
                            <option value="General" className="bg-zinc-900">General Requirement</option>
                            <option value="E3 EVENT" className="bg-zinc-900">E3 EVENT</option>
                            <option value="PROJECT" className="bg-zinc-900">PROJECT</option>
                            <option value="MALL" className="bg-zinc-900">MALL</option>
                            <option value="BUSINESS GROWTH" className="bg-zinc-900">BUSINESS GROWTH</option>
                          </select>
                        </div>
                      </div>

                      <div className="col-span-2 space-y-3">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Requirement Overview</label>
                        <div className="relative group">
                          <AlignLeft className="absolute left-5 top-5 w-5 h-5 text-zinc-600 group-focus-within:text-brand-primary transition-colors" />
                          <textarea
                            {...register("description")}
                            rows={4}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-14 py-5 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:bg-white/10 transition-all resize-none font-medium leading-relaxed"
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
                          <RequestItemGrid items={field.value} onChange={field.onChange} />
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
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-brand-primary" />
                            Additional Approvals
                          </h3>
                          <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mt-1">Select departments required for secondary sign-off</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {DEPARTMENTS.map((dept) => (
                            <label key={dept} className="group cursor-pointer">
                              <input 
                                type="checkbox" 
                                value={dept} 
                                {...register("additionalApprovers")} 
                                className="hidden peer" 
                              />
                              <div className="glass px-4 py-3 rounded-xl border border-white/5 text-xs font-bold text-zinc-500 transition-all peer-checked:bg-brand-primary/10 peer-checked:text-brand-primary peer-checked:border-brand-primary/30 group-hover:border-white/10 group-hover:text-zinc-300 peer-checked:group-hover:text-brand-primary text-center">
                                {dept}
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
            <div className="p-10 border-t border-white/5 bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Calculated Budget</span>
                  <span className="text-xl font-serif font-bold text-white">QAR {watch("totalEstimatedCost").toLocaleString()}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-8 py-4 rounded-2xl text-sm font-bold text-zinc-500 hover:text-white transition-all"
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
                    className="flex items-center gap-3 bg-white/5 hover:bg-white/10 text-white px-10 py-4 rounded-[1.25rem] text-sm font-bold border border-white/10 transition-all font-serif hover:scale-[1.02] active:scale-[0.98]"
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
