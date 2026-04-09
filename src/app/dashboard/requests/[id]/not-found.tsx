import Link from "next/link";
import { FileSearch, ChevronLeft, Landmark } from "lucide-react";

export default function RequestNotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="glass-card max-w-lg w-full p-12 text-center border-amber-500/20 shadow-2xl shadow-amber-500/10 relative overflow-hidden">
        {/* Decorative Header */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-[#5B4B8A] to-amber-500 opacity-30" />
        
        <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-amber-500/20">
          <FileSearch className="w-10 h-10 text-amber-500" />
        </div>

        <h1 className="text-2xl font-black text-foreground uppercase tracking-tighter mb-4">
          Record Not Materialized
        </h1>
        
        <p className="text-muted-foreground text-sm leading-relaxed mb-8">
          The procurement record you are attempting to access could not be located in the current ledger. 
          This may be due to an obsolete reference, recent archival by the department, or an erroneous index link.
        </p>

        <Link
          href="/dashboard/requests"
          className="inline-flex items-center gap-2 bg-foreground text-background px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-xl mx-auto"
        >
          <ChevronLeft className="w-4 h-4" />
          Return to Procurement Registry
        </Link>
        
        <div className="mt-12 flex items-center justify-center gap-4 opacity-40">
           <Landmark className="w-4 h-4 text-muted-foreground" />
           <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">E3 Central Ledger</span>
        </div>
      </div>
    </div>
  );
}
