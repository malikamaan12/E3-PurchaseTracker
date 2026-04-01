"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldCheck, 
  UserPlus, 
  LogIn, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  Building2,
  Mail,
  Lock,
  User,
  Phone
} from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    department: "",
    contactNumber: "",
  });

  useEffect(() => {
    if (searchParams.get("expired")) {
      toast.error("Session expired. Please login again.");
    }
  }, [searchParams]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (mode === "login") {
        await apiClient.auth.login({
          username: formData.username,
          password: formData.password
        });
        toast.success("Welcome back!");
        router.push("/dashboard/requests");
      } else {
        await apiClient.auth.register({
          username: formData.username,
          password: formData.password,
          email: formData.email,
          contact_number: formData.contactNumber,
          department: formData.department,
          role: "user"
        });
        toast.success("Account request submitted! Please wait for admin approval.");
        setMode("login");
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
      toast.error(err.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-full pointer-events-none">
        <div className="absolute top-1/4 left-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-brand-secondary/10 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 bg-white flex items-center justify-center rounded-2xl shadow-2xl mb-4 rotate-3 group hover:rotate-0 transition-transform duration-500">
            <ShieldCheck className="w-10 h-10 text-zinc-950" />
          </div>
          <h1 className="text-3xl font-serif tracking-tight text-white mb-1">PurchaseTracker</h1>
          <p className="text-zinc-500 text-sm tracking-widest uppercase font-bold">Enterprise Procurement Hub</p>
        </div>

        {/* Main Card */}
        <div className="glass-card p-8 relative border border-white/5 shadow-2xl overflow-hidden">
          <div className="flex gap-4 mb-8">
            <button 
              onClick={() => { setMode("login"); setError(null); }}
              className={`flex-1 py-3 rounded-xl text-sm font-bold tracking-wider transition-all flex items-center justify-center gap-2 ${mode === "login" ? "bg-white text-zinc-950 shadow-lg" : "text-zinc-500 hover:text-white"}`}
            >
              <LogIn className="w-4 h-4" /> LOGIN
            </button>
            <button 
              onClick={() => { setMode("register"); setError(null); }}
              className={`flex-1 py-3 rounded-xl text-sm font-bold tracking-wider transition-all flex items-center justify-center gap-2 ${mode === "register" ? "bg-white text-zinc-950 shadow-lg" : "text-zinc-500 hover:text-white"}`}
            >
              <UserPlus className="w-4 h-4" /> SIGN UP
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <AnimatePresence mode="popLayout">
              {error && (
                <motion.div 
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

              {mode === "register" && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <AuthInput 
                    icon={<Mail className="w-4 h-4" />}
                    label="Work Email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                  <AuthInput 
                    icon={<Phone className="w-4 h-4" />}
                    label="Contact Number"
                    name="contactNumber"
                    type="tel"
                    value={formData.contactNumber}
                    onChange={handleInputChange}
                    required
                  />
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest flex items-center gap-2">
                      <Building2 className="w-3 h-3" /> Department
                    </label>
                    <select 
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all text-sm appearance-none"
                    >
                      <option value="" disabled className="bg-zinc-900">Select Department</option>
                      <option value="Finance" className="bg-zinc-900">Finance</option>
                      <option value="IT" className="bg-zinc-900">IT</option>
                      <option value="Operations" className="bg-zinc-900">Operations</option>
                      <option value="Logistics" className="bg-zinc-900">Logistics</option>
                      <option value="Marketing" className="bg-zinc-900">Marketing</option>
                      <option value="Procurement" className="bg-zinc-900">Procurement</option>
                    </select>
                  </div>
                </motion.div>
              )}

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
              className="w-full py-4 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl font-bold tracking-widest text-sm mt-6 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {mode === "login" ? "ACCESS HUB" : "SUBMIT REQUEST"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {mode === "login" && (
            <p className="mt-8 text-center text-zinc-600 text-[10px] italic">
              Enterprise system. Access is monitored and logged.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function AuthInput({ label, icon, ...props }: any) {
  return (
    <div className="space-y-1.5 focus-within:translate-x-1 transition-transform">
      <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest flex items-center gap-2">
        {icon} {label}
      </label>
      <input 
        {...props}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all text-sm placeholder:text-zinc-700"
        placeholder={`Enter your ${label.toLowerCase()}...`}
      />
    </div>
  );
}
