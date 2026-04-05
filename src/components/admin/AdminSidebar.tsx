"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, FileText, Settings, Activity, FileCheck, Shield, ChevronRight, BarChart, Building2 } from "lucide-react";
import { motion } from "framer-motion";

const adminNavItems = [
  { name: "Overview", path: "/dashboard/admin", icon: Activity },
  { name: "User Management", path: "/dashboard/admin/users", icon: Users },
  { name: "Account Requests", path: "/dashboard/admin/account-requests", icon: Shield },
  { name: "Departments", path: "/dashboard/admin/departments", icon: Building2 },
  { name: "Sub-purposes", path: "/dashboard/admin/sub-purposes", icon: FileCheck },
  { name: "Vendor Management", path: "/dashboard/admin/vendors", icon: FileText },
  { name: "PDF Settings", path: "/dashboard/admin/pdf-settings", icon: Settings },
  { name: "Export Diagnostics", path: "/dashboard/admin/diagnostics", icon: Activity },
  { name: "Department Analytics", path: "/dashboard/admin/analytics", icon: BarChart },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-2">
      <div className="mb-4">
        <h2 className="text-xl font-serif font-bold text-foreground tracking-tight">Admin Console</h2>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">System Configuration</p>
      </div>
      
      {adminNavItems.map((item) => {
        const isActive = pathname === item.path;
        
        return (
          <Link key={item.path} href={item.path}>
            <div className={`
              relative flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-300 group
              ${isActive 
                ? 'bg-primary/10 text-primary' 
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}
            `}>
              {isActive && (
                <motion.div 
                  layoutId="admin-active-nav"
                  className="absolute inset-0 bg-primary/5 rounded-2xl pointer-events-none" 
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              
              <div className={`p-2 rounded-xl transition-all duration-300 relative z-10 ${isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground group-hover:text-foreground group-hover:bg-primary/10'}`}>
                <item.icon className="w-4 h-4" />
              </div>
              
              <div className="font-semibold text-sm flex-1 relative z-10">
                {item.name}
              </div>

              {isActive && (
                 <ChevronRight className="w-4 h-4 text-primary relative z-10" />
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
