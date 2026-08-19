"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  FileText, 
  Users, 
  PieChart, 
  ShieldCheck, 
  Settings,
  ChevronRight,
  Zap
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/AuthContext"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  onItemClick?: () => void;
}

export function Sidebar({ className, onItemClick, ...props }: SidebarProps) {
  const pathname = usePathname()
  const { isAdmin, isApprover } = useAuth()

  const navItems = [
    { name: "Purchases", path: "/dashboard/requests", icon: <FileText className="w-5 h-5" /> },
    { name: "Vendors", path: "/dashboard/vendors", icon: <Users className="w-5 h-5" /> },
    { name: "Analytics", path: "/dashboard/analytics", icon: <PieChart className="w-5 h-5" /> },
    { name: "Compliance", path: "/dashboard/compliance", icon: <ShieldCheck className="w-5 h-5" /> },
    ...(isAdmin ? [
      { name: "Admin", path: "/dashboard/admin", icon: <Settings className="w-5 h-5" /> }
    ] : []),
  ];

  return (
    <div className={cn("flex flex-col h-full bg-card border-r border-border/50 shadow-2xl transition-all duration-300", className)} {...props}>
      <div className="flex flex-col flex-1 gap-4 p-6">
        {/* Brand Header (Desktop Only, hidden on drawer) */}
        {!onItemClick && (
          <div className="mb-8 px-2">
            <Link href="/dashboard" className="flex items-center group">
              <img src="/logo-color.png" alt="E3" className="h-8 w-auto dark:hidden transition-transform group-hover:scale-105" />
              <img src="/logo-white.png" alt="E3" className="h-8 w-auto hidden dark:block transition-transform group-hover:scale-105" />
            </Link>
          </div>
        )}

        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
            
            return (
              <Link 
                key={item.path} 
                href={item.path}
                onClick={onItemClick}
                className="block"
              >
                <div className={cn(
                  "group relative flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 min-h-[44px] touch-target w-full",
                  isActive
                    ? "bg-brand-primary/10 text-brand-primary font-bold shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}>
                  {/* Active Indicator Bar */}
                  {isActive && (
                    <div
                      className="absolute left-0 w-1 h-6 bg-brand-primary rounded-r-full"
                    />
                  )}
                  
                  <div className={cn(
                    "transition-transform duration-200 group-hover:scale-105 shrink-0",
                    isActive ? "text-brand-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    {item.icon}
                  </div>
                  
                  <span className="flex-1 text-sm font-semibold tracking-tight">{item.name}</span>
                  
                  {isActive && <ChevronRight className="w-4 h-4 opacity-50 shrink-0" />}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / System Status */}
      <div className="p-4 sm:p-6 border-t border-border/20 pb-safe">
         <div className="p-3.5 rounded-2xl border border-border bg-secondary/30">
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">System Operational Status</p>
            <div className="flex items-center gap-2">
               <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full w-[98%] bg-emerald-500 rounded-full" />
               </div>
               <span className="text-xs font-mono font-bold text-foreground">98%</span>
            </div>
         </div>
      </div>
    </div>
  )
}
