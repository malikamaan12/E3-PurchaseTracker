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

export function OnboardVendorModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const step3EnteredAt = useRef(0);

  useEffect(() => {
    if (step === 3) {
      step3EnteredAt.current = Date.now();
    }
  }, [step]);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      status: "active",
      category: "general",
      payment_currency: "QAR"
    }
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiClient.vendors.onboard(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor onboarded successfully");
      reset();
      setStep(1);
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to onboard vendor"),
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
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl z-[101] focus:outline-none">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="glass-card p-8 border-white/20 shadow-2xl relative overflow-hidden"
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-10 relative">
              <div className="absolute top-0 left-0 w-32 h-32 bg-brand-primary/10 blur-3xl rounded-full -ml-16 -mt-16 pointer-events-none" />
              <div className="relative">
                <Dialog.Title className="text-4xl font-serif font-black text-white tracking-tighter leading-none">Onboard Entity</Dialog.Title>
                <Dialog.Description className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] mt-3">Integrate a new supplier into the procurement matrix.</Dialog.Description>
              </div>
              <Dialog.Close className="p-2.5 rounded-2xl hover:bg-white/10 text-zinc-500 hover:text-white transition-all border border-transparent hover:border-white/10 relative">
                <X className="w-5 h-5" />
              </Dialog.Close>
            </div>

            {/* Stepper Header */}
            <div className="flex gap-4 mb-10 bg-black/20 p-4 rounded-3xl border border-white/5 relative">
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
                    className="grid grid-cols-2 gap-6"
                  >
                    <FormField icon={<Building2 />} label="Company Name*" name="companyName" register={register} error={errors.companyName} placeholder="e.g. Acme Tech Solutions" />
                    <FormField icon={<User />} label="Contact Person*" name="contactPerson" register={register} error={errors.contactPerson} placeholder="Full Name" />
                    <FormField icon={<Mail />} label="Business Email*" name="email" register={register} error={errors.email} placeholder="vendor@example.com" />
                    <FormField icon={<Phone />} label="Contact Number*" name="contactNumber" register={register} error={errors.contactNumber} placeholder="+974 ..." />
                    <div className="col-span-2">
                       <FormField icon={<Globe />} label="Headquarters Address*" name="address" register={register} error={errors.address} placeholder="Street, City, Country" />
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div 
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="grid grid-cols-2 gap-6"
                  >
                    <FormField icon={<Landmark />} label="Bank Name*" name="bankName" register={register} error={errors.bankName} placeholder="Official bank title" />
                    <FormField icon={<Landmark />} label="Branch Name*" name="branchName" register={register} error={errors.branchName} placeholder="Branch location" />
                    <FormField icon={<CreditCard />} label="Account Number*" name="accountNumber" register={register} error={errors.accountNumber} />
                    <FormField icon={<CreditCard />} label="IBAN Number*" name="ibanNumber" register={register} error={errors.ibanNumber} />
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div 
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="grid grid-cols-2 gap-6"
                  >
                    <FormField icon={<FileCheck />} label="VAT Number" name="taxNumber" register={register} error={errors.taxNumber} />
                    <FormField icon={<FileCheck />} label="Comm. Reg #" name="registrationNumber" register={register} error={errors.registrationNumber} />
                    <FormField icon={<FileCheck />} label="Remarks" name="remarks" register={register} error={errors.remarks} placeholder="Notes..." />
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black text-zinc-500 tracking-widest flex items-center gap-2">
                        Vendor Reputation Index
                      </label>
                      <input 
                        type="number"
                        min="0"
                        max="5"
                        {...register("rating", { valueAsNumber: true })}
                        placeholder="Rating 0-5"
                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-white placeholder:text-zinc-600 focus:outline-none focus:ring-8 focus:ring-brand-primary/10 focus:border-brand-primary/40 focus:bg-black/20 transition-all"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex justify-between items-center pt-8 border-t border-white/5">
                <button 
                  type="button"
                  onClick={() => setStep(s => Math.max(1, s - 1))}
                  className={`text-zinc-400 hover:text-white transition-colors font-semibold ${step === 1 ? 'invisible' : ''}`}
                >
                  Previous Step
                </button>
                <div className="flex gap-4">
                  {step < 3 ? (
                    <button 
                      type="button"
                      onClick={() => setStep(s => Math.min(3, s + 1))}
                      className="bg-white/10 text-white font-bold px-6 py-2.5 rounded-full hover:bg-white/20 transition-all active:scale-95"
                    >
                      Next: {step === 1 ? 'Financials' : 'Compliance'}
                    </button>
                  ) : (
                    <button 
                      type="submit"
                      disabled={mutation.isPending}
                      className="bg-brand-primary text-white font-black px-10 py-3.5 rounded-2xl hover:brightness-110 transition-all shadow-2xl shadow-brand-primary/20 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                      {mutation.isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Syncing...</span>
                        </>
                      ) : "Finalize Onboarding"}
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
      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-black transition-all duration-500 border ${active ? 'bg-brand-primary text-white border-brand-primary shadow-xl shadow-brand-primary/30' : 'bg-white/5 text-zinc-600 border-white/5'}`}>
        {target}
      </div>
      <span className={`text-[9px] uppercase font-black tracking-[0.2em] ${active ? 'text-zinc-300' : 'text-zinc-600'}`}>{label}</span>
      {target < 3 && <div className="w-6 h-px bg-white/10 ml-1" />}
    </div>
  );
}

function FormField({ icon, label, name, register, error, placeholder }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] uppercase font-black text-zinc-500 tracking-widest flex items-center gap-2">
        <span className="text-zinc-600 group-focus-within:text-brand-primary transition-colors">{icon && <span className="w-3.5 h-3.5 block">{icon}</span>}</span>
        {label}
      </label>
      <input 
        {...register(name)}
        placeholder={placeholder}
        className={`w-full bg-white/[0.03] border-2 rounded-2xl px-5 py-4 text-sm font-bold text-white placeholder:text-zinc-700 focus:outline-none focus:ring-8 transition-all ${error ? 'border-rose-500/40 focus:ring-rose-500/10' : 'border-white/5 focus:ring-brand-primary/10 focus:border-brand-primary/40 focus:bg-black/20'}`}
      />
      {error && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-tight mt-1">{error.message}</p>}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
  );
}
