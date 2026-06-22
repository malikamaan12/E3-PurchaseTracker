"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { vendorFormSchema } from "@db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Building2, User, Phone, Mail, Globe, Landmark, FileCheck, CreditCard } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { z } from "zod";

type VendorFormValues = z.infer<typeof vendorFormSchema>;

interface VendorManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: any; // Passed when editing
}

export function VendorManagementModal({ open, onOpenChange, vendor }: VendorManagementModalProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const step3EnteredAt = useRef(0);
  const isEdit = !!vendor;

  const { register, handleSubmit, formState: { errors }, reset } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      status: "active",
      category: "general",
      payment_currency: "QAR"
    }
  });

  useEffect(() => {
    if (open) {
      if (vendor) {
        reset({
          companyName: vendor.companyName,
          contactPerson: vendor.contactPerson,
          email: vendor.email,
          contactNumber: vendor.contactNumber,
          address: vendor.address,
          bankName: vendor.bankName,
          branchName: vendor.branchName,
          accountNumber: vendor.accountNumber,
          ibanNumber: vendor.ibanNumber,
          taxNumber: vendor.taxNumber || "",
          registrationNumber: vendor.registrationNumber || "",
          remarks: vendor.remarks || "",
          rating: vendor.rating || 0,
          status: vendor.status || "active",
          category: vendor.category || "general",
          payment_currency: vendor.payment_currency || "QAR"
        });
      } else {
        reset({
          status: "active",
          category: "general",
          payment_currency: "QAR"
        });
      }
      setStep(1);
    }
  }, [open, vendor, reset]);

  useEffect(() => {
    if (step === 3) {
      step3EnteredAt.current = Date.now();
    }
  }, [step]);

  const mutation = useMutation({
    mutationFn: (data: any) => 
      isEdit ? apiClient.vendors.update(vendor.id, data) : apiClient.vendors.onboard(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_vendors"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success(isEdit ? "Vendor details updated" : "Vendor onboarded successfully");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message || `Failed to ${isEdit ? 'update' : 'onboard'} vendor`),
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

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] md:max-w-2xl z-[101] focus:outline-none">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-card p-8 border border-border shadow-2xl relative overflow-y-auto max-h-[85vh] rounded-[2.5rem] custom-scrollbar"
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-10 relative">
              <div className="absolute -top-16 -left-16 w-32 h-32 bg-brand-primary/20 blur-3xl rounded-full pointer-events-none" />
              <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-brand-secondary/10 blur-[100px] rounded-full pointer-events-none" />
              <div className="relative">
                <Dialog.Title className="text-4xl font-serif font-black text-foreground tracking-tighter leading-none">
                  {isEdit ? "Modify Supplier" : "Onboard Entity"}
                </Dialog.Title>
                <Dialog.Description className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mt-3">
                  {isEdit ? "Update existing supplier credentials and financial data." : "Integrate a new supplier into the procurement matrix."}
                </Dialog.Description>
              </div>
              <Dialog.Close className="p-2.5 rounded-2xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-all border border-transparent hover:border-border relative">
                <X className="w-5 h-5" />
              </Dialog.Close>
            </div>

            {/* Stepper Header */}
            <div className="flex gap-2 sm:gap-4 mb-10 bg-secondary/30 p-4 rounded-3xl border border-border relative flex-wrap sm:flex-nowrap">
              <StepIndicator current={step} target={1} label="Identity" />
              <StepIndicator current={step} target={2} label="Finance" />
              <StepIndicator current={step} target={3} label="Compliance" />
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div 
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-6"
                  >
                    <FormField icon={Building2} label="Company Name*" name="companyName" register={register} error={errors.companyName} placeholder="e.g. Acme Tech Solutions" />
                    <FormField icon={User} label="Contact Person*" name="contactPerson" register={register} error={errors.contactPerson} placeholder="Full Name" />
                    <FormField icon={Mail} label="Business Email*" name="email" register={register} error={errors.email} placeholder="vendor@example.com" />
                    <FormField icon={Phone} label="Contact Number*" name="contactNumber" register={register} error={errors.contactNumber} placeholder="+974 ..." />
                    <div className="sm:col-span-2">
                       <FormField icon={Globe} label="Headquarters Address*" name="address" register={register} error={errors.address} placeholder="Street, City, Country" />
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div 
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-6"
                  >
                    <FormField icon={Landmark} label="Bank Name*" name="bankName" register={register} error={errors.bankName} placeholder="Official bank title" />
                    <FormField icon={Landmark} label="Branch Name*" name="branchName" register={register} error={errors.branchName} placeholder="Branch location" />
                    <FormField icon={CreditCard} label="Account Number*" name="accountNumber" register={register} error={errors.accountNumber} />
                    <FormField icon={CreditCard} label="IBAN Number*" name="ibanNumber" register={register} error={errors.ibanNumber} />
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div 
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-6"
                  >
                    <FormField icon={FileCheck} label="VAT Number" name="taxNumber" register={register} error={errors.taxNumber} />
                    <FormField icon={FileCheck} label="Comm. Reg #" name="registrationNumber" register={register} error={errors.registrationNumber} />
                    <FormField icon={FileCheck} label="Remarks" name="remarks" register={register} error={errors.remarks} placeholder="Notes..." />
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest flex items-center gap-2">
                        Vendor Reputation Index
                      </label>
                      <input 
                        type="number"
                        min="0"
                        max="5"
                        {...register("rating", { valueAsNumber: true })}
                        placeholder="Rating 0-5"
                        className="w-full bg-secondary/30 border border-border rounded-2xl px-5 py-4 text-sm font-bold text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-8 focus:ring-brand-primary/10 focus:border-brand-primary/40 focus:bg-secondary/50 transition-all"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex justify-between items-center pt-8 border-t border-border">
                <button 
                  type="button"
                  onClick={() => setStep(s => Math.max(1, s - 1))}
                  className={`text-muted-foreground hover:text-foreground transition-colors font-semibold ${step === 1 ? 'invisible' : ''}`}
                >
                  Previous Step
                </button>
                <div className="flex gap-4">
                  {step < 3 ? (
                    <button 
                      type="button"
                      onClick={() => setStep(s => Math.min(3, s + 1))}
                      className="bg-secondary text-foreground border border-border font-bold px-6 py-2.5 rounded-full hover:bg-secondary/80 transition-all active:scale-95"
                    >
                      Next: {step === 1 ? 'Financials' : 'Compliance'}
                    </button>
                  ) : (
                    <button 
                      type="submit"
                      disabled={mutation.isPending}
                      className="bg-brand-primary text-primary-foreground font-black px-10 py-3.5 rounded-2xl hover:brightness-110 transition-all shadow-2xl shadow-brand-primary/20 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                      {mutation.isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Syncing...</span>
                        </>
                      ) : isEdit ? "Update Details" : "Finalize Onboarding"}
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
      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-black transition-all duration-500 border ${active ? 'bg-brand-primary text-primary-foreground border-brand-primary shadow-xl shadow-brand-primary/30' : 'bg-secondary text-muted-foreground border-border'}`}>
        {target}
      </div>
      <span className={`text-[10px] uppercase font-black tracking-[0.2em] ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
      {target < 3 && <div className="w-12 h-px bg-border ml-1" />}
    </div>
  );
}

function FormField({ icon: Icon, label, name, register, error, placeholder }: any) {
  return (
    <div className="space-y-2 group">
      <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest flex items-center gap-2 group-focus-within:text-brand-primary transition-colors">
        {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground group-focus-within:text-brand-primary transition-colors" strokeWidth={3} />}
        {label}
      </label>
      <input 
        {...register(name)}
        placeholder={placeholder}
        className={`w-full bg-secondary/30 border rounded-2xl px-5 py-4 text-sm font-bold text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-8 transition-all ${error ? 'border-rose-500/40 focus:ring-rose-500/10' : 'border-border focus:ring-brand-primary/10 focus:border-brand-primary/40 focus:bg-secondary/50'}`}
      />
      {error && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-tight mt-1">{error.message}</p>}
    </div>
  );
}
