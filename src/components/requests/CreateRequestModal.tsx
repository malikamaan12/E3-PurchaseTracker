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
  Coins,
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
  Building2,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { getExchangeRateToQAR } from "@/lib/utils/currency";
import RequestItemGrid, { RequestItem } from "./RequestItemGrid";
import DocumentUploadZone from "../shared/DocumentUploadZone";
import { VendorQuickCreateModal } from "@/components/vendors/VendorQuickCreateModal";
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
  department: z.string().optional(),
  totalEstimatedCost: z.coerce.number().min(0),
  vendorId: z.any().refine(val => val !== "" && Number(val) > 0, "Please select a vendor"),
  purposeCategoryId: z.any().refine(val => val !== "" && Number(val) > 0, "Select Purpose Category"),
  purposeType: z.string().min(1, "Purpose Type missing"),
  subPurposeId: z.any().refine(val => val !== "" && Number(val) > 0, "Select Project"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  currency: z.enum(["QAR", "USD", "EUR", "AED", "CNY"]).default("QAR"),
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
  message: "Cumulative milestone allocation cannot exceed 100%",
  path: ["installments"],
});

type RequestFormValues = z.infer<typeof requestSchema>;

interface CreateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  requestId?: number;
}

export default function CreateRequestModal({ isOpen, onClose, onSuccess, requestId }: CreateRequestModalProps) {
  const { user, departments: userDepartments = [], submissionDepartments = [], isSuperAdmin } = useAuth();
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
  const [exchangeRate, setExchangeRate] = useState(1);
  const [isVendorQuickCreateOpen, setIsVendorQuickCreateOpen] = useState(false);
  const [isCopyingComplianceLink, setIsCopyingComplianceLink] = useState(false);
  const [isComplianceLinkCopied, setIsComplianceLinkCopied] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    shouldUnregister: false,
    defaultValues: {
      title: "",
      description: "",
      department: user?.department || "",
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

  const formCategoryId = useWatch({ control, name: "purposeCategoryId" });
  const formSubPurposeId = useWatch({ control, name: "subPurposeId" });
  const paymentStructure = useWatch({ control, name: "paymentStructure" });
  const installments = useWatch({ control, name: "installments" }) || [];
  const totalEstimatedCost = useWatch({ control, name: "totalEstimatedCost" }) || 0;
  const vendorId = useWatch({ control, name: "vendorId" });
  const freightAmount = useWatch({ control, name: "freightAmount" }) || 0;
  const formCurrency = useWatch({ control, name: "currency" }) || "QAR";

  useEffect(() => {
    let isMounted = true;
    getExchangeRateToQAR(formCurrency).then((rate) => {
      if (isMounted) setExchangeRate(rate);
    });
    return () => { isMounted = false; };
  }, [formCurrency]);

  const selectedVendorCompliance = useMemo(() => {
    if (!vendorId || vendors.length === 0) return null;
    const v = vendors.find(vend => vend.id === Number(vendorId));
    return v ? { score: v.complianceScore, name: v.companyName, status: v.complianceStatus } : null;
  }, [vendorId, vendors]);

  const isNonCompliant = selectedVendorCompliance && selectedVendorCompliance.score < 50;

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
            department: reqData.department || user?.department || "",
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
          if (reqData.purposeCategoryId) {
            const subs = await apiClient.requests.getSubPurposes(reqData.purposeCategoryId);
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
          department: user?.department || "",
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

  useEffect(() => {
    if (vendorId && vendors.length > 0) {
      const selected = vendors.find((v: any) => v.id === Number(vendorId));
      if (selected?.payment_currency) {
        setValue("currency", selected.payment_currency);
      }
    }
  }, [vendorId, vendors, setValue]);

  const fetchSubPurposes = async (categoryId: number) => {
    setIsLoadingSubPurposes(true);
    try {
      const data = await apiClient.requests.getSubPurposes(categoryId);
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

  const handleVendorQuickCreated = async (newVendor: any) => {
    if (newVendor?.id) {
      setVendors((prev) => [newVendor, ...(Array.isArray(prev) ? prev.filter((v: any) => v.id !== newVendor.id) : [])]);
      setValue("vendorId", newVendor.id.toString(), { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    }
    try {
      const data = await apiClient.vendors.list();
      if (Array.isArray(data) && data.length > 0) {
        if (newVendor?.id && !data.some((v: any) => v.id === newVendor.id)) {
          setVendors([newVendor, ...data]);
        } else {
          setVendors(data);
        }
        if (newVendor?.id) {
          setValue("vendorId", newVendor.id.toString(), { shouldValidate: true, shouldDirty: true, shouldTouch: true });
        }
      }
    } catch (e) {
      console.error("Failed to refresh vendors list:", e);
    }
  };

  const handleCopyComplianceLink = async (targetVendorId?: number) => {
    const vid = targetVendorId || Number(vendorId);
    if (!vid) {
      toast.error("Please select a vendor first");
      return;
    }

    setIsCopyingComplianceLink(true);
    try {
      const res = await fetch(`/api/vendors/${vid}/completion-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.completionLink) {
        throw new Error(data.message || "Failed to generate compliance link");
      }

      await navigator.clipboard.writeText(data.completionLink);
      setIsComplianceLinkCopied(true);
      toast.success("Vendor self-service compliance link copied to clipboard");

      // Independent telemetry logging: logging failure cannot report copy failure after clipboard copy succeeded
      fetch(`/api/vendors/${vid}/completion-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "log_event", eventType: "LINK_COPIED" }),
      }).catch((logErr) => {
        console.warn("Failed to log LINK_COPIED event:", logErr);
      });

      setTimeout(() => setIsComplianceLinkCopied(false), 3000);
    } catch (err: any) {
      console.error("Failed to copy vendor compliance link:", err);
      toast.error(err.message || "Failed to copy compliance link");
    } finally {
      setIsCopyingComplianceLink(false);
    }
  };

  const isOverBudget = selectedBudget !== null && (totalEstimatedCost * exchangeRate) > selectedBudget;

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
      const convertedItems = data.items.map(item => ({
        ...item,
        estimatedCost: item.estimatedCost * exchangeRate
      }));
      
      const totalCostBase = (data.totalEstimatedCost + (data.freightAmount || 0)) * exchangeRate;
      const convertedInstallments = data.installments.map(inst => {
        const amtValue = inst.valueType === "FIXED_AMOUNT" ? inst.amountValue * exchangeRate : inst.amountValue;
        const calcAmt = inst.valueType === "PERCENTAGE"
          ? Math.round((amtValue / 100) * totalCostBase)
          : Math.round(amtValue);
        return {
          ...inst,
          amountValue: amtValue,
          calculatedAmount: calcAmt
        };
      });

      const finalizedData = { 
        ...data, 
        vendorId: data.vendorId && Number(data.vendorId) > 0 ? Number(data.vendorId) : undefined,
        purposeCategoryId: data.purposeCategoryId && Number(data.purposeCategoryId) > 0 ? Number(data.purposeCategoryId) : null,
        subPurposeId: data.subPurposeId && Number(data.subPurposeId) > 0 ? Number(data.subPurposeId) : null,
        purposeType: data.purposeType || "PROJECT",
        status: targetStatus,
        currency: "QAR",
        freightAmount: (data.freightAmount || 0) * exchangeRate,
        totalEstimatedCost: (data.totalEstimatedCost || 0) * exchangeRate,
        items: convertedItems,
        installments: convertedInstallments
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

  const handleCloseWithDraft = async () => {
    if (!requestId) {
      const currentValues = watch();
      const hasData = 
        (currentValues.title && currentValues.title.trim().length >= 3) &&
        ((currentValues.description && currentValues.description.trim().length > 0) ||
         (currentValues.vendorId && Number(currentValues.vendorId) > 0) ||
         (currentValues.items && currentValues.items.some((i: any) => i.name && i.name.trim().length > 0)));

      if (hasData) {
        const draftTitle = currentValues.title.trim();
        const draftVendorId = currentValues.vendorId && Number(currentValues.vendorId) > 0 ? Number(currentValues.vendorId) : (vendors.length > 0 ? vendors[0].id : null);
        const draftPurposeCategoryId = currentValues.purposeCategoryId && Number(currentValues.purposeCategoryId) > 0 ? Number(currentValues.purposeCategoryId) : null;
        const draftSubPurposeId = currentValues.subPurposeId && Number(currentValues.subPurposeId) > 0 ? Number(currentValues.subPurposeId) : null;
        const draftItems = currentValues.items && currentValues.items.length > 0 && currentValues.items[0].name
          ? currentValues.items
          : [{ name: draftTitle, quantity: 1, estimatedCost: currentValues.totalEstimatedCost || 0, description: currentValues.description || "Draft request item" }];

        const draftPayload: RequestFormValues = {
          ...currentValues,
          title: draftTitle,
          vendorId: draftVendorId ? String(draftVendorId) : "",
          purposeCategoryId: draftPurposeCategoryId ? String(draftPurposeCategoryId) : "",
          subPurposeId: draftSubPurposeId ? String(draftSubPurposeId) : "",
          items: draftItems,
        };

        try {
          await handleAction(draftPayload, "draft");
          return;
        } catch (err) {
          console.error("Failed to save draft on close", err);
        }
      }
    }
    reset();
    onClose();
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseWithDraft}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            className={`relative w-full h-full sm:w-[95vw] md:w-[85vw] lg:w-[1000px] bg-card border sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[100dvh] sm:max-h-[95dvh] md:max-h-[85vh] z-[101] transition-all duration-300 ${isOverBudget ? "border-rose-500/50" : "border-border/60"}`}
          >
            {/* Header */}
            <div className={`p-4 sm:p-6 border-b border-border/20 flex items-center justify-between transition-colors shrink-0 ${isOverBudget ? "bg-rose-500/5" : "bg-transparent"}`}>
              <div className="flex items-center gap-3 sm:gap-5 min-w-0">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all shrink-0 ${isOverBudget ? "bg-rose-500/10 shadow-rose-500/20" : "bg-primary/10 shadow-primary/20"}`}>
                  {isOverBudget ? <AlertCircle className="text-rose-500 w-5 h-5 sm:w-6 sm:h-6" /> : <Plus className="text-primary w-5 h-5 sm:w-6 sm:h-6" />}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-xl font-semibold text-foreground tracking-tight transition-colors truncate">
                    {isOverBudget ? "Budget Variance Detected" : (requestId ? "Edit Purchase Request" : "Create Purchase Request")}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Procurement Engine</p>
                    <div className={`w-1 h-1 rounded-full shrink-0 ${isOverBudget ? "bg-rose-500 animate-pulse" : "bg-primary/40"}`} />
                    <p className={`text-[11px] sm:text-xs font-medium shrink-0 ${isOverBudget ? "text-rose-500" : "text-primary"}`}>
                      {isOverBudget ? "Finance Review Required" : "Draft Mode"}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={handleCloseWithDraft}
                aria-label="Close dialog"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 hover:bg-secondary/50 rounded-xl text-muted-foreground hover:text-foreground transition-all shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex px-4 sm:px-8 gap-4 sm:gap-8 border-b border-border/20 bg-transparent transition-colors shrink-0 overflow-x-auto no-scrollbar">
              {(["general", "items", "payments", "approvals"] as const).map((tabId) => {
                const tabMeta = {
                  general: { label: "Details", icon: <Layout className="w-4 h-4" /> },
                  items: { label: "Items", icon: <ClipboardList className="w-4 h-4" /> },
                  payments: { label: "Payment", icon: <Coins className="w-4 h-4" /> },
                  approvals: { label: "Files", icon: <ShieldCheck className="w-4 h-4" /> },
                }[tabId];
                const isInvalid = isTabInvalid(tabId);
                return (
                  <button
                    key={tabId}
                    type="button"
                    onClick={() => setActiveTab(tabId)}
                    aria-label={`Switch to ${tabMeta.label} step`}
                    className={`py-3 sm:py-4 text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 transition-all relative z-10 shrink-0 min-h-[44px] ${
                      activeTab === tabId
                        ? isInvalid ? "text-rose-500 font-bold" : "text-primary font-bold"
                        : isInvalid ? "text-rose-400/80" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isInvalid ? <AlertCircle className="w-4 h-4 animate-pulse text-rose-500" /> : tabMeta.icon}
                    <span>{tabMeta.label}</span>
                    {isInvalid && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute top-3 sm:top-4 -right-1 pointer-events-none" />}
                    {activeTab === tabId && (
                      <motion.div
                        layoutId="tab-underline"
                        className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full pointer-events-none ${isInvalid ? "bg-rose-500" : "bg-primary"}`}
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
                onSubmit={(e) => {
                  e.preventDefault();
                }}
                className="flex-1 flex flex-col min-h-0"
              >
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
                  <AnimatePresence mode="wait">

                    {/* ── Tab 1: General Details ── */}
                    {activeTab === "general" && (
                      <motion.div key="general" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2 space-y-1.5">
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

                        {/* Submitting Department Selector (for multi-department users or super_admin) */}
                        {(submissionDepartments.length > 1 || isSuperAdmin) && (
                          <div className="md:col-span-2 space-y-1.5 bg-secondary/30 p-3.5 rounded-2xl border border-border/60">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <Building2 className="w-4 h-4 text-brand-primary" />
                                Submitting Department
                              </label>
                              <span className="text-[10px] text-muted-foreground font-medium">
                                Choose the target department for this purchase request
                              </span>
                            </div>
                            <Controller
                              name="department"
                              control={control}
                              render={({ field }) => (
                                <Select 
                                  onValueChange={field.onChange} 
                                  value={field.value || user?.department}
                                >
                                  <SelectTrigger className="h-10 text-sm font-medium">
                                    <SelectValue placeholder="Select submitting department..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(isSuperAdmin 
                                      ? (Array.isArray(globalDepartments) ? globalDepartments.map((d: any) => d.name) : submissionDepartments)
                                      : submissionDepartments
                                    ).map((deptName: string) => (
                                      <SelectItem key={deptName} value={deptName}>
                                        <div className="flex items-center justify-between w-full gap-3">
                                          <span className="font-semibold">{deptName}</span>
                                          {deptName === user?.department && (
                                            <span className="text-[10px] bg-brand-primary/10 text-brand-primary px-1.5 py-0.5 rounded font-bold">Primary</span>
                                          )}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between pl-1">
                            <div className="flex items-center gap-2 mb-1">
                              <label className="text-xs font-medium text-foreground block">Vendor Partnership</label>
                              <button 
                                type="button" 
                                onClick={() => setIsVendorQuickCreateOpen(true)} 
                                className="text-[11px] bg-primary/10 text-primary hover:bg-primary/20 px-2.5 py-1 rounded-lg font-bold transition-all border border-primary/20 flex items-center gap-1 min-h-[32px] sm:min-h-[28px] touch-target"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Quick-Create Vendor</span>
                              </button>
                            </div>
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
                                <Select 
                                  onValueChange={(val) => {
                                    if (val === "quick_create" || val === "add_new") {
                                      setIsVendorQuickCreateOpen(true);
                                    } else {
                                      field.onChange(val);
                                    }
                                  }} 
                                  value={(field.value?.toString() === "quick_create" || field.value?.toString() === "add_new") ? undefined : field.value?.toString()}
                                >
                                  <SelectTrigger className={cn(
                                    "pl-9 h-10 text-sm transition-all",
                                    errors.vendorId ? "border-rose-500 ring-1 ring-rose-500/20" : "",
                                    isNonCompliant ? "border-rose-500/50 bg-rose-500/[0.02] text-rose-600" : ""
                                  )}>
                                    <SelectValue placeholder="Select active vendor..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="quick_create" className="font-medium text-primary focus:text-primary focus:bg-primary/10 mb-1 border-b border-border/50 pb-2 cursor-pointer">
                                      <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-primary" />
                                        <span>Quick-Create Vendor</span>
                                      </div>
                                    </SelectItem>
                                    {vendors
                                      .filter((v) => !v.status || v.status === "active")
                                      .map((v) => (
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

                          {/* Copy Compliance Link Action for selected vendor */}
                          {selectedVendorCompliance && (
                            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-secondary/40 border border-border/70 mt-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-foreground truncate">{selectedVendorCompliance.name}</p>
                                  <p className="text-[10px] text-muted-foreground">Self-service compliance onboarding portal</p>
                                </div>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant={isComplianceLinkCopied ? "default" : "outline"}
                                onClick={() => handleCopyComplianceLink()}
                                disabled={isCopyingComplianceLink}
                                className="shrink-0 gap-1.5 min-h-[36px] text-xs font-semibold rounded-lg"
                              >
                                {isCopyingComplianceLink ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Generating...</span>
                                  </>
                                ) : isComplianceLinkCopied ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                    <span>Link Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 text-primary" />
                                    <span>Copy Compliance Link</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                          
                          {/* Compliance Advisory Notice (Non-Blocking) */}
                          <AnimatePresence>
                            {selectedVendorCompliance && (selectedVendorCompliance.score < 50 || selectedVendorCompliance.status === 'non_compliant') && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 mt-2">
                                  <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                  <div>
                                    <p className="text-sm font-semibold text-amber-600">Vendor Compliance Notice ({selectedVendorCompliance.score}% Profile Score)</p>
                                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed font-medium">
                                      {selectedVendorCompliance?.name} has pending/incomplete documentation. 
                                      Your purchase request can proceed normally, and a compliance notice will be recorded with the submission.
                                    </p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className="space-y-1.5">
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

                        <div className="space-y-1.5">
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

                        <div className="space-y-1.5">
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

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground mb-1 block">Currency</label>
                          <div className="relative group">
                            <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors z-10" />
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
                                    <SelectItem value="CNY">CNY - Chinese Yuan</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                        </div>

                        <div className="md:col-span-2 space-y-1.5">
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
                              exchangeRate={exchangeRate}
                              freightAmount={watch("freightAmount")}
                              onFreightChange={(val) => setValue("freightAmount", val)}
                              onTotalsChange={(val) => setValue("totalEstimatedCost", val)}
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
                                  ? ((inst.amountValue / 100) * totalCostBase)
                                  : (Number(inst.amountValue) || 0);
                                return (
                                  <motion.div key={idx} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="group bg-card border border-border rounded-xl p-3 flex flex-col md:flex-row gap-3 items-start md:items-center hover:border-primary/20 transition-all">
                                    <div className="flex items-center gap-2 w-full md:flex-1">
                                      <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                                        <span className="text-xs font-semibold text-primary">{idx + 1}</span>
                                      </div>
                                      <input
                                        {...register(`installments.${idx}.installmentName`)}
                                        className="flex-1 bg-transparent border-b border-border/50 hover:border-border focus:border-primary px-2 py-1 text-xs font-medium focus:outline-none transition-all placeholder:text-muted-foreground/30 h-8"
                                        placeholder="e.g. Initial Mobilization Payment"
                                      />
                                    </div>
                                    
                                    <div className="flex items-center gap-2 w-full md:w-auto">
                                      <input
                                        type="date"
                                        {...register(`installments.${idx}.dueDate`)}
                                        className="w-[120px] bg-secondary/50 border border-border rounded-lg px-2 py-1.5 text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all h-8"
                                      />
                                      <select
                                        {...register(`installments.${idx}.valueType`)}
                                        className="w-[100px] bg-secondary/50 border border-border rounded-lg px-2 py-1.5 text-[11px] font-medium appearance-none focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all cursor-pointer h-8"
                                      >
                                        <option value="PERCENTAGE">% Percentage</option>
                                        <option value="FIXED_AMOUNT">QAR Fixed</option>
                                      </select>
                                      <input
                                        type="number"
                                        min={0}
                                        max={inst.valueType === "PERCENTAGE" ? 100 : undefined}
                                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                        {...register(`installments.${idx}.amountValue`, { 
                                          valueAsNumber: true,
                                          max: inst.valueType === "PERCENTAGE" ? 100 : undefined
                                        })}
                                        className="w-[80px] bg-secondary/50 border border-border rounded-lg px-2 py-1.5 text-[11px] font-bold text-right focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all h-8"
                                      />
                                      <div className="min-w-[90px] text-right flex flex-col justify-center h-8 px-2 bg-primary/5 rounded-lg border border-primary/10">
                                        <span className="text-[10px] text-muted-foreground leading-none mb-0.5 hidden md:block">Amount</span>
                                        <span className="text-[11px] font-bold text-primary leading-none">QAR {calcAmt.toLocaleString()}</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setValue("installments", watch("installments").filter((_, i) => i !== idx));
                                        }}
                                        className="p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 opacity-50 group-hover:opacity-100 transition-all shrink-0 ml-1"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
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
                <div className={`p-4 sm:p-6 border-t transition-colors flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shrink-0 ${isOverBudget ? "bg-rose-500/10 border-rose-500/20" : "bg-secondary/30 border-border"}`}>
                  <div className="flex items-center justify-between sm:justify-start gap-4 sm:gap-8">
                    <div className="flex flex-col">
                      <span className="text-[11px] sm:text-xs text-muted-foreground font-medium">Total Estimated Exposure</span>
                      <span className={`text-base sm:text-lg font-semibold transition-colors ${isOverBudget ? "text-rose-500" : "text-foreground"}`}>
                        QAR {((watch("totalEstimatedCost") + watch("freightAmount")) * exchangeRate).toLocaleString()}
                      </span>
                    </div>

                    {selectedBudget !== null && (
                      <div className="flex items-center gap-3 sm:gap-4 pl-4 sm:pl-8 border-l border-border/50">
                        <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl ${isOverBudget ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"}`}>
                          {isOverBudget ? <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" /> : <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />}
                        </div>
                        <div>
                          <span className="text-[10px] sm:text-xs text-muted-foreground font-medium block">Dept Allocation</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs sm:text-sm font-semibold ${isOverBudget ? "text-rose-500" : "text-emerald-500"}`}>
                              QAR {selectedBudget.toLocaleString()}
                            </span>
                            {isOverBudget && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500 text-white text-[8px] font-black uppercase tracking-tighter">
                                Flag
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 sm:gap-3">
                    {activeTab !== "general" && (
                      <Button
                        variant="outline"
                        size="lg"
                        type="button"
                        onClick={() => {
                          if (activeTab === "approvals") setActiveTab("payments");
                          else if (activeTab === "payments") setActiveTab("items");
                          else if (activeTab === "items") setActiveTab("general");
                        }}
                        className="min-h-[44px] px-4 font-semibold text-foreground border-border"
                      >
                        Back
                      </Button>
                    )}

                    <Button 
                      variant="ghost" 
                      size="lg"
                      type="button" 
                      onClick={onClose} 
                      className="min-h-[44px] px-4 sm:px-6 font-semibold text-muted-foreground"
                    >
                      Discard
                    </Button>

                    <div className="flex items-center gap-2">
                      {/* Next or Submit Button */}
                      {!(activeTab === "approvals" || requestId) ? (
                        <Button
                          variant={isOverBudget ? "outline" : "secondary"}
                          size="lg"
                          type="button"
                          onClick={async () => {
                            if (activeTab === "general") {
                              const isValid = await trigger(["title", "description", "vendorId", "purposeCategoryId", "subPurposeId", "priority", "currency"]);
                              if (!isValid) {
                                toast.error("Please complete all required fields in Details before proceeding.");
                                return;
                              }
                              setActiveTab("items");
                            } else if (activeTab === "items") {
                              const isValid = await trigger(["items", "totalEstimatedCost", "freightAmount"]);
                              if (!isValid) {
                                toast.error("Please ensure at least one valid line item is added.");
                                return;
                              }
                              setActiveTab("payments");
                            } else if (activeTab === "payments") {
                              const isValid = await trigger(["paymentStructure", "installments"]);
                              if (!isValid) {
                                toast.error("Please verify payment milestone allocations.");
                                return;
                              }
                              setActiveTab("approvals");
                            }
                          }}
                          className={`min-h-[44px] flex items-center gap-2 px-6 sm:px-8 rounded-xl font-semibold ${isOverBudget ? "border-rose-500/30 text-rose-500 hover:bg-rose-500/10" : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"}`}
                        >
                          <span>Next</span>
                          <ChevronRight className={`w-4 h-4 ${isOverBudget ? "text-rose-500" : ""}`} />
                        </Button>
                      ) : (
                        <Button
                          disabled={isSubmitting}
                          size="lg"
                          type="button"
                          onClick={handleSubmit(
                            (data) => handleAction(data, "pending"),
                            (formErrors) => {
                              const generalFields = ["title", "description", "vendorId", "purposeCategoryId", "subPurposeId", "priority", "currency"];
                              const hasGeneralError = generalFields.some((f) => formErrors[f as keyof RequestFormValues]);
                              if (hasGeneralError) {
                                setActiveTab("general");
                                const firstEntry = Object.entries(formErrors).find(([k]) => generalFields.includes(k));
                                toast.error((firstEntry?.[1]?.message as string) || "Please complete all required fields in the Details tab.");
                              } else if (formErrors.items) {
                                setActiveTab("items");
                                toast.error("Please add at least one valid line item with quantity and cost.");
                              } else if (formErrors.installments) {
                                setActiveTab("payments");
                                toast.error(((formErrors.installments as any)?.message as string) || "Please check milestone allocation.");
                              } else {
                                const firstErr = Object.values(formErrors)[0]?.message as string;
                                toast.error(firstErr || "Validation failed. Please review all tabs.");
                              }
                            }
                          )}
                          className={cn(
                            "min-h-[44px] flex items-center gap-2 px-6 sm:px-8 rounded-xl shadow-sm font-semibold transition-all",
                            isOverBudget 
                              ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/30" 
                              : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/30"
                          )}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Processing...</span>
                            </>
                          ) : (
                            <>
                              <span>{isOverBudget ? "Override & Submit" : "Submit Request"}</span>
                              <Sparkles className="w-4 h-4" />
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
      <VendorQuickCreateModal
        open={isVendorQuickCreateOpen}
        onOpenChange={setIsVendorQuickCreateOpen}
        onVendorCreated={handleVendorQuickCreated}
      />
    </AnimatePresence>
  );
}
