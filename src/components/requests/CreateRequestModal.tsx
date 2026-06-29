import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useForm, Controller, useWatch } from "react-hook-form";
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
  ShieldAlert,
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
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

const requestSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Requirement Overview must be at least 10 characters"),
  totalEstimatedCost: z.coerce.number().min(0),
  vendorId: z.any().refine(val => val !== "" && Number(val) > 0, "Please select a vendor"),
  purposeCategoryId: z.any().refine(val => val !== "" && Number(val) > 0, "Select Purpose Category"),
  purposeType: z.string().min(1, "Purpose Type missing"),
  subPurposeId: z.any().refine(val => val !== "" && Number(val) > 0, "Select Project"),
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
}).refine((data) => {
  if (data.paymentStructure === "IN_PARTS") {
    const totalPct = data.installments
      .filter(i => i.valueType === "PERCENTAGE")
      .reduce((sum, i) => sum + (i.amountValue || 0), 0);
    return totalPct <= 100;
  }
  return true;
}, {
  message: "Total milestone percentage cannot exceed 100%",
  path: ["installments"]
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
  const [initialFiles, setInitialFiles] = useState<any[]>([]);

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
      vendorId: "",
      purposeCategoryId: "",
      purposeType: "PROJECT",
      subPurposeId: "",
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

  const formItems = useWatch({ control, name: "items" }) || [];
  const formCategoryId = useWatch({ control, name: "purposeCategoryId" });
  const formSubPurposeId = useWatch({ control, name: "subPurposeId" });
  const paymentStructure = useWatch({ control, name: "paymentStructure" });
  const installments = useWatch({ control, name: "installments" }) || [];
  const totalEstimatedCost = useWatch({ control, name: "totalEstimatedCost" }) || 0;
  const vendorId = watch("vendorId");
  const freightAmount = useWatch({ control, name: "freightAmount" }) || 0;

  const selectedVendorCompliance = useMemo(() => {
    if (!vendorId || vendors.length === 0) return null;
    const v = vendors.find(vend => vend.id === Number(vendorId));
    return v ? { score: v.complianceScore, name: v.companyName } : null;
  }, [vendorId, vendors]);

  const isNonCompliant = selectedVendorCompliance && selectedVendorCompliance.score < 50;

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
          
          setInitialFiles(Array.isArray(reqData.attachments) ? reqData.attachments.map((a: any) => ({
            id: a.id,
            fileName: a.fileName,
            fileType: a.fileType,
            fileSize: a.fileSize,
            fileUrl: a.fileUrl
          })) : []);

          reset({
            title: reqData.title || "",
            description: reqData.description || "",
            totalEstimatedCost: reqData.totalEstimatedCost || 0,
            vendorId: reqData.vendorId?.toString() || "",
            purposeCategoryId: reqData.purposeCategoryId?.toString() || "",
            purposeType: reqData.purposeType || "PROJECT",
            subPurposeId: reqData.subPurposeId?.toString() || "",
            priority: reqData.priority || "medium",
            currency: reqData.currency || "QAR",
            freightAmount: reqData.freightAmount || 0,
            items: Array.isArray(reqData.items) ? reqData.items : [{ name: "", quantity: 1, estimatedCost: 0, description: "" }],
            additionalApprovers: Array.isArray(reqData.additionalApprovers) ? reqData.additionalApprovers : [],
            attachmentIds: Array.isArray(reqData.attachments) ? reqData.attachments.map((a: any) => a.id) : [],
            paymentStructure: reqData.paymentStructure || "POST_PROJECT",
            installments: Array.isArray(reqData.paymentInstallments) ? reqData.paymentInstallments.map((inst: any) => ({
              ...inst,
              dueDate: typeof inst.dueDate === 'string' 
                ? inst.dueDate.split('T')[0] 
                : new Date(inst.dueDate).toISOString().split('T')[0]
            })) : [],
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
          title: "",
          description: "",
          vendorId: "",
          purposeCategoryId: "",
          purposeType: "PROJECT",
          subPurposeId: "",
          priority: "medium",
          currency: "QAR",
          totalEstimatedCost: 0,
          freightAmount: 0,
          items: [{ name: "", quantity: 1, estimatedCost: 0, description: "" }],
          additionalApprovers: [],
          attachmentIds: [],
          paymentStructure: "POST_PROJECT",
          installments: [],
        });
        setInitialFiles([]);
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

  const handleAction = async (data: RequestFormValues, targetStatus: "draft" | "pending") => {
    setIsSubmitting(true);
    try {
      const finalizedData = { 
        ...data, 
        vendorId: Number(data.vendorId),
        purposeCategoryId: Number(data.purposeCategoryId),
        subPurposeId: Number(data.subPurposeId),
        purposeType: data.purposeType || "PROJECT",
        status: targetStatus
      };
      if (requestId) {
        await apiClient.requests.update(requestId, finalizedData);
        toast.success(targetStatus === "pending" ? "Purchase request submitted for approval" : "Draft updated successfully");
      } else {
        await apiClient.requests.create(finalizedData);
        toast.success(targetStatus === "pending" ? "Workflow initialized successfully" : "Draft saved successfully");
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
  const MANDATORY_DEPTS = ["CEO Office", "Finance", "Management"];
  const additionalDeptOptions = (Array.isArray(globalDepartments) ? globalDepartments : []).filter((d: any) => !MANDATORY_DEPTS.includes(d.name));

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
            className={`relative w-[95vw] md:max-w-5xl bg-card border rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] z-[101] transition-all duration-500 ${isOverBudget ? "border-rose-500/50 shadow-lg shadow-rose-500/10" : "border-border"}`}
          >
            {/* Header */}
            <div className={`p-6 border-b border-border flex items-center justify-between transition-colors ${isOverBudget ? "bg-rose-500/5" : "bg-card"}`}>
              <div className="flex items-center gap-6">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-2xl transition-all ${isOverBudget ? "bg-rose-500/20 shadow-rose-500/20" : "bg-primary/20 shadow-primary/20"}`}>
                  {isOverBudget ? <AlertCircle className="text-rose-500 w-8 h-8" /> : <Plus className="text-primary w-8 h-8" />}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground tracking-tight transition-colors">
                    {isOverBudget ? "Budget Variance Detected" : "Create Purchase Request"}
                  </h2>
                  <div className="flex items-center gap-3 mt-1.5">
                    <p className="text-xs text-muted-foreground">Internal Procurement Engine</p>
                    <div className={`w-1.5 h-1.5 rounded-full ${isOverBudget ? "bg-rose-500 animate-pulse" : "bg-primary/40"}`} />
                    <p className={`text-xs font-medium ${isOverBudget ? "text-rose-500" : "text-primary"}`}>
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
            <div className="flex px-6 gap-6 border-b border-border bg-card transition-colors shrink-0">
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
                    className={`py-4 text-sm font-medium flex items-center gap-3 transition-all relative ${
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
                onSubmit={handleSubmit((data) => handleAction(data, "pending"), (err) => {
                  if (Object.keys(err).length > 0) {
                    const firstError = Object.values(err)[0] as any;
                    toast.error(`Entry Error: ${firstError?.message || "Check all tabs for errors"}`);
                  }
                })}
                className="flex-1 flex flex-col min-h-0"
              >
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                  <AnimatePresence mode="wait">

                    {/* ── Tab 1: General Details ── */}
                    {activeTab === "general" && (
                      <motion.div key="general" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="md:col-span-2 space-y-3">
                          <label className="text-xs font-medium text-foreground mb-1 block">Request Title</label>
                          <div className="relative group">
                            <Layout className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors z-10" />
                            <Input
                              {...register("title")}
                              className={`pl-9 h-10 text-sm ${errors.title ? "border-rose-500 ring-1 ring-rose-500/20" : ""}`}
                              placeholder="e.g. Q3 Logistics Support & Fleet Hub..."
                            />
                            {errors.title && <p className="text-xs text-rose-500 mt-1 font-medium pl-1">{errors.title.message}</p>}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between pl-1">
                            <label className="text-xs font-medium text-foreground mb-1 block ">Vendor Partnership</label>
                            {selectedVendorCompliance && (
                              <span className={cn(
                                "text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md",
                                isNonCompliant ? "bg-rose-500/10 text-rose-500" : "bg-brand-secondary/10 text-brand-secondary"
                              )}>
                                Compliance: {selectedVendorCompliance.score}%
                              </span>
                            )}
                          </div>
                          <div className="relative group">
                            <Truck className={cn(
                              "absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors z-10",
                              isNonCompliant ? "text-rose-500" : "text-muted-foreground/30 group-focus-within:text-primary "
                            )} />
                            <Controller
                              name="vendorId"
                              control={control}
                              render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value?.toString()}>
                                  <SelectTrigger className={cn(
                                    "pl-9 h-10 text-sm transition-all",
                                    errors.vendorId ? "border-rose-500 ring-1 ring-rose-500/20" : "",
                                    isNonCompliant ? "border-rose-500/50 bg-rose-500/[0.02] text-rose-600" : ""
                                  )}>
                                    <SelectValue placeholder="Select active vendor..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {vendors.map((v) => (
                                      <SelectItem key={v.id} value={v.id.toString()}>
                                        <div className="flex items-center justify-between w-full gap-4">
                                          <span>{v.companyName}</span>
                                          <span className={cn(
                                            "text-[9px] font-bold px-1.5 py-0.5 rounded",
                                            v.complianceScore < 50 ? "bg-rose-500 text-white" : "bg-brand-secondary/20 text-brand-secondary"
                                          )}>
                                            {v.complianceScore}%
                                          </span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                            {errors.vendorId?.message && typeof errors.vendorId.message === 'string' && <p className="text-xs text-rose-500 mt-1 font-medium pl-1">{errors.vendorId.message}</p>}
                          </div>
                          
                          {/* Compliance Hard Stop Banner */}
                          <AnimatePresence>
                            {isNonCompliant && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 mt-2">
                                  <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                                  <div>
                                    <p className="text-sm font-semibold text-rose-600">Regulatory Risk</p>
                                    <p className="text-xs text-rose-600/90 mt-1 leading-relaxed font-medium">
                                      {selectedVendorCompliance?.name} is in **Critical Non-Compliance**. 
                                      Institutional policy blocks procurement until required legal documentation (CR, Tax, etc.) 

                                      is updated in the Compliance Gateway.
                                    </p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className="space-y-3">
                          <label className="text-xs font-medium text-foreground mb-1 block">Purpose Category</label>
                          <div className="relative group">
                            <FolderTree className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30 group-focus-within:text-primary transition-colors z-10" />
                            <Controller
                              name="purposeCategoryId"
                              control={control}
                              render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value?.toString()}>
                                  <SelectTrigger className={`pl-9 h-10 text-sm ${errors.purposeCategoryId ? "border-rose-500 ring-1 ring-rose-500/20" : ""}`}>
                                    <SelectValue placeholder="Select category..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {categories.map((c: any) => (
                                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                             {errors.purposeCategoryId?.message && typeof errors.purposeCategoryId.message === 'string' && <p className="text-xs text-rose-500 mt-1 font-medium pl-1">{errors.purposeCategoryId.message}</p>}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="text-xs font-medium text-foreground mb-1 block">Project/Asset Selection</label>
                          <div className="relative group">
                            <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors z-10" />
                            {isLoadingSubPurposes && (
                              <Loader2 className="absolute right-12 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin z-10" />
                            )}
                            <Controller
                              name="subPurposeId"
                              control={control}
                              render={({ field }) => (
                                <Select 
                                  onValueChange={field.onChange} 
                                  value={field.value?.toString()}
                                  disabled={isLoadingSubPurposes || !formCategoryId}
                                >
                                  <SelectTrigger className={`pl-9 h-10 text-sm font-medium ${errors.subPurposeId ? "border-rose-500 ring-1 ring-rose-500/20" : isOverBudget ? "border-rose-500/50 text-rose-500" : ""}`}>
                                    <SelectValue placeholder={!formCategoryId ? "Select a category first..." : isLoadingSubPurposes ? "Loading projects..." : subPurposes.length === 0 ? "No active projects found" : "Select Project Lifecycle..."} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {subPurposes.map((sp) => {
                                      const isFuture = sp.validFrom && new Date(sp.validFrom) > new Date();
                                      const startDate = sp.validFrom ? new Date(sp.validFrom).toLocaleDateString() : "";
                                      return (
                                        <SelectItem key={sp.id} value={sp.id.toString()} disabled={isFuture}>
                                          {sp.name}{isFuture ? ` (Starts on ${startDate})` : ""}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                            {errors.subPurposeId?.message && typeof errors.subPurposeId.message === 'string' && <p className="text-xs text-rose-500 mt-1 font-medium pl-1">{errors.subPurposeId.message}</p>}
                          </div>
                          {selectedBudget !== null && (
                            <p className={`text-[10px] font-black uppercase tracking-widest pl-1 mt-1 ${isOverBudget ? "text-rose-500" : "text-emerald-500"}`}>
                              {user?.department} Allocation: QAR {selectedBudget.toLocaleString()}
                            </p>
                          )}
                        </div>

                        <div className="space-y-3">
                          <label className="text-xs font-medium text-foreground mb-1 block">Priority</label>
                          <div className="relative group">
                            <AlertCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors z-10" />
                            <Controller
                              name="priority"
                              control={control}
                              render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger className={`pl-9 h-10 text-sm ${errors.priority ? "border-rose-500 ring-1 ring-rose-500/20" : ""}`}>
                                    <SelectValue placeholder="Priority" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="low">Low Priority</SelectItem>
                                    <SelectItem value="medium">Medium Priority</SelectItem>
                                    <SelectItem value="high" className="text-orange-500">High Priority</SelectItem>
                                    <SelectItem value="urgent" className="text-rose-500">Urgent Requirement</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="text-xs font-medium text-foreground mb-1 block">Currency</label>
                          <div className="relative group">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors z-10" />
                            <Controller
                              name="currency"
                              control={control}
                              render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger className="pl-9 h-10 text-sm">
                                    <SelectValue placeholder="Currency" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="QAR">QAR - Qatari Riyal</SelectItem>
                                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                                    <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                        </div>

                        <div className="md:col-span-2 space-y-3">
                          <label className="text-xs font-medium text-foreground mb-1 block">Requirement Overview</label>
                          <div className="relative group">
                            <AlignLeft className="absolute left-3 top-5 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors z-10" />
                            <Textarea
                              {...register("description")}
                              rows={4}
                              className={`pl-9 py-2.5 text-sm leading-relaxed ${errors.description ? "border-rose-500 ring-1 ring-rose-500/20" : ""}`}
                              placeholder="Detail the scope of work and reason for purchase..."
                            />
                            {errors.description && <p className="text-xs text-rose-500 mt-1 font-medium pl-1">{errors.description.message}</p>}
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
                            <p className="text-sm text-muted-foreground font-medium mt-0.5">How will this vendor be paid?</p>
                          </div>
                          <Controller
                            control={control}
                            name="paymentStructure"
                            render={({ field }) => (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                                      className={`p-4 rounded-xl border text-left transition-all flex flex-col gap-3 ${isActive ? "bg-primary/10 border-primary/40 shadow-sm" : "bg-secondary/40 border-border hover:border-primary/20 hover:bg-secondary/60"}`}
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
                        {paymentStructure === "IN_PARTS" ? (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-sm font-bold text-foreground">Payment Milestones</h3>
                                <p className="text-sm text-muted-foreground font-medium mt-0.5">Define each payment stage</p>
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
                              {installments.map((inst: any, idx) => {
                                const totalCostBase = totalEstimatedCost + freightAmount;
                                const calcAmt = inst.valueType === "PERCENTAGE"
                                  ? Math.round((inst.amountValue / 100) * totalCostBase)
                                  : Math.round(Number(inst.amountValue) || 0);
                                return (
                                  <motion.div key={idx} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-5 space-y-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                        <span className="text-xs font-semibold text-primary">{idx + 1}</span>
                                      </div>
                                      <input
                                        {...register(`installments.${idx}.installmentName`)}
                                        className="flex-1 bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all placeholder:text-muted-foreground/30"
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
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                                          max={inst.valueType === "PERCENTAGE" ? 100 : undefined}
                                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                          {...register(`installments.${idx}.amountValue`, { 
                                            valueAsNumber: true,
                                            max: inst.valueType === "PERCENTAGE" ? 100 : undefined
                                          })}
                                          className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-xs font-black text-right focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all"
                                        />
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between px-1">
                                      <span className="text-xs text-muted-foreground font-medium mb-1 block">Calculated Amount</span>
                                      <span className="text-sm font-semibold text-primary">QAR {calcAmt.toLocaleString()}</span>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>

                            {/* Reconciliation Bar */}
                            {installments.length > 0 && (() => {
                              const totalPct = installments.reduce((acc: number, curr: any) => acc + (curr.valueType === "PERCENTAGE" ? curr.amountValue : 0), 0);
                              const isBalanced = totalPct === 100;
                              const isOver = totalPct > 100;
                              return (
                                <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                                  isBalanced ? "bg-emerald-500/10 border-emerald-500/30" : 
                                  isOver ? "bg-rose-500/10 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]" : 
                                  "bg-secondary/50 border-border"
                                }`}>
                                  <div>
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${isOver ? "text-rose-500" : "text-muted-foreground"}`}>
                                      {isOver ? "Allocation Error" : "Percentage Allocated"}
                                    </p>
                                    <p className={`text-sm font-bold mt-0.5 ${
                                      isBalanced ? "text-emerald-600" : 
                                      isOver ? "text-rose-600" : 
                                      "text-foreground"
                                    }`}>
                                      {isBalanced ? "✓ Fully reconciled — ready to submit" : 
                                       isOver ? `Exceeded limit by ${totalPct - 100}%` :
                                       `${100 - totalPct}% remaining to allocate`}
                                    </p>
                                  </div>
                                  <div className={`text-3xl font-black font-mono ${
                                    isBalanced ? "text-emerald-500" : 
                                    isOver ? "text-rose-500 animate-pulse" : 
                                    "text-primary"
                                  }`}>{totalPct}%</div>
                                </div>
                              );
                            })()}
                            {errors.installments?.root?.message && (
                              <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider pl-1">{errors.installments.root.message}</p>
                            )}
                          </div>
                        ) : (
                          /* Info card for ADVANCE / POST_PROJECT */
                          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="p-6 rounded-xl bg-card border-border border border-border flex flex-col items-center text-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-card flex items-center justify-center border border-border shadow-md">
                              <ShieldCheck className="w-8 h-8 text-primary" />
                            </div>
                            <div className="max-w-sm space-y-1">
                              <h4 className="text-sm font-bold text-foreground">
                                {paymentStructure === "ADVANCE" ? "100% Upfront Settlement" : "Final Delivery Settlement"}
                              </h4>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {paymentStructure === "ADVANCE"
                                  ? "Full payment will be processed immediately upon internal approval."
                                  : "Payment is deferred until the final project handover and verification of all deliverables."}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 rounded-full border border-primary/20">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                              <span className="text-xs font-medium text-primary">Finance-Verified Structure</span>
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    )}

                    {/* ── Tab 4: Files & Approvals ── */}
                    {activeTab === "approvals" && (
                      <motion.div key="approvals" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-12">
                        <DocumentUploadZone
                          initialFiles={initialFiles}
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
                            <p className="text-xs text-muted-foreground mt-1">System-Assigned Executives</p>
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
                              <p className="text-xs text-muted-foreground mt-1">Select departments required for secondary sign-off</p>
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
                <div className={`p-6 border-t transition-colors flex items-center justify-between ${isOverBudget ? "bg-rose-500/10 border-rose-500/20" : "bg-secondary/30 border-border"}`}>
                  <div className="flex items-center gap-8">
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground font-medium">Total Estimated Exposure</span>
                      <span className={`text-lg font-semibold transition-colors ${isOverBudget ? "text-rose-500" : "text-foreground"}`}>
                        {watch("currency")} {(watch("totalEstimatedCost") + watch("freightAmount")).toLocaleString()}
                      </span>
                    </div>

                    {selectedBudget !== null && (
                      <div className="flex items-center gap-4 pl-8 border-l border-border/50">
                        <div className={`p-3 rounded-2xl ${isOverBudget ? "bg-rose-500 text-white shadow-xl shadow-rose-500/20" : "bg-emerald-500 text-white shadow-xl shadow-emerald-500/20"}`}>
                          {isOverBudget ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground font-medium block">Dept Allocation</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold ${isOverBudget ? "text-rose-500" : "text-emerald-500"}`}>
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
                    <Button 
                      variant="ghost" 
                      size="lg"
                      type="button" 
                      onClick={onClose} 
                      className="px-8 font-bold text-muted-foreground"
                    >
                      Discard
                    </Button>

                    <div className="flex items-center gap-3 h-full">
                      {/* Save Draft Action - Visible on final tab or if editing existing */}
                      {(activeTab === "approvals" || requestId) && (
                        <Button
                          variant="secondary"
                          size="lg"
                          type="button"
                          disabled={isSubmitting}
                          onClick={handleSubmit((data) => handleAction(data, "draft"))}
                          className="flex items-center gap-3 px-6 rounded-lg font-bold bg-secondary/50 border border-border hover:bg-secondary transition-all"
                        >
                          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                          Save Draft
                        </Button>
                      )}

                      {activeTab !== "approvals" ? (
                        <Button
                          variant={isOverBudget ? "outline" : "secondary"}
                          size="lg"
                          type="button"
                          onClick={() => {
                            if (activeTab === "general") setActiveTab("items");
                            else if (activeTab === "items") setActiveTab("payments");
                            else if (activeTab === "payments") setActiveTab("approvals");
                          }}
                          className={`flex items-center gap-3 px-10 rounded-lg font-medium ${isOverBudget ? "border-rose-500/30 text-rose-500 hover:bg-rose-500/10" : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"}`}
                        >
                          Next Section
                          <ChevronRight className={`w-5 h-5 ${isOverBudget ? "text-rose-500" : ""}`} />
                        </Button>
                      ) : (
                        <Button
                          disabled={isSubmitting || !!isNonCompliant}
                          size="lg"
                          onClick={handleSubmit((data) => handleAction(data, "pending"))}
                          className={cn(
                            "flex items-center gap-4 px-8 rounded-lg shadow-sm font-serif font-bold transition-all",
                            isNonCompliant 
                              ? "bg-rose-500 hover:bg-rose-600 grayscale opacity-50 cursor-not-allowed text-white shadow-rose-500/20" 
                              : isOverBudget 
                                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/30" 
                                : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/30"
                          )}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Processing...
                            </>
                          ) : isNonCompliant ? (
                            <>
                              Access Denied
                              <ShieldAlert className="w-5 h-5" />
                            </>
                          ) : (
                            <>
                              {isOverBudget ? "Override & Submit" : "Submit Request"}
                              <Sparkles className="w-5 h-5" />
                            </>
                          )}
                        </Button>
                      )}
                    </div>
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
