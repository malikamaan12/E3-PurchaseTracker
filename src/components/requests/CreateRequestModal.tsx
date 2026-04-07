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
  Layers,
  ShieldCheck,
  ChevronRight,
  ClipboardList,
  Sparkles,
  Zap,
  Calculator,
  FolderTree,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import RequestItemGrid, { RequestItem } from "./RequestItemGrid";
import DocumentUploadZone from "../shared/DocumentUploadZone";

const requestSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Requirement Overview must be at least 10 characters"),
  totalEstimatedCost: z.coerce.number().min(0),
  vendorId: z.coerce.number().positive("Please select a vendor"),
  purposeCategoryId: z.coerce.number().positive("Select Purpose Category"),
  purposeType: z.string().min(1, "Purpose Type missing"),
  subPurposeId: z.coerce.number().positive("Select Project"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  currency: z.enum(["QAR", "USD", "EUR", "AED"]).default("QAR"),
  freightAmount: z.coerce.number().min(0).default(0),
  items: z.array(z.object({
    name: z.string().min(1, "Item name required"),
    quantity: z.number().positive(),
    estimatedCost: z.number().min(0),
    description: z.string().optional(),
  })).min(1, "At least one item is required"),
  additionalApprovers: z.array(z.string()).default([]),
  attachmentIds: z.array(z.number()).default([]),
  paymentStructure: z.enum(["ADVANCE", "IN_PARTS", "POST_PROJECT"]).default("POST_PROJECT"),
  installments: z.array(z.object({
    installmentName: z.string().min(1, "Name required"),
    dueDate: z.string().min(1, "Date required"),
    valueType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
    amountValue: z.number().min(0, "Value must be positive"),
    calculatedAmount: z.number().min(0),
  })).default([]),
});

type RequestFormValues = z.infer<typeof requestSchema>;

interface CreateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  requestId?: number;
}

export default function CreateRequestModal({ isOpen, onClose, onSuccess, requestId }: CreateRequestModalProps) {
  const { user } = useAuth();
  const { data: globalDepartments = [] } = useQuery({
    queryKey: ["departments-public"],
    queryFn: () => apiClient.departments.list(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["active-purpose-categories"],
    queryFn: () => apiClient.purposes.list(),
    enabled: isOpen,
  });

  const [vendors, setVendors] = useState<any[]>([]);
  const [subPurposes, setSubPurposes] = useState<any[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<number | null>(null);
  const [isLoadingSubPurposes, setIsLoadingSubPurposes] = useState(false);
  const [isLoadingVendors, setIsLoadingVendors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "items" | "payments" | "approvals">("general");

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    shouldUnregister: false,
    defaultValues: {
      title: "",
      description: "",
      vendorId: undefined,
      purposeCategoryId: undefined,
      subPurposeId: undefined,
      purposeType: "PROJECT",
      priority: "medium",
      currency: "QAR",
      totalEstimatedCost: 0,
      freightAmount: 0,
      items: [{ name: "", quantity: 1, estimatedCost: 0, description: "" }],
      additionalApprovers: [],
      attachmentIds: [],
      paymentStructure: "POST_PROJECT",
      installments: [],
    },
  });

  const formItems = watch("items");
  const formCategoryId = watch("purposeCategoryId");
  const formSubPurposeId = watch("subPurposeId");

  const totals = useMemo(() => {
    return formItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.estimatedCost || 0)), 0);
  }, [formItems]);

  useEffect(() => {
    setValue("totalEstimatedCost", totals);
  }, [totals, setValue]);

  useEffect(() => {
    async function loadRequestData() {
      if (isOpen && requestId) {
        setIsSubmitting(true);
        try {
          const reqData = await apiClient.requests.get(requestId);
          reset({
            title: reqData.title || "",
            description: reqData.description || "",
            totalEstimatedCost: reqData.totalEstimatedCost || 0,
            vendorId: reqData.vendorId || undefined,
            purposeCategoryId: reqData.purposeCategoryId || undefined,
            purposeType: reqData.purposeType || "PROJECT",
            subPurposeId: reqData.subPurposeId || undefined,
            priority: reqData.priority || "medium",
            currency: reqData.currency || "QAR",
            freightAmount: reqData.freightAmount || 0,
            items: reqData.items || [{ name: "", quantity: 1, estimatedCost: 0, description: "" }],
            additionalApprovers: reqData.additionalApprovers || [],
            attachmentIds: reqData.attachments?.map((a: any) => a.id) || [],
            paymentStructure: reqData.paymentStructure || "POST_PROJECT",
            installments: reqData.installments || [],
          });
          if (reqData.subPurposeId) {
            const subs = await apiClient.requests.subPurposes.list();
            setSubPurposes(subs);
          }
        } catch {
          toast.error("Failed to load request for editing.");
        } finally {
          setIsSubmitting(false);
        }
      } else if (isOpen && !requestId) {
        reset({
          items: [{ name: "", quantity: 1, estimatedCost: 0, description: "" }],
          additionalApprovers: [],
          attachmentIds: [],
          paymentStructure: "POST_PROJECT",
          installments: [],
          title: "",
          description: "",
        });
      }
    }
    if (isOpen) fetchVendors();
    loadRequestData();
  }, [isOpen, requestId, reset]);

  useEffect(() => {
    if (formCategoryId && categories.length > 0) {
      const category = categories.find((c: any) => c.id === Number(formCategoryId));
      if (category) setValue("purposeType", category.classificationType || "PROJECT");
    }
  }, [formCategoryId, categories, setValue]);

  useEffect(() => {
    if (isOpen && formCategoryId) {
      fetchSubPurposes(Number(formCategoryId));
    } else if (isOpen && !formCategoryId) {
      setSubPurposes([]);
    }
  }, [isOpen, formCategoryId]);

  useEffect(() => {
    if (formSubPurposeId && subPurposes.length > 0) {
      const project = subPurposes.find((p) => p.id === Number(formSubPurposeId));
      setSelectedBudget(project?.allocatedAmount ?? 0);
    } else {
      setSelectedBudget(null);
    }
  }, [formSubPurposeId, subPurposes]);

  const fetchSubPurposes = async (categoryId: number) => {
    setIsLoadingSubPurposes(true);
    try {
      const data = await apiClient.requests.subPurposes.list({ purposeCategoryId: categoryId });
      setSubPurposes(data);
    } catch {
      console.error("Failed to load sub-purposes");
    } finally {
      setIsLoadingSubPurposes(false);
    }
  };

  const fetchVendors = async () => {
    setIsLoadingVendors(true);
    try {
      const data = await apiClient.vendors.list();
      setVendors(data);
    } catch {
      toast.error("Failed to load vendors");
    } finally {
      setIsLoadingVendors(false);
    }
  };

  const isOverBudget = selectedBudget !== null && totals > selectedBudget;

  const isTabInvalid = (tab: "general" | "items" | "payments" | "approvals") => {
    if (Object.keys(errors).length === 0) return false;
    const generalFields = ["title", "description", "vendorId", "purposeCategoryId", "subPurposeId", "priority", "currency"];
    if (tab === "general") return generalFields.some((f) => errors[f as keyof RequestFormValues]);
    if (tab === "items") return !!errors.items;
    if (tab === "payments") return !!errors.installments;
    if (tab === "approvals") return !!errors.attachmentIds || !!errors.additionalApprovers;
    return false;
  };

  const onSubmit = async (data: RequestFormValues) => {
    setIsSubmitting(true);
    try {
      const finalizedData = { 
        ...data, 
        purposeType: data.purposeType || "PROJECT",
        status: "pending" // Explicitly mark as active to prevent auto-drafting
      };
      if (requestId) {
        await apiClient.requests.update(requestId, finalizedData);
        toast.success("Purchase request updated successfully");
      } else {
        await apiClient.requests.create(finalizedData);
        toast.success("Purchase request initialized successfully");
      }
      reset();
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to process request");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mandatory depts — excluded from additional approvers list
  const MANDATORY_DEPTS = ["CEO Office", "Finance", "General Manager"];
  const additionalDeptOptions = globalDepartments.filter((d: any) => !MANDATORY_DEPTS.includes(d.name));

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
            className={`relative w-full max-w-5xl bg-card border rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh] z-[101] transition-all duration-500 ${isOverBudget ? "border-rose-500/50 shadow-[0_0_50px_rgba(244,63,94,0.2)]" : "border-border"}`}
          >
            {/* Header */}
            <div className={`p-10 border-b border-border flex items-center justify-between transition-colors ${isOverBudget ? "bg-rose-500/5" : "bg-gradient-to-br from-primary/10 via-card to-card"}`}>
              <div className="flex items-center gap-6">
                <div className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center shadow-2xl transition-all ${isOverBudget ? "bg-rose-500/20 shadow-rose-500/20" : "bg-primary/20 shadow-primary/20"}`}>
                  {isOverBudget ? <AlertCircle className="text-rose-500 w-8 h-8" /> : <Plus className="text-primary w-8 h-8" />}
                </div>
                <div>
                  <h2 className="text-3xl font-serif font-bold text-foreground tracking-tight transition-colors">
                    {isOverBudget ? "Budget Variance Detected" : "Create Purchase Request"}
                  </h2>
                  <div className="flex items-center gap-3 mt-1.5">
                    <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">Internal Procurement Engine</p>
                    <div className={`w-1.5 h-1.5 rounded-full ${isOverBudget ? "bg-rose-500 animate-pulse" : "bg-primary/40"}`} />
                    <p className={`text-[10px] font-bold tracking-widest uppercase ${isOverBudget ? "text-rose-500" : "text-primary"}`}>
                      {isOverBudget ? "Finance Review Required" : "Draft Mode"}
                    </p>
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
            <div className="flex px-10 gap-8 border-b border-border bg-secondary/20 transition-colors shrink-0">
              {(["general", "items", "payments", "approvals"] as const).map((tabId) => {
                const tabMeta = {
                  general: { label: "Details", icon: <Layout className="w-4 h-4" /> },
                  items: { label: "Items", icon: <ClipboardList className="w-4 h-4" /> },
                  payments: { label: "Payment", icon: <DollarSign className="w-4 h-4" /> },
                  approvals: { label: "Files", icon: <ShieldCheck className="w-4 h-4" /> },
                }[tabId];
                const isInvalid = isTabInvalid(tabId);
                return (
                  <button
                    key={tabId}
                    type="button"
                    onClick={() => setActiveTab(tabId)}
                    className={`py-6 text-xs font-bold uppercase tracking-widest flex items-center gap-3 transition-all relative ${
                      activeTab === tabId
                        ? isInvalid ? "text-rose-500" : "text-primary"
                        : isInvalid ? "text-rose-400/80" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isInvalid ? <AlertCircle className="w-4 h-4 animate-pulse" /> : tabMeta.icon}
                    {tabMeta.label}
                    {isInvalid && <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-4 right-0" />}
                    {activeTab === tabId && (
                      <motion.div
                        layoutId="tab-underline"
                        className={`absolute bottom-0 left-0 right-0 h-1 rounded-t-full shadow-lg ${isInvalid ? "bg-rose-500 shadow-rose-500/50" : "bg-primary shadow-primary/50"}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Form */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <form
                id="request-form"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
                    e.preventDefault();
                  }
                }}
                onSubmit={handleSubmit(onSubmit, (err) => {
                  if (Object.keys(err).length > 0) {
                    const firstError = Object.values(err)[0] as any;
                    toast.error(`Entry Error: ${firstError?.message || "Check all tabs for errors"}`);
                  }
                })}
                className="flex-1 flex flex-col min-h-0"
              >
                <div className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-10">
                  <AnimatePresence mode="wait">

                    {/* ── Tab 1: General Details ── */}
                    {activeTab === "general" && (
                      <motion.div key="general" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="grid grid-cols-2 gap-8">
                        <div className="col-span-2 space-y-3">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Request Title</label>
                          <div className="relative group">
                            <Layout className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                            <input
                              {...register("title")}
                              className={`w-full bg-secondary/50 border rounded-2xl px-14 py-4 text-sm text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-secondary transition-all font-semibold ${errors.title ? "border-rose-500 ring-1 ring-rose-500/20" : "border-border"}`}
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
                              className={`w-full bg-secondary/50 border rounded-2xl px-14 py-4 text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-secondary transition-all font-semibold ${errors.vendorId ? "border-rose-500 ring-1 ring-rose-500/20" : "border-border"}`}
                            >
                              <option value="" disabled className="bg-card">Select active vendor...</option>
                              {vendors.map((v) => <option key={v.id} value={v.id} className="bg-card">{v.companyName}</option>)}
                            </select>
                            {errors.vendorId && <p className="text-[10px] text-rose-500 mt-2 font-bold uppercase tracking-wider pl-1">{errors.vendorId.message}</p>}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Purpose Category</label>
                          <div className="relative group">
                            <FolderTree className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                            <select
                              {...register("purposeCategoryId")}
                              className={`w-full bg-secondary/50 border rounded-2xl px-14 py-4 text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-secondary transition-all font-semibold ${errors.purposeCategoryId ? "border-rose-500 ring-1 ring-rose-500/20" : "border-border"}`}
                            >
                              <option value="" disabled className="bg-card text-muted-foreground/50">Select category...</option>
                              {categories.map((c: any) => <option key={c.id} value={c.id} className="bg-card">{c.name}</option>)}
                            </select>
                            {errors.purposeCategoryId && <p className="text-[10px] text-rose-500 mt-2 font-bold uppercase tracking-wider pl-1">{errors.purposeCategoryId.message}</p>}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Project/Asset Selection</label>
                          <div className="relative group">
                            <Layers className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                            {isLoadingSubPurposes && (
                              <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
                            )}
                            <select
                              {...register("subPurposeId")}
                              disabled={isLoadingSubPurposes}
                              className={`w-full bg-secondary/50 border rounded-2xl px-14 py-4 text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-secondary transition-all font-bold disabled:opacity-40 disabled:cursor-not-allowed ${errors.subPurposeId ? "border-rose-500 ring-1 ring-rose-500/20" : isOverBudget ? "border-rose-500/50 text-rose-500" : "border-border"}`}
                            >
                              {!formCategoryId ? (
                                <option value="" className="bg-card text-muted-foreground">Select a category first...</option>
                              ) : isLoadingSubPurposes ? (
                                <option value="" className="bg-card">Loading projects...</option>
                              ) : subPurposes.length === 0 ? (
                                <option value="" className="bg-card text-muted-foreground">No active projects found</option>
                              ) : (
                                <option value="" className="bg-card">Select Project Lifecycle...</option>
                              )}
                              {subPurposes.map((sp) => {
                                const isFuture = sp.validFrom && new Date(sp.validFrom) > new Date();
                                const startDate = sp.validFrom ? new Date(sp.validFrom).toLocaleDateString() : "";
                                return (
                                  <option key={sp.id} value={sp.id} className="bg-card" disabled={isFuture}>
                                    {sp.name}{isFuture ? ` (Starts on ${startDate})` : ""}
                                  </option>
                                );
                              })}
                            </select>
                            {errors.subPurposeId && <p className="text-[10px] text-rose-500 mt-2 font-bold uppercase tracking-wider pl-1">{errors.subPurposeId.message}</p>}
                          </div>
                          {selectedBudget !== null && (
                            <p className={`text-[10px] font-black uppercase tracking-widest pl-1 mt-1 ${isOverBudget ? "text-rose-500" : "text-emerald-500"}`}>
                              {user?.department} Allocation: QAR {selectedBudget.toLocaleString()}
                            </p>
                          )}
                        </div>

                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Priority</label>
                          <div className="relative group">
                            <AlertCircle className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                            <select
                              {...register("priority")}
                              className={`w-full bg-secondary/50 border rounded-2xl px-14 py-4 text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-secondary transition-all font-semibold ${errors.priority ? "border-rose-500 ring-1 ring-rose-500/20" : "border-border"}`}
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
                              className={`w-full bg-secondary/50 border rounded-2xl px-14 py-5 text-sm text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-secondary transition-all resize-none font-medium leading-relaxed ${errors.description ? "border-rose-500 ring-1 ring-rose-500/20" : "border-border"}`}
                              placeholder="Detail the scope of work and reason for purchase..."
                            />
                            {errors.description && <p className="text-[10px] text-rose-500 mt-2 font-bold uppercase tracking-wider pl-1">{errors.description.message}</p>}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* ── Tab 2: Items ── */}
                    {activeTab === "items" && (
                      <motion.div key="items" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                        <Controller
                          control={control}
                          name="items"
                          render={({ field }) => (
                            <RequestItemGrid
                              items={field.value}
                              errors={errors.items}
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

                    {/* ── Tab 3: Payment ── */}
                    {activeTab === "payments" && (
                      <motion.div key="payments" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-8">
                        {/* Payment Structure Card Picker */}
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-sm font-bold text-foreground">Payment Structure</h3>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">How will this vendor be paid?</p>
                          </div>
                          <Controller
                            control={control}
                            name="paymentStructure"
                            render={({ field }) => (
                              <div className="grid grid-cols-3 gap-3">
                                {[
                                  { value: "ADVANCE", label: "Full Advance", sub: "100% upfront upon approval", icon: <Zap className="w-5 h-5" /> },
                                  { value: "IN_PARTS", label: "In Milestones", sub: "Split into payment stages", icon: <Calculator className="w-5 h-5" /> },
                                  { value: "POST_PROJECT", label: "Post-Delivery", sub: "Pay on final handover", icon: <ShieldCheck className="w-5 h-5" /> },
                                ].map((opt) => {
                                  const isActive = field.value === opt.value;
                                  return (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={() => field.onChange(opt.value)}
                                      className={`p-5 rounded-2xl border text-left transition-all flex flex-col gap-3 ${isActive ? "bg-primary/10 border-primary/40 shadow-sm" : "bg-secondary/40 border-border hover:border-primary/20 hover:bg-secondary/60"}`}
                                    >
                                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                                        {opt.icon}
                                      </div>
                                      <div>
                                        <p className={`text-xs font-bold ${isActive ? "text-primary" : "text-foreground"}`}>{opt.label}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{opt.sub}</p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          />
                        </div>

                        {/* Milestone Builder (IN_PARTS only) */}
                        {watch("paymentStructure") === "IN_PARTS" ? (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-sm font-bold text-foreground">Payment Milestones</h3>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Define each payment stage</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const current = watch("installments");
                                  setValue("installments", [
                                    ...current,
                                    { installmentName: "", dueDate: new Date().toISOString().split("T")[0], valueType: "PERCENTAGE", amountValue: 0, calculatedAmount: 0 },
                                  ]);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded-xl text-primary text-[10px] font-black uppercase tracking-wider hover:bg-primary/20 transition-all"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add Milestone
                              </button>
                            </div>

                            {watch("installments").length === 0 && (
                              <div className="py-10 border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center gap-3 text-center">
                                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center border border-border">
                                  <Plus className="w-5 h-5 text-muted-foreground/50" />
                                </div>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No milestones yet</p>
                                <p className="text-[10px] text-muted-foreground/60">Click "Add Milestone" to define payment stages</p>
                              </div>
                            )}

                            <div className="space-y-3">
                              {watch("installments").map((inst, idx) => {
                                const totalCostBase = watch("totalEstimatedCost") + watch("freightAmount");
                                const calcAmt = inst.valueType === "PERCENTAGE"
                                  ? Math.round((inst.amountValue / 100) * totalCostBase)
                                  : Math.round(Number(inst.amountValue) || 0);
                                return (
                                  <motion.div key={idx} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-5 space-y-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                        <span className="text-[10px] font-black text-primary">{idx + 1}</span>
                                      </div>
                                      <input
                                        {...register(`installments.${idx}.installmentName`)}
                                        className="flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all placeholder:text-muted-foreground/30"
                                        placeholder="e.g. Initial Mobilization Payment"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setValue("installments", watch("installments").filter((_, i) => i !== idx));
                                        }}
                                        className="p-2 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">Due Date</label>
                                        <input
                                          type="date"
                                          {...register(`installments.${idx}.dueDate`)}
                                          className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all"
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">Type</label>
                                        <select
                                          {...register(`installments.${idx}.valueType`)}
                                          className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-xs font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all cursor-pointer"
                                        >
                                          <option value="PERCENTAGE">% Percentage</option>
                                          <option value="FIXED_AMOUNT">QAR Fixed</option>
                                        </select>
                                      </div>
                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">
                                          {inst.valueType === "PERCENTAGE" ? "Percentage (%)" : "Amount (QAR)"}
                                        </label>
                                        <input
                                          type="number"
                                          min={0}
                                          {...register(`installments.${idx}.amountValue`, { valueAsNumber: true })}
                                          className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-xs font-black text-right focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all"
                                        />
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between px-1">
                                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Calculated Amount</span>
                                      <span className="text-sm font-black text-primary font-mono">QAR {calcAmt.toLocaleString()}</span>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>

                            {/* Reconciliation Bar */}
                            {watch("installments").length > 0 && (() => {
                              const totalPct = watch("installments").reduce((acc, curr) => acc + (curr.valueType === "PERCENTAGE" ? curr.amountValue : 0), 0);
                              const isBalanced = totalPct === 100;
                              return (
                                <div className={`p-5 rounded-2xl border flex items-center justify-between transition-all ${isBalanced ? "bg-emerald-500/10 border-emerald-500/30" : "bg-secondary/50 border-border"}`}>
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Percentage Allocated</p>
                                    <p className={`text-sm font-bold mt-0.5 ${isBalanced ? "text-emerald-600" : "text-foreground"}`}>
                                      {isBalanced ? "✓ Fully reconciled — ready to submit" : `${100 - totalPct}% remaining to allocate`}
                                    </p>
                                  </div>
                                  <div className={`text-3xl font-black font-mono ${isBalanced ? "text-emerald-500" : "text-primary"}`}>{totalPct}%</div>
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          /* Info card for ADVANCE / POST_PROJECT */
                          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="p-8 rounded-2xl bg-secondary/40 border border-border flex flex-col items-center text-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-card flex items-center justify-center border border-border shadow-md">
                              <ShieldCheck className="w-8 h-8 text-primary" />
                            </div>
                            <div className="max-w-sm space-y-1">
                              <h4 className="text-sm font-bold text-foreground">
                                {watch("paymentStructure") === "ADVANCE" ? "100% Upfront Settlement" : "Final Delivery Settlement"}
                              </h4>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {watch("paymentStructure") === "ADVANCE"
                                  ? "Full payment will be processed immediately upon internal approval."
                                  : "Payment is deferred until the final project handover and verification of all deliverables."}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 rounded-full border border-primary/20">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Finance-Verified Structure</span>
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    )}

                    {/* ── Tab 4: Files & Approvals ── */}
                    {activeTab === "approvals" && (
                      <motion.div key="approvals" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-12">
                        <DocumentUploadZone
                          onUploadComplete={(files) => {
                            setValue("attachmentIds", files.map((f) => f.id).filter((id) => id !== undefined) as number[]);
                          }}
                        />

                        <div className="space-y-8">
                          {/* Mandatory (read-only) */}
                          <div>
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                              <ShieldCheck className="w-4 h-4 text-primary" />
                              Mandatory Approvers
                            </h3>
                            <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mt-1">System-Assigned Executives</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                              {MANDATORY_DEPTS.map((dept) => (
                                <div key={dept} className="bg-primary/10 px-4 py-3 rounded-xl border border-primary/30 text-primary text-xs font-bold text-center opacity-80 cursor-not-allowed">
                                  {dept}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Additional Approvers */}
                          <div className="space-y-4">
                            <div>
                              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-primary" />
                                Additional Approvals
                              </h3>
                              <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mt-1">Select departments required for secondary sign-off</p>
                            </div>
                            {additionalDeptOptions.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic">No additional departments available.</p>
                            ) : (
                              <Controller
                                control={control}
                                name="additionalApprovers"
                                render={({ field }) => (
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {additionalDeptOptions.map((dept: any) => {
                                      const isSelected = (field.value || []).includes(dept.name);
                                      return (
                                        <button
                                          key={dept.id}
                                          type="button"
                                          onClick={() => {
                                            const current = field.value || [];
                                            const next = isSelected
                                              ? current.filter((v: string) => v !== dept.name)
                                              : [...current, dept.name];
                                            field.onChange(next);
                                          }}
                                          className={`px-4 py-3 rounded-xl border text-xs font-bold text-center transition-all ${
                                            isSelected
                                              ? "bg-primary/10 text-primary border-primary/30 shadow-sm"
                                              : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/20 hover:text-foreground"
                                          }`}
                                        >
                                          {dept.name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}

                  </AnimatePresence>
                </div>

                {/* Footer */}
                <div className={`p-10 border-t transition-colors flex items-center justify-between ${isOverBudget ? "bg-rose-500/10 border-rose-500/20" : "bg-secondary/30 border-border"}`}>
                  <div className="flex items-center gap-8">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Total Estimated Exposure</span>
                      <span className={`text-2xl font-serif font-black transition-colors ${isOverBudget ? "text-rose-500" : "text-foreground"}`}>
                        {watch("currency")} {(watch("totalEstimatedCost") + watch("freightAmount")).toLocaleString()}
                      </span>
                    </div>

                    {selectedBudget !== null && (
                      <div className="flex items-center gap-4 pl-8 border-l border-border/50">
                        <div className={`p-3 rounded-2xl ${isOverBudget ? "bg-rose-500 text-white shadow-xl shadow-rose-500/20" : "bg-emerald-500 text-white shadow-xl shadow-emerald-500/20"}`}>
                          {isOverBudget ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest block opacity-50">Dept Allocation</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-base font-black font-serif ${isOverBudget ? "text-rose-500" : "text-emerald-500"}`}>
                              {watch("currency")} {selectedBudget.toLocaleString()}
                            </span>
                            {isOverBudget && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500 text-white text-[8px] font-black uppercase tracking-tighter">
                                Flag for Finance
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <button type="button" onClick={onClose} className="px-8 py-4 rounded-2xl text-sm font-bold text-muted-foreground hover:text-foreground transition-all">
                      Close Draft
                    </button>

                    {activeTab !== "approvals" ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (activeTab === "general") setActiveTab("items");
                          else if (activeTab === "items") setActiveTab("payments");
                          else if (activeTab === "payments") setActiveTab("approvals");
                        }}
                        className={`flex items-center gap-3 px-10 py-4 rounded-[1.25rem] text-sm font-bold border transition-all font-serif hover:scale-[1.02] active:scale-[0.98] ${isOverBudget ? "bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/20" : "bg-secondary hover:bg-secondary/80 text-foreground border-border"}`}
                      >
                        Next Section
                        <ChevronRight className={`w-5 h-5 ${isOverBudget ? "text-rose-500" : "text-primary"}`} />
                      </button>
                    ) : (
                      <button
                        form="request-form"
                        type="submit"
                        disabled={isSubmitting}
                        className={`flex items-center gap-4 px-12 py-4 rounded-[1.25rem] text-sm font-bold shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale font-serif ${isOverBudget ? "bg-rose-500 text-white shadow-rose-500/30" : "bg-primary text-primary-foreground shadow-primary/30"}`}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Initializing...
                          </>
                        ) : (
                          <>
                            {isOverBudget ? "Override & Initialize" : "Initialize Workflow"}
                            <Sparkles className="w-5 h-5" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
