"use client";

import { 
  Bell, 
  Search, 
  HelpCircle, 
  PlusCircle, 
  Calendar,
  Sparkles,
  CheckCheck,
  Clock,
  ExternalLink,
  Loader2,
  Menu,
  FileSpreadsheet,
  Zap,
  XCircle,
  LogOut,
  ShieldCheck,
  ShoppingBag,
  Monitor,
  Rocket,
  Scale,
  Building,
  HardHat,
  Wallet,
  Users2,
  PieChart,
  LayoutDashboard,
  ShieldAlert
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { usePerformance } from "@/context/PerformanceContext";
import { PWASettings } from "./PWASettings";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/Sheet";
import { Sidebar } from "./Sidebar";

const NAV_ITEMS = [
  { name: "Purchases", path: "/dashboard/requests", icon: <ShoppingBag className="w-4 h-4" /> },
  { name: "Vendors", path: "/dashboard/vendors", icon: <Building className="w-4 h-4" /> },
  { name: "Analytics", path: "/dashboard/analytics", icon: <PieChart className="w-4 h-4" /> },
  { name: "Compliance", path: "/dashboard/compliance", icon: <ShieldAlert className="w-4 h-4" /> },
];

export default function TopNav() {
  const { highPerformanceMode, setHighPerformanceMode } = usePerformance();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const { user, isAdmin, isApprover } = useAuth();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const handleLogout = async () => {
    try {
      await apiClient.auth.logout();
      toast.success("Successfully logged out");
      router.push("/login");
    } catch (error: any) {
      toast.error("Logout failed: " + error.message);
    }
  };

  const { data: unreadStats } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: () => apiClient.notifications.getUnreadCount(),
    refetchInterval: 30000,
  });

  const { data: notifications = [], isLoading: isLoadingNotifs } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiClient.notifications.list({ includeRead: false }),
    enabled: isNotifOpen,
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.notifications.markAllRead(),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handleNotificationClick = async (notif: any) => {
    try {
      if (!notif.isRead) {
        await apiClient.notifications.markRead(notif.id);
        queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }
      setIsNotifOpen(false);
      const link = notif.link || `/dashboard/requests/${notif.requestId || ''}`;
      router.push(link);
    } catch (error) {
      console.error("Failed to process notification:", error);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const isInsideTrigger = notifRef.current && notifRef.current.contains(event.target as Node);
      const isInsidePortal = portalRef.current && portalRef.current.contains(event.target as Node);
      
      if (!isInsideTrigger && !isInsidePortal) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getDepartmentIcon = (dept: string = "") => {
    const d = dept.toLowerCase();
    if (d.includes("finance")) return <Wallet className="w-4 h-4" />;
    if (d.includes("it") || d.includes("tech")) return <Monitor className="w-4 h-4" />;
    if (d.includes("hr")) return <Users2 className="w-4 h-4" />;
    if (d.includes("ops") || d.includes("operation")) return <HardHat className="w-4 h-4" />;
    if (d.includes("marketing")) return <Rocket className="w-4 h-4" />;
    if (d.includes("legal")) return <Scale className="w-4 h-4" />;
    if (d.includes("procurement")) return <ShoppingBag className="w-4 h-4" />;
    return <Sparkles className="w-4 h-4" />;
  };

  if (!isMounted) return null;

  return (
    <header className="h-[72px] border-b border-border/10 bg-background/80 backdrop-blur-xl flex items-center justify-between px-6 lg:px-12 sticky top-0 z-[100] transition-all pt-safe">
      <div className="flex items-center gap-10">
        {/* MOBILE TRIGGER */}
        <div className="lg:hidden">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-secondary/50 hover:bg-secondary text-foreground transition-all active-scale">
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 border-none bg-transparent">
              <Sidebar onItemClick={() => setIsMobileMenuOpen(false)} className="w-full h-full" />
            </SheetContent>
          </Sheet>
        </div>

        {/* E3 BRANDING LOGO */}
        <Link href="/dashboard" className="flex items-center group">
          <img src="/logo-color.png" alt="E3" className="h-8 w-auto dark:hidden transition-transform group-hover:scale-105" />
          <img src="/logo-white.png" alt="E3" className="h-8 w-auto hidden dark:block transition-transform group-hover:scale-105" />
        </Link>
        
        {/* MAIN NAVIGATION (DESKTOP) */}
        <nav className="hidden lg:flex items-center gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
            return (
              <Link 
                key={item.path} 
                href={item.path}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active-scale",
                  isActive 
                    ? "bg-brand-primary/10 text-brand-primary border border-brand-primary/20 shadow-[0_4px_12px_-4px_rgba(var(--brand-primary),0.2)]" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {item.icon}
                {item.name}
              </Link>
            );
          })}
          
          {/* Conditional Admin Tab */}
          {isAdmin && (
            <Link 
              href="/dashboard/admin"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active-scale ml-4 border-l border-border/20 pl-6",
                pathname.startsWith("/dashboard/admin") 
                  ? "bg-brand-primary/10 text-brand-primary border border-brand-primary/20 shadow-[0_4px_12px_-4px_rgba(var(--brand-primary),0.2)]" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <ShieldCheck className="w-4 h-4" />
              Admin
            </Link>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        <div className="flex items-center gap-1 lg:gap-2" ref={notifRef}>
          <button 
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className={cn(
              "p-2.5 rounded-xl transition-all relative group active-scale",
              isNotifOpen ? "bg-brand-primary/10 text-brand-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <Bell className="w-5 h-5" />
            {unreadStats && unreadStats.count > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-brand-primary rounded-full border-2 border-background" />
            )}
          </button>

          {/* NOTIFICATION PORTAL */}
          {isNotifOpen && createPortal(
            <div className="fixed inset-0 z-[99999] pointer-events-none">
              <div
                ref={portalRef}
                className="absolute pointer-events-auto bg-card border border-border rounded-2xl shadow-2xl overflow-hidden w-[380px] animate-fade-scale-in"
                style={{ 
                  top: notifRef.current ? notifRef.current.getBoundingClientRect().bottom + 12 : '80px',
                  right: notifRef.current ? window.innerWidth - notifRef.current.getBoundingClientRect().right : '32px'
                }}
              >
                <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground">Intelligence Alerts</h3>
                  <button 
                    onClick={() => markAllReadMutation.mutate()}
                    className="text-[9px] font-black text-brand-primary hover:text-brand-primary/80 transition-colors uppercase tracking-widest"
                  >
                    Archive All
                  </button>
                </div>
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                  {isLoadingNotifs ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-12 text-center">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-40">Zero Pending Alerts</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/10">
                      {notifications.map((notif: any) => (
                        <button 
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className="w-full text-left p-4 hover:bg-secondary/50 transition-colors group flex gap-4"
                        >
                          <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0">
                             <Bell className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className="text-[11px] font-bold text-foreground truncate">{notif.title}</p>
                             <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{notif.message}</p>
                             <p className="text-[8px] font-mono opacity-40 mt-1 uppercase">
                               {notif.createdAt ? (() => {
                                  try {
                                    return formatDistanceToNow(new Date(notif.createdAt));
                                  } catch (e) {
                                    return "recently";
                                  }
                               })() : "recently"} ago
                             </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )}

          <button
            onClick={() => setHighPerformanceMode(!highPerformanceMode)}
            className={cn(
               "p-2.5 rounded-xl transition-all active-scale",
               highPerformanceMode ? "bg-amber-500/10 text-amber-500" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
            title="Performance Mode"
          >
            <Zap className={cn("w-5 h-5", highPerformanceMode && "fill-current")} />
          </button>
          
          <PWASettings />
          <ThemeToggle />
        </div>

        <div className="hidden md:block h-8 w-px bg-border/20 mx-2" />

        <button 
          onClick={() => apiClient.documents.exportExcel()}
          className="hidden md:flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-4 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-primary/20 transition-all active-scale"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Export Intelligence
        </button>

        <div className="h-8 w-px bg-border/20 mx-2" />

        {/* PROFILE */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary active-scale">
            {getDepartmentIcon(user?.department)}
          </div>
          <div className="hidden xl:block">
             <p className="text-xs font-black text-foreground">{user?.username || "Guest Operator"}</p>
             <div className="flex items-center gap-1 opacity-60">
                <span className="text-[9px] font-black uppercase tracking-widest">{user?.department || "Unassigned Entity"}</span>
             </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2.5 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all active-scale"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

