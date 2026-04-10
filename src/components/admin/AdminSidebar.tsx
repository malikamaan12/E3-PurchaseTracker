"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Users, 
  FileText, 
  Settings, 
  Activity, 
  FolderTree, 
  Shield, 
  ChevronRight, 
  BarChart, 
  Building2,
  PanelLeftClose,
  PanelLeft,
  Archive
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { name: "Overview", path: "/dashboard/admin", icon: Activity },
  { name: "Enterprise Backups", path: "/dashboard/admin/backups", icon: Archive },
  { name: "User Management", path: "/dashboard/admin/users", icon: Users },
  { name: "Account Requests", path: "/dashboard/admin/account-requests", icon: Shield },
  { name: "Departments", path: "/dashboard/admin/departments", icon: Building2 },
  { name: "Catalog Management", path: "/dashboard/admin/catalog", icon: FolderTree },
  { name: "Project Management", path: "/dashboard/admin/sub-purposes", icon: Activity },
  { name: "Vendor Management", path: "/dashboard/admin/vendors", icon: FileText },
  { name: "PDF Settings", path: "/dashboard/admin/pdf-settings", icon: Settings },
  { name: "Export Diagnostics", path: "/dashboard/admin/diagnostics", icon: Activity },
  { name: "Department Analytics", path: "/dashboard/admin/analytics", icon: BarChart },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem("admin_sidebar_collapsed");
    if (saved === "true") setIsCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("admin_sidebar_collapsed", String(next));
  };

  if (!isMounted) return null;

  return (
    <motion.div 
      initial={false}
      animate={{ width: isCollapsed ? 80 : 260 }}
      className="flex flex-col gap-2 relative h-full"
    >
      <div className={cn(
        "mb-6 flex items-center justify-between",
        isCollapsed ? "flex-col gap-4" : "flex-row"
      )}>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col"
          >
            <h2 className="text-xl font-serif font-bold text-foreground tracking-tight">Admin Console</h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">System Configuration</p>
          </motion.div>
        )}
        
        <button 
          onClick={toggleCollapse}
          className="p-2 rounded-xl bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all active-scale"
          title={isCollapsed ? "Expand Console" : "Collapse Console"}
        >
          {isCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </button>
      </div>
      
      <div className="flex flex-col gap-1.5">
        {adminNavItems.map((item) => {
          const isActive = pathname === item.path;
          
          return (
            <Link key={item.path} href={item.path}>
              <div className={cn(
                "relative flex items-center p-3 rounded-2xl cursor-pointer transition-all duration-300 group overflow-hidden whitespace-nowrap",
                isActive 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                isCollapsed ? "justify-center" : "gap-3"
              )}>
                {isActive && (
                  <motion.div 
                    layoutId="admin-active-nav"
                    className="absolute inset-0 bg-primary/5 rounded-2xl pointer-events-none" 
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                
                <div className={cn(
                  "p-2 rounded-xl transition-all duration-300 relative z-10 shrink-0",
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground group-hover:text-foreground group-hover:bg-primary/10'
                )}>
                  <item.icon className="w-4 h-4" />
                </div>
                
                {!isCollapsed && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="font-semibold text-sm flex-1 relative z-10 truncate"
                  >
                    {item.name}
                  </motion.div>
                )}

                {!isCollapsed && isActive && (
                   <ChevronRight className="w-4 h-4 text-primary relative z-10 shrink-0" />
                )}

                {isCollapsed && (
                  <div className="absolute left-full ml-6 px-3 py-2 bg-card border border-border rounded-xl text-xs font-bold text-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl whitespace-nowrap">
                    {item.name}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}
