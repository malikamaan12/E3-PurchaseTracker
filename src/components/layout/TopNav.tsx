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
import { usePWA } from "@/context/PWAContext";
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
  const { unreadCount } = usePWA();
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
      let link = notif.link || `/dashboard/requests/${notif.requestId || ''}`;
      // Fix old notifications missing the /dashboard prefix
      if (link.startsWith('/') && !link.startsWith('/dashboard')) {
        link = `/dashboard${link}`;
      }
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
    <header className="min-h-[3.5rem] py-2 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-2.5 sm:px-6 lg:px-8 sticky top-0 z-[100] transition-all pt-safe ease-spring">
      <div className="flex items-center gap-2 sm:gap-4 lg:gap-8 shrink-0 min-w-0">
        {/* MOBILE TRIGGER */}
        <div className="lg:hidden shrink-0">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Open navigation menu"
                className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl bg-secondary/50 hover:bg-secondary text-foreground transition-all active-scale touch-target"
              >
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 border-none bg-card shadow-2xl">
              <Sidebar onItemClick={() => setIsMobileMenuOpen(false)} className="w-full h-full" />
            </SheetContent>
          </Sheet>
        </div>

        {/* E3 BRANDING LOGO */}
        <Link href="/dashboard" className="flex items-center shrink-0">
          <img src="/logo-color.png" alt="E3" className="h-7 sm:h-8 max-w-[85px] sm:max-w-[120px] object-contain dark:hidden transition-transform hover:scale-105" />
          <img src="/logo-white.png" alt="E3" className="h-7 sm:h-8 max-w-[85px] sm:max-w-[120px] object-contain hidden dark:block transition-transform hover:scale-105" />
        </Link>

        {/* MAIN NAVIGATION (DESKTOP) */}
        <nav className="hidden lg:flex items-center gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={(e) => {
                  if (pathname === item.path) {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors pointer-events-auto",
                  isActive
                    ? "bg-secondary text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
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
              onClick={(e) => {
                if (pathname === "/dashboard/admin") {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ml-2 border-l border-border pl-4 pointer-events-auto",
                pathname.startsWith("/dashboard/admin")
                  ? "bg-secondary text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <ShieldCheck className="w-4 h-4" />
              Admin
            </Link>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 lg:gap-4">
        {/* Global Command Palette Trigger */}
        <button
          onClick={() => {
            const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true });
            document.dispatchEvent(event);
          }}
          aria-label="Search system"
          className="flex items-center gap-2 p-2 sm:p-2.5 md:px-3 md:py-1.5 rounded-xl md:rounded-lg border border-border bg-secondary/30 text-xs text-muted-foreground hover:bg-secondary/60 transition-all touch-target md:min-h-[32px] md:min-w-fit group"
          title="Global Command Palette (Cmd+K / Ctrl+K)"
        >
          <Search className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="hidden md:inline font-medium">Search system...</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-bold bg-secondary rounded border border-border text-foreground font-mono">⌘K</kbd>
        </button>

        <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            className={cn(
              "p-2 sm:p-2.5 rounded-xl md:rounded-lg transition-all relative group hover:bg-secondary/50 touch-target md:min-h-[36px] md:min-w-[36px] flex items-center justify-center",
              isNotifOpen ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-primary px-1 text-[10px] font-semibold text-primary-foreground shadow-sm ring-2 ring-background">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* NOTIFICATION PORTAL */}
          {isNotifOpen && createPortal(
            <div className="fixed inset-0 z-[99999] pointer-events-none">
              <div
                ref={portalRef}
                className="absolute pointer-events-auto bg-card border border-border rounded-2xl shadow-2xl overflow-hidden w-[90vw] max-w-[380px] animate-fade-scale-in"
                style={{
                  top: notifRef.current ? notifRef.current.getBoundingClientRect().bottom + 12 : '80px',
                  right: notifRef.current ? Math.max(16, window.innerWidth - notifRef.current.getBoundingClientRect().right) : '16px'
                }}
              >
                <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Intelligence Alerts</h3>
                  <button
                    onClick={() => markAllReadMutation.mutate()}
                    className="text-[11px] font-bold text-brand-primary hover:text-brand-primary/80 transition-colors uppercase tracking-wider"
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
                      <p className="text-xs font-semibold text-muted-foreground opacity-60">Zero Pending Alerts</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/10">
                      {notifications.map((notif: any) => (
                        <button
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className="w-full text-left p-4 hover:bg-secondary/50 transition-colors group flex gap-3.5"
                        >
                          <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0">
                             <Bell className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className="text-xs font-bold text-foreground truncate">{notif.title}</p>
                             <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{notif.message}</p>
                             <p className="text-[10px] font-mono opacity-50 mt-1">
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

          {/* Desktop-Only Quick Controls */}
          <div className="hidden md:flex items-center gap-1.5">
            <button
              onClick={() => setHighPerformanceMode(!highPerformanceMode)}
              aria-label={highPerformanceMode ? "Disable High Performance Mode" : "Enable High Performance Mode"}
              className={cn(
                 "p-2 rounded-lg transition-all hover:bg-secondary/50 min-h-[36px] min-w-[36px] flex items-center justify-center",
                 highPerformanceMode ? "text-amber-500" : "text-muted-foreground hover:text-foreground"
              )}
              title="Performance Mode"
            >
              <Zap className={cn("w-4 h-4", highPerformanceMode && "fill-current")} />
            </button>

            <PWASettings />
            <ThemeToggle />
          </div>
        </div>

        {/* User Avatar - Mobile opens NavigationSheet, Desktop shows full info & Logout */}
        <div className="flex items-center gap-2">
          {/* Mobile Profile Trigger Button (44x44) */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open profile and system menu"
            className="md:hidden w-11 h-11 rounded-xl bg-secondary/70 border border-border flex items-center justify-center text-foreground touch-target active-scale"
          >
            {getDepartmentIcon(user?.department)}
          </button>

          {/* Desktop User Information & Logout */}
          <div className="hidden md:flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-foreground shrink-0">
              {getDepartmentIcon(user?.department)}
            </div>
            <div className="hidden xl:block ml-1">
               <p className="text-[13px] font-medium text-foreground leading-tight">{user?.username || "Guest Operator"}</p>
               <div className="flex items-center gap-1 opacity-60">
                  <span className="text-[11px] font-medium tracking-tight text-muted-foreground">{user?.department || "Unassigned Entity"}</span>
               </div>
            </div>
            <button
              onClick={handleLogout}
              aria-label="Sign out of system"
              className="p-2 ml-1 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

