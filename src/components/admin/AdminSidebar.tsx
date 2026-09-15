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
  Archive,
  Mail,
  Bell
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface AdminNavGroup {
  title: string;
  items: { name: string; path: string; icon: any }[];
}

const adminNavGroups: AdminNavGroup[] = [
  {
    title: "Core & Analytics",
    items: [
      { name: "Overview", path: "/dashboard/admin", icon: Activity },
      { name: "Department Analytics", path: "/dashboard/admin/analytics", icon: BarChart },
      { name: "Export Diagnostics", path: "/dashboard/admin/diagnostics", icon: Activity },
    ]
  },
  {
    title: "Organization & Projects",
    items: [
      { name: "Departments", path: "/dashboard/admin/departments", icon: Building2 },
      { name: "Project Management", path: "/dashboard/admin/sub-purposes", icon: Activity },
      { name: "Catalog Management", path: "/dashboard/admin/catalog", icon: FolderTree },
      { name: "Vendor Management", path: "/dashboard/admin/vendors", icon: FileText },
    ]
  },
  {
    title: "Governance & System",
    items: [
      { name: "User Management", path: "/dashboard/admin/users", icon: Users },
      { name: "Account Requests", path: "/dashboard/admin/account-requests", icon: Shield },
      { name: "Email Management", path: "/dashboard/admin/email", icon: Mail },
      { name: "System Alerts", path: "/dashboard/admin/alerts", icon: Bell },
      { name: "Enterprise Backups", path: "/dashboard/admin/backups", icon: Archive },
      { name: "PDF Settings", path: "/dashboard/admin/pdf-settings", icon: Settings },
    ]
  }
];

import { useAuth } from "@/context/AuthContext";

export default function AdminSidebar() {
  const pathname = usePathname();
  const { isSuperAdmin } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const visibleNavGroups = adminNavGroups.filter(
    g => g.title !== "Governance & System" || isSuperAdmin
  );
  const allItems = visibleNavGroups.flatMap(g => g.items);
  const currentItem = allItems.find(i => i.path === pathname) || allItems[0];

  if (!isMounted) return null;

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <motion.div
        initial={false}
        animate={{ width: isCollapsed ? 80 : 260 }}
        className="hidden md:flex flex-col gap-4 relative h-full shrink-0"
      >
        <div className={cn(
          "flex items-center justify-between",
          isCollapsed ? "flex-col gap-4" : "flex-row"
        )}>
          {!isCollapsed && (
            <div className="flex flex-col">
              <h2 className="text-xl font-serif font-bold text-foreground tracking-tight">Admin Console</h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">System Configuration</p>
            </div>
          )}

          <button
            onClick={toggleCollapse}
            aria-label={isCollapsed ? "Expand Admin Sidebar" : "Collapse Admin Sidebar"}
            className="p-2 rounded-xl bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all active-scale"
            title={isCollapsed ? "Expand Console" : "Collapse Console"}
          >
            {isCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">
          {visibleNavGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-1">
              {!isCollapsed && (
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 mb-1 opacity-70">
                  {group.title}
                </span>
              )}
              {group.items.map((item) => {
                const isActive = pathname === item.path;

                return (
                  <Link key={item.path} href={item.path}>
                    <div className={cn(
                      "relative flex items-center p-2.5 rounded-2xl cursor-pointer transition-all duration-200 group overflow-hidden whitespace-nowrap",
                      isActive
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                      isCollapsed ? "justify-center" : "gap-3"
                    )}>
                      <div className={cn(
                        "p-1.5 rounded-xl transition-all relative z-10 shrink-0",
                        isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground group-hover:text-foreground group-hover:bg-primary/10'
                      )}>
                        <item.icon className="w-4 h-4" />
                      </div>

                      {!isCollapsed && (
                        <div className="text-xs flex-1 relative z-10 truncate">
                          {item.name}
                        </div>
                      )}

                      {!isCollapsed && isActive && (
                        <ChevronRight className="w-3.5 h-3.5 text-primary relative z-10 shrink-0" />
                      )}

                      {isCollapsed && (
                        <div className="absolute left-full ml-4 px-3 py-2 bg-card border border-border rounded-xl text-xs font-bold text-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl whitespace-nowrap">
                          {item.name}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </motion.div>

      {/* MOBILE CATEGORIZED SELECTOR */}
      <div className="md:hidden w-full flex flex-col gap-2 shrink-0">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle Admin Navigation Menu"
          className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-card border border-border text-foreground shadow-sm min-h-[48px]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-primary text-primary-foreground shrink-0">
              <currentItem.icon className="w-4 h-4" />
            </div>
            <div className="text-left min-w-0">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Admin Module</span>
              <span className="text-sm font-bold text-foreground truncate block">{currentItem.name}</span>
            </div>
          </div>
          <ChevronRight className={cn("w-5 h-5 text-muted-foreground transition-transform", isMobileMenuOpen && "rotate-90")} />
        </button>

        {/* Expandable Grouped Nav on Mobile */}
        {isMobileMenuOpen && (
          <div className="bg-card border border-border rounded-2xl p-4 shadow-xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            {visibleNavGroups.map((group) => (
              <div key={group.title} className="space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block px-2">
                  {group.title}
                </span>
                <div className="grid grid-cols-1 gap-1">
                  {group.items.map((item) => {
                    const isActive = pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl text-xs font-semibold transition-colors min-h-[44px]",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        )}
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
