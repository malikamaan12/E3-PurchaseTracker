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

const settingsGroups = [
  {
    title: "System Control",
    items: [
      { name: "General Settings", desc: "Configure global system parameters", icon: <Settings className="w-5 h-5 text-blue-500" /> },
      { name: "Database Console", desc: "Monitor Neon DB connections", icon: <Database className="w-5 h-5 text-emerald-500" /> },
      { name: "Serverless Status", desc: "Vercel runtime diagnostics", icon: <Server className="w-5 h-5 text-purple-500" /> },
    ]
  },
  {
    title: "Access & Security",
    items: [
      { name: "User Management", desc: "Roles, permissions and departments", icon: <Users className="w-5 h-5 text-orange-500" /> },
      { name: "Audit Configuration", desc: "Tracking and logging policies", icon: <Shield className="w-5 h-5 text-indigo-500" /> },
      { name: "Security Keys", desc: "API tokens and JWT management", icon: <Lock className="w-5 h-5 text-rose-500" /> },
    ]
  },
  {
    title: "Integrations",
    items: [
      { name: "SMTP / Notifications", desc: "Email and in-app triggers", icon: <Bell className="w-5 h-5 text-amber-500" /> },
      { name: "R2 Storage", desc: "Cloudflare attachment settings", icon: <Zap className="w-5 h-5 text-cyan-500" /> },
      { name: "Public Portal", desc: "External vendor access", icon: <Globe className="w-5 h-5 text-sky-500" /> },
    ]
  }
];

export default function AdminSettingsPage() {
  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-serif font-bold text-white tracking-tight">Admin Settings</h1>
        <p className="text-sm text-zinc-500 mt-2">Comprehensive system configuration and administrative command center.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {settingsGroups.map((group, idx) => (
          <div key={idx} className="space-y-4">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] px-2">{group.title}</h3>
            <div className="space-y-2">
              {group.items.map((item, i) => (
                <motion.div
                  key={i}
                  whileHover={{ x: 4 }}
                  className="glass p-5 rounded-2xl border border-white/5 hover:border-white/10 hover:bg-white/[0.03] cursor-pointer transition-all flex items-center gap-4 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{item.name}</p>
                    <p className="text-[10px] text-zinc-500 font-medium truncate">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-white transition-colors" />
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Stats / System Health */}
      <div className="glass p-8 rounded-3xl border border-white/5 mt-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-serif font-bold text-white">System Vitality</h3>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest mt-1">Real-time health indicators</p>
          </div>
          <div className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase tracking-widest">
            All Systems Operational
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { label: "Active Users", value: "24", sub: "+3 today" },
            { label: "API Latency", value: "42ms", sub: "Cloudflare Edge" },
            { label: "DB Connections", value: "8/100", sub: "Neon Shared" },
            { label: "Uptime", value: "99.98%", sub: "Last 30 Days" }
          ].map((stat, i) => (
            <div key={i} className="space-y-1">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-serif font-bold text-white">{stat.value}</p>
              <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">{stat.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
