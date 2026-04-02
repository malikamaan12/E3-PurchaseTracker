"use client";

import { 
  Bell, 
  Search, 
  HelpCircle, 
  PlusCircle, 
  Calendar,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import CreateRequestModal from "@/components/requests/CreateRequestModal";

export default function TopNav() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const today = new Date();

  return (
    <>
      <header className="h-20 border-b border-white/5 bg-zinc-950/50 backdrop-blur-xl px-12 flex items-center sticky top-0 z-40">
        <div className="flex items-center gap-4 text-zinc-400">
          <Calendar className="w-4 h-4 text-brand-primary" />
          <span className="text-xs font-bold tracking-widest uppercase">
            {format(today, "EEEE, dd MMM yyyy")}
          </span>
        </div>

        <div className="flex-1 flex justify-center px-24">
          <div className="w-full max-w-xl group relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-brand-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Search vendor database, request IDs, or audit logs..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-12 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:bg-white/10 transition-all"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md border border-white/10 bg-white/5 text-[10px] text-zinc-600 font-bold">
              ⌘ K
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex gap-2">
            <button className="p-2.5 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white transition-all relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-brand-primary rounded-full border-2 border-zinc-950" />
            </button>
            <button className="p-2.5 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white transition-all">
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="h-8 w-px bg-white/10" />

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
          // If we are on the requests page, we might want to refresh the list
          if (window.location.pathname === '/dashboard/requests') {
            window.location.reload();
          }
        }} 
      />
    </>
  );
}
