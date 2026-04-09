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
  Loader2
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { motion, AnimatePresence } from "framer-motion";
import CreateRequestModal from "@/components/requests/CreateRequestModal";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { 
  FileText, Users, PieChart, Settings, ShieldCheck, LogOut, FileSpreadsheet, Zap,
  XCircle 
} from "lucide-react";
import { usePerformance } from "@/context/PerformanceContext";

export default function TopNav() {
  const { highPerformanceMode, setHighPerformanceMode } = usePerformance();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const today = new Date();
  const pathname = usePathname();
  const { user, isAdmin, isApprover } = useAuth();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const handleLogout = async () => {
    try {
      await apiClient.auth.logout();
      toast.success("Successfully logged out");
      window.location.href = "/login";
    } catch (error: any) {
      toast.error("Logout failed: " + error.message);
    }
  };

  const navItems = [
    { name: "Purchases", path: "/dashboard/requests", icon: <FileText className="w-4 h-4" /> },
    { name: "Vendors", path: "/dashboard/vendors", icon: <Users className="w-4 h-4" /> },
    ...(isAdmin || isApprover ? [
      { name: "Analytics", path: "/dashboard/analytics", icon: <PieChart className="w-4 h-4" /> }
    ] : []),
    ...(isAdmin ? [
      { name: "Admin", path: "/dashboard/admin", icon: <Settings className="w-4 h-4" /> }
    ] : []),
  ];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PHASE 6: NOTIFICATIONS POLLING & LOGIC
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const { data: unreadStats } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: () => apiClient.notifications.getUnreadCount(),
    refetchInterval: 30000, // Poll every 30s
  });

  const { data: notifications = [], isLoading: isLoadingNotifs } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiClient.notifications.list({ includeRead: false }),
    enabled: isNotifOpen,
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.notifications.markAllRead(),
    onMutate: async () => {
      // Optimistic Reset: Zero count immediately
      await queryClient.cancelQueries({ queryKey: ["notifications-unread-count"] });
      const previousStats = queryClient.getQueryData<any>(["notifications-unread-count"]);
      queryClient.setQueryData(["notifications-unread-count"], { count: 0 });
      return { previousStats };
    },
    onError: (err, variables, context) => {
      if (context?.previousStats) {
        queryClient.setQueryData(["notifications-unread-count"], context.previousStats);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  
  const markReadMutation = useMutation({
    mutationFn: (id: number) => apiClient.notifications.markRead(id),
    onMutate: async (id) => {
      // Optimistic Update: Decrement count immediately
      await queryClient.cancelQueries({ queryKey: ["notifications-unread-count"] });
      const previousStats = queryClient.getQueryData<any>(["notifications-unread-count"]);
      if (previousStats) {
        queryClient.setQueryData(["notifications-unread-count"], {
          ...previousStats,
          count: Math.max(0, previousStats.count - 1)
        });
      }
      return { previousStats };
    },
    onError: (err, id, context) => {
      if (context?.previousStats) {
        queryClient.setQueryData(["notifications-unread-count"], context.previousStats);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handleNotificationClick = async (notif: any) => {
    setIsNotifOpen(false);
    // Mark as read immediately (Promise-based to ensure it starts)
    if (!notif.read) {
      try {
        await markReadMutation.mutateAsync(notif.id);
      } catch (err) {
        console.error("Failed to mark notification as read", err);
      }
    }
    // Navigate manually ensuring mutation has been triggered
    if (notif.requestId) {
      router.push(`/dashboard/requests/${notif.requestId}`);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <header className="h-16 border-b border-border bg-background/80 backdrop-blur-xl px-8 flex items-center sticky top-0 z-50 transition-colors duration-300">
        <div className="flex items-center gap-6 mr-8 min-w-[200px]">
          {/* Replaced pure typography with theme-aware images */}
          <Link href="/dashboard/requests" className="flex items-center">
            <img src="/logo-color.png" alt="E3 PR System" className="h-8 w-auto dark:hidden object-contain" />
            <img src="/logo-white.png" alt="E3 PR System" className="h-8 w-auto hidden dark:block object-contain" />
          </Link>
        </div>

        <nav className="flex items-center gap-1 mr-8">
          {navItems.map((item) => {
            const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
            return (
              <Link key={item.path} href={item.path}>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${isActive ? 'bg-brand-primary/10 text-brand-primary font-bold' : 'text-muted-foreground hover:bg-secondary hover:text-foreground font-semibold'}`}>
                  {item.icon}
                  <span className="text-sm tracking-tight">{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 flex px-4">
          <div className="w-full max-w-md group relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-brand-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Search vendor database, request IDs, or audit logs..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value) {
                  window.location.href = `/dashboard/requests?q=${encodeURIComponent(e.currentTarget.value)}`;
                }
              }}
              className="w-full bg-secondary/50 border border-border rounded-xl px-12 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:bg-secondary transition-all"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md border border-border bg-secondary/80 text-[10px] text-muted-foreground font-bold">
              ⌘ K
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex gap-2 relative" ref={notifRef}>
            <button 
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className={`p-2.5 rounded-xl hover:bg-secondary transition-all relative group ${isNotifOpen ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <div className="relative">
                <Bell className={`w-5 h-5 transition-transform duration-500 ${isNotifOpen ? 'rotate-12' : 'group-hover:rotate-12'}`} />
                {unreadStats && unreadStats.count > 0 && (
                  <>
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-brand-primary rounded-full animate-ping opacity-75" />
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-brand-primary rounded-full border-2 border-background" />
                  </>
                )}
              </div>
              {unreadStats && unreadStats.count > 0 && (
                <div className="absolute top-0 right-0 -mr-1 -mt-1 h-4 min-w-[16px] px-1 bg-brand-primary text-[9px] font-black text-white flex items-center justify-center rounded-full border-2 border-background shadow-lg shadow-brand-primary/20">
                  {unreadStats.count}
                </div>
              )}
            </button>

            {/* Notification Dropdown via Portal to avoid clipping */}
            {isMounted && isNotifOpen && createPortal(
              <div className="fixed inset-0 z-[99999] pointer-events-none">
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute pointer-events-auto bg-card border border-border rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden w-[400px]"
                    style={{ 
                      top: notifRef.current ? notifRef.current.getBoundingClientRect().bottom + 12 : '80px',
                      right: notifRef.current ? window.innerWidth - notifRef.current.getBoundingClientRect().right : '32px'
                    }}
                  >
                    <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
                      <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Notifications</h3>
                      <button 
                        onClick={(e) => { e.stopPropagation(); markAllReadMutation.mutate(); }}
                        className="text-[10px] font-bold text-brand-primary hover:text-brand-primary/80 transition-colors uppercase tracking-tight flex items-center gap-1"
                      >
                        <CheckCheck className="w-3 h-3" /> Mark all read
                      </button>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                      {isLoadingNotifs ? (
                        <div className="p-12 flex flex-col items-center justify-center gap-3">
                          <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
                          <p className="text-[10px] text-muted-foreground font-bold uppercase">Loading alerts...</p>
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="p-12 flex flex-col items-center justify-center gap-4 text-center">
                          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center border border-border text-muted-foreground">
                            <Bell className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-muted-foreground">All caught up!</p>
                            <p className="text-[10px] text-muted-foreground/50 mt-1 uppercase tracking-widest">No new notifications</p>
                          </div>
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {notifications.map((notif: any) => (
                            <button 
                              key={notif.id}
                              onClick={() => handleNotificationClick(notif)}
                              className="w-full text-left p-4 flex gap-4 hover:bg-secondary transition-colors group relative"
                            >
                              {!notif.read && (
                                <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-brand-primary rounded-r-md" />
                              )}
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                                notif.type === 'rejection' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' :
                                notif.type === 'approval_required' ? 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary' :
                                'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                              }`}>
                                {notif.type === 'rejection' ? <XCircle className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-bold text-foreground truncate">{notif.title}</p>
                                  <ExternalLink className="w-3 h-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">{notif.message}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Clock className="w-3 h-3 text-muted-foreground/30" />
                                  <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-tighter">
                                    {formatDistanceToNow(new Date(notif.createdAt))} ago
                                  </span>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>,
              document.body
            )}
            
            <button
              onClick={() => setHighPerformanceMode(!highPerformanceMode)}
              className={`p-2.5 rounded-xl transition-all ${highPerformanceMode ? 'bg-amber-500/10 text-amber-500' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
              title={highPerformanceMode ? "High Performance Mode: ON" : "High Performance Mode: OFF"}
            >
              <Zap className={`w-5 h-5 ${highPerformanceMode ? 'fill-current' : ''}`} />
            </button>

            <ThemeToggle />
          </div>

          <div className="h-8 w-px bg-border" />

          <button 
            onClick={() => apiClient.documents.exportExcel()}
            className="flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-4 py-2 rounded-xl text-xs font-bold hover:bg-brand-primary/20 transition-all group"
          >
            <FileSpreadsheet className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
            Bulk Excel
          </button>

          <div className="h-8 w-px bg-border hidden md:block" />

          {/* User Profile */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center text-[10px] font-bold text-brand-primary uppercase">
              {user?.username?.slice(0, 2).toUpperCase() || "??"}
            </div>
            <div className="hidden xl:block">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-foreground truncate max-w-[100px]">{user?.username}</p>
                {isAdmin ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-brand-primary" />
                ) : isApprover ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                ) : null}
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all ml-1"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

    </>
  );
}

}

