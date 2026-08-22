"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { vendorFormSchema } from "@db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Building2, User, Phone, Mail, Globe, Landmark, FileCheck, CreditCard, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { z } from "zod";
import { cn } from "@/lib/utils";

type VendorFormValues = z.infer<typeof vendorFormSchema>;

interface VendorManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor: any; // Required: this modal is strictly for editing existing vendors
}

export function VendorManagementModal({ open, onOpenChange, vendor }: VendorManagementModalProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const step3EnteredAt = useRef(0);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      status: "active",
      category: "general",
      payment_currency: "QAR"
    }
  });

  useEffect(() => {
    if (open && vendor) {
      reset({
        companyName: vendor.companyName || "",
        contactPerson: vendor.contactPerson || "",
        email: vendor.email || "",
        contactNumber: vendor.contactNumber || "",
        address: vendor.address || "",
        bankName: vendor.bankName || "",
        branchName: vendor.branchName || "",
        accountNumber: vendor.accountNumber || "",
        ibanNumber: vendor.ibanNumber || "",
        taxNumber: vendor.taxNumber || "",
        registrationNumber: vendor.registrationNumber || "",
        remarks: vendor.remarks || "",
        rating: vendor.rating || 0,
        status: vendor.status || "active",
        category: vendor.category || "general",
        payment_currency: vendor.payment_currency || "QAR"
      });
      setStep(1);
    }
  }, [open, vendor, reset]);

  useEffect(() => {
    if (step === 3) {
      step3EnteredAt.current = Date.now();
    }
  }, [step]);

  const mutation = useMutation({
    mutationFn: (data: any) => apiClient.vendors.update(vendor.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_vendors"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor details updated successfully");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to update vendor details"),
  });

  const onSubmit = (data: any) => {
    if (step !== 3) {
      setStep(s => Math.min(3, s + 1));
      return;
    }
    if (Date.now() - step3EnteredAt.current < 500) {
      return;
    }
    mutation.mutate(data);
  };

  if (!vendor) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-all" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] md:max-w-2xl z-[101] focus:outline-none">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-card p-0 border border-border/80 shadow-2xl relative overflow-hidden flex flex-col max-h-[90dvh] rounded-3xl md:rounded-[2.5rem]"
          >
            {/* Header */}
            <div className="p-6 md:p-8 border-b border-border/20 flex items-center justify-between bg-transparent relative z-10 shrink-0">
              <div className="absolute -top-16 -left-16 w-32 h-32 bg-primary/20 blur-3xl rounded-full pointer-events-none" />
              <div className="flex items-center gap-5 relative">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg bg-primary/10 shadow-primary/20 shrink-0">
                  <Building2 className="text-primary w-6 h-6" />
                </div>
                <div>
                  <Dialog.Title className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
                    Modify Supplier
                  </Dialog.Title>
                  <Dialog.Description className="text-xs md:text-sm text-muted-foreground mt-1 font-medium">
                    Update existing supplier credentials and financial data.
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close className="p-2.5 hover:bg-secondary/50 rounded-xl text-muted-foreground hover:text-foreground transition-all shrink-0">
                <X className="w-5 h-5" />
              </Dialog.Close>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto flex flex-col custom-scrollbar relative">
              <div className="p-6 md:p-8 flex-1">
                {/* Stepper Header */}
                <div className="flex gap-2 sm:gap-6 mb-8 bg-secondary/30 backdrop-blur-sm p-3 rounded-2xl border border-border/50 relative overflow-hidden flex-wrap sm:flex-nowrap">
                  <StepIndicator current={step} target={1} label="Identity" />
                  <StepIndicator current={step} target={2} label="Finance" />
                  <StepIndicator current={step} target={3} label="Compliance" />
                </div>

                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div 
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-6"
                    >
                      <FormField icon={Building2} label="Company Name" name="companyName" register={register} error={errors.companyName} placeholder="e.g. Acme Tech Solutions" />
                      <FormField icon={User} label="Contact Person" name="contactPerson" register={register} error={errors.contactPerson} placeholder="Full Name" />
                      <FormField icon={Mail} label="Business Email" name="email" register={register} error={errors.email} placeholder="vendor@example.com" />
                      <FormField icon={Phone} label="Contact Number" name="contactNumber" register={register} error={errors.contactNumber} placeholder="+974 ..." />
                      <div className="sm:col-span-2">
                         <FormField icon={Globe} label="Headquarters Address" name="address" register={register} error={errors.address} placeholder="Street, City, Country" />
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div 
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-6"
                    >
                      <FormField icon={Landmark} label="Bank Name" name="bankName" register={register} error={errors.bankName} placeholder="Official bank title" />
                      <FormField icon={Landmark} label="Branch Name" name="branchName" register={register} error={errors.branchName} placeholder="Branch location" />
                      <FormField icon={CreditCard} label="Account Number" name="accountNumber" register={register} error={errors.accountNumber} />
                      <FormField icon={CreditCard} label="IBAN Number" name="ibanNumber" register={register} error={errors.ibanNumber} />
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div 
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-6"
                    >
                      <FormField icon={FileCheck} label="VAT Number" name="taxNumber" register={register} error={errors.taxNumber} />
                      <FormField icon={FileCheck} label="Comm. Reg #" name="registrationNumber" register={register} error={errors.registrationNumber} />
                      <FormField icon={FileCheck} label="Remarks" name="remarks" register={register} error={errors.remarks} placeholder="Notes..." />
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground tracking-wide flex items-center gap-2">
                          Vendor Reputation Index
                        </label>
                        <input 
                          type="number"
                          min="0"
                          max="5"
                          {...register("rating", { valueAsNumber: true })}
                          placeholder="Rating 0-5"
                          className="w-full bg-background/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Actions */}
              <div className="p-6 md:p-8 border-t border-border/20 bg-background/50 backdrop-blur-md shrink-0 flex justify-between items-center mt-auto">
                <button 
                  type="button"
                  onClick={() => setStep(s => Math.max(1, s - 1))}
                  className={cn(
                    "px-6 py-2.5 rounded-xl font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all",
                    step === 1 ? "opacity-0 pointer-events-none" : "opacity-100"
                  )}
                >
                  Previous Step
                </button>
                <div className="flex gap-4">
                  {step < 3 ? (
                    <button 
                      type="button"
                      onClick={() => setStep(s => Math.min(3, s + 1))}
                      className="bg-secondary text-foreground font-medium px-8 py-2.5 rounded-xl hover:bg-secondary/80 transition-all flex items-center gap-2"
                    >
                      Next: {step === 1 ? 'Financials' : 'Compliance'}
                    </button>
                  ) : (
                    <button 
                      type="submit"
                      disabled={mutation.isPending}
                      className="bg-primary text-primary-foreground font-bold px-8 py-2.5 rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center gap-2"
                    >
                      {mutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : "Update Details"}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StepIndicator({ current, target, label }: any) {
  const active = current >= target;
  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold transition-all duration-300",
        active ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "bg-background text-muted-foreground border border-border/50"
      )}>
        {target}
      </div>
      <span className={cn(
        "text-xs font-semibold tracking-wide",
        active ? "text-foreground" : "text-muted-foreground"
      )}>{label}</span>
      {target < 3 && <div className="hidden sm:block w-8 h-px bg-border ml-2" />}
    </div>
  );
}

function FormField({ icon: Icon, label, name, register, error, placeholder }: any) {
  return (
    <div className="space-y-1.5 group">
      <label className="text-xs font-medium text-foreground tracking-wide flex items-center gap-1.5 transition-colors group-focus-within:text-primary">
        {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />}
        {label}
      </label>
      <input 
        {...register(name)}
        placeholder={placeholder}
        className={cn(
          "w-full bg-background/50 border rounded-xl px-4 py-2.5 text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 transition-all",
          error ? "border-rose-500/50 focus:ring-rose-500/20 focus:border-rose-500" : "border-border/50 focus:ring-primary focus:border-primary"
        )}
      />
      {error && <p className="text-xs text-rose-500 font-medium mt-1 pl-1">{error.message}</p>}
    </div>
  );
}
