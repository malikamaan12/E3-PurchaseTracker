"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { vendorFormSchema } from "@db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { X, Building2, User, Phone, Mail, Globe, Landmark, FileCheck, CreditCard, ArrowRight, CheckCircle2, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { z } from "zod";

// Extend the schema internally for the form if needed
type VendorFormValues = z.infer<typeof vendorFormSchema>;

export default function VendorOnboardingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);

  const { register, handleSubmit, formState: { errors }, watch, trigger } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      status: "active",
      category: "general",
      payment_currency: "QAR"
    },
    mode: "onChange"
  });

  const mutation = useMutation({
    mutationFn: (data: VendorFormValues) => apiClient.vendors.onboard(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor onboarded successfully");
      router.push('/dashboard/vendors');
    },
    onError: (err: any) => toast.error(err.message || "Failed to onboard vendor"),
  });

  const onSubmit = (data: VendorFormValues) => mutation.mutate(data);

  const nextStep = async () => {
    // Validate current step before proceeding
    let fieldsToValidate: (keyof VendorFormValues)[] = [];
    if (step === 1) fieldsToValidate = ["companyName", "contactPerson", "email", "contactNumber", "address"];
    if (step === 2) fieldsToValidate = ["bankName", "branchName", "accountNumber", "ibanNumber"];
    
    const isValid = await trigger(fieldsToValidate);
    if (isValid) setStep((s) => Math.min(3, s + 1));
  };

  const prevStep = () => setStep((s) => Math.max(1, s - 1));

  return (
    <div className="flex flex-col bg-zinc-950 min-h-screen">
      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 px-6 py-4">
        <div className="max-w-[1200px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => router.back()}
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group"
            >
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-semibold">Back to Vendors</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-[1200px] mx-auto w-full">
        <div className="mb-12">
          <h1 className="text-4xl font-serif text-white tracking-tight">Vendor Registration</h1>
          <p className="text-zinc-400 mt-2 text-lg max-w-2xl">Complete the onboarding process to integrate a new supplier. Multi-step validation ensures compliance with enterprise standards.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          {/* Progress Sidebar */}
          <div className="md:col-span-3 space-y-8">
            <div className="relative">
              <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-white/5" />
              <div className="space-y-6 relative">
                <StepNav current={step} stepNumber={1} title="Identity" desc="Company details" />
                <StepNav current={step} stepNumber={2} title="Finance" desc="Banking & Currency" />
                <StepNav current={step} stepNumber={3} title="Compliance" desc="Tax & Registration" />
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div className="md:col-span-9">
            <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-10 min-h-[500px] flex flex-col justify-between">
              <div>
                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div 
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-8"
                    >
                      <div>
                        <h2 className="text-2xl font-bold text-white mb-1">Company Identity</h2>
                        <p className="text-zinc-400 text-sm">Enter the officially registered company details.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <FormField icon={<Building2 />} label="Company Name" name="companyName" register={register} error={errors.companyName} placeholder="Acme Tech Solutions" />
                        <FormField icon={<User />} label="Contact Person" name="contactPerson" register={register} error={errors.contactPerson} placeholder="Full Name" />
                        <FormField icon={<Mail />} label="Business Email" name="email" register={register} error={errors.email} placeholder="vendor@example.com" />
                        <FormField icon={<Phone />} label="Contact Number" name="contactNumber" register={register} error={errors.contactNumber} placeholder="+974 ..." />
                        <div className="col-span-2">
                           <FormField icon={<Globe />} label="Headquarters Address" name="address" register={register} error={errors.address} placeholder="123 Business Avenue, City, Country" />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div 
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-8"
                    >
                      <div>
                        <h2 className="text-2xl font-bold text-white mb-1">Financial Details</h2>
                        <p className="text-zinc-400 text-sm">Secure banking information for automated wire transfers.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <FormField icon={<Landmark />} label="Bank Name" name="bankName" register={register} error={errors.bankName} placeholder="Standard Chartered" />
                        <FormField icon={<Landmark />} label="Branch Name" name="branchName" register={register} error={errors.branchName} placeholder="Doha Main Branch" />
                        <FormField icon={<CreditCard />} label="Account Number" name="accountNumber" register={register} error={errors.accountNumber} />
                        <FormField icon={<CreditCard />} label="IBAN Number" name="ibanNumber" register={register} error={errors.ibanNumber} />
                        
                        <div className="space-y-2 col-span-2">
                          <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider flex items-center gap-2">
                            Payment Currency
                          </label>
                          <select 
                            {...register("payment_currency")} 
                            className="bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-brand-primary/20 focus:border-brand-primary/50 w-full"
                          >
                            <option value="QAR">Qatari Riyal (QAR)</option>
                            <option value="USD">US Dollar (USD)</option>
                            <option value="CNY">Chinese Yuan (CNY)</option>
                          </select>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div 
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-8"
                    >
                      <div>
                        <h2 className="text-2xl font-bold text-white mb-1">Compliance & Tax</h2>
                        <p className="text-zinc-400 text-sm">Required for auditing and legal tracking purposes.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <FormField icon={<FileCheck />} label="VAT Number (Optional)" name="taxNumber" register={register} error={errors.taxNumber} placeholder="e.g. 1234567890" />
                        <FormField icon={<FileCheck />} label="Comm. Registration (Optional)" name="registrationNumber" register={register} error={errors.registrationNumber} placeholder="CR Number" />
                        
                        <div className="col-span-2 p-8 rounded-xl bg-white/5 border border-dashed border-white/10 flex flex-col items-center justify-center gap-3 transition-colors hover:bg-white/[0.07] cursor-pointer">
                          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-brand-primary mb-2">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                          </div>
                          <p className="text-zinc-300 font-medium">Upload Compliance Documents</p>
                          <p className="text-zinc-500 text-sm">Drag and drop PDFs or click to browse</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Navigation Actions */}
              <div className="flex justify-between items-center pt-8 mt-12 border-t border-white/5">
                <button 
                  type="button"
                  onClick={prevStep}
                  className={`text-zinc-400 hover:text-white transition-colors font-semibold px-4 py-2 ${step === 1 ? 'invisible' : ''}`}
                >
                  Previous
                </button>
                <div className="flex gap-4">
                  {step < 3 ? (
                    <button 
                      type="button"
                      onClick={nextStep}
                      className="bg-brand-primary text-white font-bold px-8 py-3 rounded-xl hover:bg-brand-primary/90 transition-all flex items-center gap-2"
                    >
                      Continue <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button 
                      type="submit"
                      disabled={mutation.isPending}
                      className="bg-brand-secondary text-black font-bold px-8 py-3 rounded-xl hover:scale-105 transition-all shadow-xl shadow-brand-secondary/20 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                      {mutation.isPending ? "Finalizing..." : "Complete Registration"}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

function StepNav({ current, stepNumber, title, desc }: any) {
  const isCompleted = current > stepNumber;
  const isCurrent = current === stepNumber;
  const isFuture = current < stepNumber;

  return (
    <div className={`flex items-start gap-4 relative z-10 ${isFuture ? 'opacity-50' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 ${
        isCompleted ? 'bg-brand-secondary text-black' : 
        isCurrent ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 ring-4 ring-brand-primary/20' : 
        'bg-zinc-900 border border-white/10 text-zinc-500'
      }`}>
        {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : stepNumber}
      </div>
      <div>
        <h3 className={`font-bold ${isCurrent ? 'text-white' : isCompleted ? 'text-zinc-300' : 'text-zinc-500'}`}>{title}</h3>
        <p className="text-xs text-zinc-500 mt-1">{desc}</p>
      </div>
    </div>
  );
}

function FormField({ icon, label, name, register, error, placeholder }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider flex items-center gap-2">
        <span className="text-zinc-600">{icon && <span className="w-3 h-3 block">{icon}</span>}</span>
        {label}
      </label>
      <input 
        {...register(name)}
        placeholder={placeholder}
        className={`w-full bg-zinc-900/50 border rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 transition-all ${error ? 'border-rose-500/50 focus:ring-rose-500/20' : 'border-white/10 focus:ring-brand-primary/20 focus:border-brand-primary/50'}`}
      />
      {error && <p className="text-[10px] text-rose-500 font-medium">{error.message}</p>}
    </div>
  );
}
