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

export default function TopNav() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const today = new Date();

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

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
      <header className="h-20 border-b border-border bg-background/80 backdrop-blur-xl px-12 flex items-center sticky top-0 z-40 transition-colors duration-300">
        <div className="flex items-center gap-4 text-muted-foreground">
          <Calendar className="w-4 h-4 text-brand-primary" />
          <span className="text-xs font-bold tracking-widest uppercase">
            {format(today, "EEEE, dd MMM yyyy")}
          </span>
        </div>

        <div className="flex-1 flex justify-center px-24">
          <div className="w-full max-w-xl group relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-brand-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Search vendor database, request IDs, or audit logs..."
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
              className={`p-2.5 rounded-xl hover:bg-secondary transition-all relative ${isNotifOpen ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Bell className="w-5 h-5" />
              {unreadStats && unreadStats.count > 0 && (
                <span className="absolute top-2.5 right-2.5 w-4 h-4 bg-brand-primary text-[10px] font-bold text-white flex items-center justify-center rounded-full border-2 border-background">
                  {unreadStats.count}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            <AnimatePresence>
              {isNotifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full right-0 mt-4 w-96 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl"
                >
                  <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Notifications</h3>
                    <button 
                      onClick={() => markAllReadMutation.mutate()}
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
                          <Link 
                            key={notif.id}
                            href={notif.requestId ? `/dashboard/requests/${notif.requestId}` : '#'}
                            onClick={() => setIsNotifOpen(false)}
                            className="p-4 flex gap-4 hover:bg-secondary transition-colors group"
                          >
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
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button className="p-2.5 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-all">
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="h-8 w-px bg-border" />

          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-4 py-2 rounded-xl text-xs font-bold hover:bg-brand-primary/20 transition-all group scale-lg"
          >
            <PlusCircle className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
            New Request
          </button>
        </div>
      </header>

      <CreateRequestModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["requests"] });
          if (window.location.pathname === '/dashboard/requests') {
            // No need to reload, react-query handles it
          }
        }} 
      />
    </>
  );
}

// Minimal XCircle for notifs if not imported
function XCircle({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
    </svg>
  )
}

