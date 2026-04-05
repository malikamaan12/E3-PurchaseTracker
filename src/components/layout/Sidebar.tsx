"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  FileText, 
  Users, 
  PieChart, 
  LogOut, 
  Layers,
  ChevronRight,
  Settings,
  ShieldCheck
} from "lucide-react";
import { motion } from "framer-motion";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function Sidebar() {
  const pathname = usePathname();
  const { user, isAdmin, isApprover } = useAuth();

  const handleLogout = async () => {
    try {
      await apiClient.auth.logout();
      toast.success("Successfully logged out");
      window.location.href = "/auth";
    } catch (error: any) {
      toast.error("Logout failed: " + error.message);
    }
  };

  // Build nav items based on role
  const navItems = [
    { name: "Purchases", path: "/dashboard/requests", icon: <FileText className="w-5 h-5" /> },
    { name: "Vendors", path: "/dashboard/vendors", icon: <Users className="w-5 h-5" /> },
    // Analytics visible to admin and approver departments
    ...(isAdmin || isApprover ? [
      { name: "Analytics", path: "/dashboard/analytics", icon: <PieChart className="w-5 h-5" /> }
    ] : []),
    // Admin panel — admin only
    ...(isAdmin ? [
      { name: "Admin Panel", path: "/dashboard/admin", icon: <Settings className="w-5 h-5" /> }
    ] : []),
  ];

  // Initials from username
  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : "??";

  return (
    <aside className="w-72 bg-background border-r border-border flex flex-col h-screen fixed left-0 top-0 z-50 transition-colors duration-300">
      {/* Brand Header */}
      <div className="p-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shadow-lg shadow-brand-primary/20">
          <Layers className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="font-serif text-xl font-bold text-foreground tracking-tighter uppercase leading-none">E3 Hub</h1>
          <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mt-0.5">Procurement</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
          return (
            <Link key={item.path} href={item.path}>
              <div className={`group relative flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}>
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
      <div className="p-6 mt-auto border-t border-border mx-2">
        <div className="flex items-center justify-between mb-4 px-2">
           <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">System Theme</p>
           <ThemeToggle />
        </div>

        <div className="glass-card p-4 mb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center text-[10px] font-bold text-brand-primary uppercase">
              {initials}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-bold text-foreground truncate">{user?.username || "Loading..."}</p>
              <p className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase truncate">
                {user?.department || "—"}
              </p>
            </div>
            {isAdmin && (
              <ShieldCheck className="w-4 h-4 text-brand-primary flex-shrink-0" />
            )}
            {!isAdmin && isApprover && (
              <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            )}
          </div>
        </div>
        
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/5 transition-all group lg"
        >
          <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-semibold">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
