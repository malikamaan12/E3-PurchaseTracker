"use client";

import { 
  Settings, 
  Users, 
  Shield, 
  Database, 
  Bell, 
  Globe, 
  Lock,
  ChevronRight,
  Server,
  Zap
} from "lucide-react";
import { motion } from "framer-motion";

export default function AdminOverviewPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground tracking-tight">Admin Overview</h1>
        <p className="text-sm text-muted-foreground mt-2 font-medium">Comprehensive system configuration and administrative command center.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: "Active Users", value: "24", sub: "+3 today", icon: <Users className="w-5 h-5 text-blue-500" /> },
          { label: "Pending Accounts", value: "5", sub: "Needs Review", icon: <Shield className="w-5 h-5 text-amber-500" /> },
          { label: "Frozen Vendors", value: "2", sub: "Compliance Holds", icon: <Lock className="w-5 h-5 text-rose-500" /> },
          { label: "API Latency", value: "42ms", sub: "Cloudflare Edge", icon: <Globe className="w-5 h-5 text-cyan-500" /> },
        ].map((stat, i) => (
          <div key={i} className="bg-secondary/40 p-5 rounded-2xl border border-border space-y-3 transition-colors">
             <div className="flex justify-between items-start">
               <div className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center">
                 {stat.icon}
               </div>
             </div>
            <div>
              <p className="text-3xl font-serif font-bold text-foreground tracking-tight">{stat.value}</p>
              <div className="flex justify-between items-end mt-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                <p className="text-[10px] text-emerald-500 font-medium uppercase font-bold">{stat.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
