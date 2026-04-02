"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  FileText, 
  Users, 
  PieChart, 
  ShieldCheck, 
  LogOut, 
  Layers,
  ChevronRight,
  Menu
} from "lucide-react";
import { motion } from "framer-motion";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";

const navItems = [
  { name: "Purchases", path: "/dashboard/requests", icon: <FileText className="w-5 h-5" /> },
  { name: "Vendors", path: "/dashboard/vendors", icon: <Users className="w-5 h-5" /> },
  { name: "Analytics", path: "/dashboard/analytics", icon: <PieChart className="w-5 h-5" /> },
  { name: "Audit Trail", path: "/dashboard/audit", icon: <ShieldCheck className="w-5 h-5" /> },
];

export default function Sidebar() {
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await apiClient.auth.logout();
      toast.success("Successfully logged out");
      window.location.href = "/auth";
    } catch (error: any) {
      toast.error("Logout failed: " + error.message);
    }
  };

  return (
    <aside className="w-72 bg-zinc-950 border-r border-white/5 flex flex-col h-screen fixed left-0 top-0 z-50">
      {/* Brand Header */}
      <div className="p-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shadow-lg shadow-brand-primary/20">
          <Layers className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="font-serif text-xl font-bold text-white tracking-tighter uppercase leading-none">E3 Hub</h1>
          <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mt-0.5">Procurement</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1 mt-4">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link key={item.path} href={item.path}>
              <div className={`group relative flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-white/5 text-white' : 'text-zinc-500 hover:text-white hover:bg-white/[0.02]'}`}>
                {isActive && (
                  <motion.div 
                    layoutId="active-nav"
                    className="absolute left-0 w-1 h-6 bg-brand-primary rounded-r-full"
                  />
                )}
                <span className={`transition-transform duration-300 ${isActive ? 'scale-110 text-brand-primary' : 'group-hover:scale-110'}`}>
                  {item.icon}
                </span>
                <span className="font-semibold tracking-tight">{item.name}</span>
                {isActive && <ChevronRight className="ml-auto w-4 h-4 opacity-50" />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer / Account */}
      <div className="p-6 mt-auto border-t border-white/5 mx-2">
        <div className="glass p-4 rounded-2xl border border-white/10 mb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center text-[10px] font-bold text-brand-primary uppercase">
              AD
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate">Administrator</p>
              <p className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase">IT Department</p>
            </div>
          </div>
        </div>
        
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:text-rose-500 hover:bg-rose-500/5 transition-all group lg"
        >
          <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-semibold">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
