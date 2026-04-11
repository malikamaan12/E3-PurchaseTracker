"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LogIn, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  Lock,
  User,
  ShieldCheck
} from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import Link from "next/link";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  useEffect(() => {
    setMounted(true);
    console.log("[Login] Hydrated Successfully.");
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    if (searchParams.get("expired")) {
      toast.error("Session expired. Please login again.");
      const params = new URLSearchParams(searchParams.toString());
      params.delete("expired");
      const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      window.history.replaceState({ ...window.history.state }, '', newUrl);
    }
  }, [mounted, searchParams]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await apiClient.auth.login({
        username: formData.username,
        password: formData.password
      });
      toast.success("Welcome back!");
      router.push("/dashboard/requests");
    } catch (err: any) {
      setError(err.message || "Authentication failed");
      toast.error(err.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center relative overflow-hidden">
        {/* Basic background while loading to prevent flash */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none opacity-20">
          <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[45%] bg-brand-primary/20 rounded-full blur-[120px]" />
        </div>
        <div className="flex flex-col items-center gap-4 z-10">
          <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Initializing Identity...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-500">
      {/* Theme Toggle Positioned Top Right */}
      <div className="absolute top-8 right-8 z-50">
        <ThemeToggle />
      </div>

      {/* Premium Ambient Background (Fluid Blobs) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[45%] bg-brand-primary/20 dark:bg-brand-primary/30 rounded-full blur-[120px] animate-fluid-drift" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] bg-brand-secondary/20 dark:bg-brand-secondary/30 rounded-full blur-[120px] animate-fluid-drift [animation-delay:2s]" />
        <div className="absolute top-[20%] right-[10%] w-[35%] h-[35%] bg-brand-mid/15 dark:bg-brand-mid/25 rounded-full blur-[110px] animate-fluid-drift [animation-delay:4s]" />
        <div className="absolute bottom-[20%] left-[10%] w-[30%] h-[30%] bg-[#A78BFA]/10 dark:bg-[#A78BFA]/15 rounded-full blur-[100px] animate-fluid-drift [animation-delay:6s]" />
        
        {/* Fine grain overlay for premium texture */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none brightness-100 contrast-150" style={{ backgroundImage: "url('/noise.svg')" }} />
      </div>

      <div 
        className="w-full max-w-md z-10 animate-fade-in-up"
        style={{ opacity: 0 }} /* Standard CSS animation will handle the fade in */
      >
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="mb-6 relative">
            <img src="/logo-color.png" className="h-16 w-auto block dark:hidden" alt="PR System Logo" />
            <img src="/logo-white.png" className="h-16 w-auto hidden dark:block" alt="PR System Logo" />
          </div>
          <p className="text-brand-text dark:text-gray-300 text-sm tracking-widest uppercase font-bold">Purchase Management System</p>
        </div>

        {/* Glassmorphism Hub Card */}
        <div className="glass-card p-10 relative overflow-hidden group">
          {/* Internal card sheen */}
          <div className="absolute -top-[150%] -left-[150%] w-[400%] h-[400%] bg-white/5 dark:bg-white/[0.02] transform rotate-12 pointer-events-none group-hover:duration-1000 transition-transform duration-500" />
          
          <div className="flex gap-4 mb-10 p-1 bg-white/5 dark:bg-white/[0.02] rounded-[var(--radius-md)] border border-white/10">
            <div className="flex-1 py-3 rounded-[var(--radius-sm)] text-[10px] font-bold tracking-[0.2em] flex items-center justify-center gap-2 bg-brand-gradient text-white shadow-lg">
              <LogIn className="w-3.5 h-3.5" /> LOGIN
            </div>
            <Link 
              href="/signup"
              className="flex-1 py-3 rounded-[var(--radius-sm)] text-[10px] font-bold tracking-[0.2em] flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-all"
            >
              SIGN UP
            </Link>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  key="auth-error"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg flex items-center gap-3 text-rose-500 text-xs font-semibold"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              <AuthInput 
                icon={<User className="w-4 h-4" />}
                label="Username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleInputChange}
                required
              />

              <AuthInput 
                icon={<Lock className="w-4 h-4" />}
                label="Password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                required
              />
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-brand-gradient text-white hover:opacity-90 rounded-[var(--radius-md)] font-bold tracking-[0.2em] text-[10px] mt-6 flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-xl disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  ACCESS HUB
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-zinc-400 dark:text-zinc-600 text-[10px] italic">
            Enterprise system. Access is monitored and logged.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

function AuthInput({ label, icon, ...props }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[9px] uppercase font-bold text-muted-foreground tracking-[0.2em] flex items-center gap-2 opacity-60">
        {label}
      </label>
      <div className="relative group/input">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within/input:text-brand-primary transition-colors">
            {icon}
          </div>
        )}
        <input 
          {...props}
          className={`glass-input shadow-inner ${icon ? 'pl-11' : 'px-4'}`}
          placeholder={`Enter ${label.toLowerCase()}...`}
        />
      </div>
    </div>
  );
}
