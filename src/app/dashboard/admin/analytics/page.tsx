"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import dynamic from "next/dynamic";

const EntityUtilizationChart = dynamic(() => import("@/components/admin/EntityUtilizationChart"), {
  ssr: false,
  loading: () => <div className="h-80 flex items-center justify-center text-muted-foreground text-xs font-black uppercase tracking-[0.2em] animate-pulse">Loading Chart...</div>
});
import { PieChart as PieChartIcon, TrendingUp, Building2, DownloadCloud, Printer, ArrowUpRight, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { usePageTitle } from "@/lib/hooks/usePageTitle";

export default function DepartmentAnalyticsPage() {
  usePageTitle("Department Analytics");
  const { user, isLoading: isAuthLoading } = useAuth();
  
  const { data: analyticsGroups, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin_analytics"],
    queryFn: () => apiClient.admin.analytics.get(),
    enabled: !!user && !isAuthLoading
  });

  if (isError) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-2">
          <div>
            <h1 className="text-4xl font-serif font-black text-foreground tracking-tight flex items-center gap-3">
               <TrendingUp className="w-8 h-8 text-emerald-500" />
               Department Analytics
            </h1>
            <p className="text-sm text-muted-foreground mt-2 font-medium">Comprehensive budget distribution and cross-departmental utilization metrics.</p>
          </div>
        </div>
        <div className="p-8 bg-destructive/10 border border-destructive/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-destructive">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Analytics data is temporarily unavailable.</p>
              <p className="text-xs text-muted-foreground mt-0.5">{(error as any)?.message || "Failed to load departmental analytics. Please try again."}</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-destructive/20 hover:bg-destructive/30 text-destructive text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const summary = (analyticsGroups as any)?.summary;
  const stats = (analyticsGroups as any)?.departmental || [];
  const colors = ["hsl(var(--brand-primary))", "hsl(var(--brand-secondary))", "#F59E0B", "#EF4444", "#10B981", "#06b6d4"];

  const maxCost = Math.max(...(stats.length ? stats.map((s: any) => s.committedAmount ?? s.totalCost) : [1]));
  const totalCommitted = summary?.committedAmount ?? stats.reduce((acc: number, curr: any) => acc + (curr.committedAmount ?? curr.totalCost ?? 0), 0);
  const totalDisbursed = summary?.disbursedAmount ?? stats.reduce((acc: number, curr: any) => acc + (curr.disbursedAmount ?? 0), 0);
  const activeDeptCount = summary?.activeDepartments ?? stats.length;

  const handlePrint = () => {
    toast.message("Executive Summary", {
      description: "Generating formal PDF report of departmental financial commitments...",
    });

    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then(({ default: autoTable }) => {
        const doc = new jsPDF();
        const dateStr = new Date().toLocaleDateString();

        // Title
        doc.setFontSize(20);
        doc.text("Executive Financial Report", 14, 22);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${dateStr}`, 14, 30);

        // High Level Stats
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Overview", 14, 45);

        autoTable(doc, {
          startY: 50,
          head: [['Committed & Authorized (QAR)', 'Disbursed / Paid (QAR)', 'Active Departments']],
          body: [
            [
              totalCommitted.toLocaleString(),
              totalDisbursed.toLocaleString(),
              stats.length.toString()
            ]
          ],
          theme: 'grid',
          headStyles: { fillColor: [16, 185, 129] }
        });

        // Departmental Table
        doc.text("Departmental Breakdown", 14, (doc as any).lastAutoTable.finalY + 15);
        
        const deptBody = stats
          .sort((a: any, b: any) => (b.committedAmount ?? b.totalCost) - (a.committedAmount ?? a.totalCost))
          .map((stat: any) => [
            stat.department,
            stat.count.toString(),
            `${(stat.committedAmount ?? stat.totalCost).toLocaleString()} QAR`,
            `${(stat.disbursedAmount ?? 0).toLocaleString()} QAR`
          ]);

        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 20,
          head: [['Department', 'Requests', 'Committed Value', 'Disbursed Amount']],
          body: deptBody,
          theme: 'striped',
          headStyles: { fillColor: [16, 185, 129] }
        });

        // Projects (if available)
        const projects = (analyticsGroups as any)?.projects || [];
        if (projects.length > 0) {
          doc.addPage();
          doc.setFontSize(14);
          doc.text("Project Financial Utilization", 14, 22);

          const projectBody = projects.map((p: any) => [
            p.projectName,
            `${p.totalBudget.toLocaleString()} QAR`,
            `${p.spent.toLocaleString()} QAR`,
            `${Math.round((p.spent / p.totalBudget) * 100)}%`
          ]);

          autoTable(doc, {
            startY: 30,
            head: [['Project Name', 'Total Budget', 'Committed Exposure', 'Utilization']],
            body: projectBody,
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246] }
          });
        }

        doc.save(`Executive_Report_${dateStr.replace(/\//g, '-')}.pdf`);
        toast.success("PDF Report generated successfully");
      });
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-2">
        <div>
          <h1 className="text-4xl font-serif font-black text-foreground tracking-tight flex items-center gap-3">
             <TrendingUp className="w-8 h-8 text-emerald-500" />
             Department Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-2 font-medium">Comprehensive budget distribution and cross-departmental utilization metrics.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 bg-secondary/80 text-foreground font-black px-6 py-2.5 rounded-2xl border border-border hover:bg-secondary transition-all group"
          >
            <Printer className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Executive Export
          </button>
          <div className="bg-emerald-500/10 p-2.5 rounded-2xl border border-emerald-500/20">
            <PieChartIcon className="w-5 h-5 text-emerald-500" />
          </div>
        </div>
      </div>

      {/* High Level Stats Bento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <motion.div 
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           className="glass p-6 rounded-3xl border border-border/40 shadow-xl"
         >
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Committed & Authorized Value</p>
            <div className="flex items-end gap-2 mt-2">
               <h3 className="text-3xl font-serif font-black text-foreground">QAR {totalCommitted.toLocaleString()}</h3>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold italic">Active procurement across {activeDeptCount} departments</p>
         </motion.div>
         <motion.div 
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ delay: 0.1 }}
           className="glass p-6 rounded-3xl border border-border/40 shadow-xl"
         >
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Disbursed / Paid Out</p>
            <h3 className="text-3xl font-serif font-black text-foreground mt-2 tracking-tight">QAR {totalDisbursed.toLocaleString()}</h3>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold italic uppercase tracking-tighter">Settled payment installments</p>
         </motion.div>
         <motion.div 
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ delay: 0.2 }}
           className="glass p-6 rounded-3xl border border-border/40 shadow-xl"
         >
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Active Departments</p>
            <h3 className="text-3xl font-serif font-black text-foreground mt-2 tracking-tight">{activeDeptCount}</h3>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold italic font-mono uppercase tracking-tighter">Registered cost centers</p>
         </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass p-10 rounded-[2.5rem] border border-border/40 space-y-8 shadow-2xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 blur-[100px] rounded-full -mr-32 -mt-32" />
           
           <div className="flex justify-between items-center relative">
               <div className="flex gap-3 items-center">
                   <div className="w-10 h-10 rounded-2xl bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
                      <Building2 className="w-6 h-6 text-brand-primary" />
                   </div>
                   <div>
                      <h2 className="text-xl font-black text-foreground leading-none">Entity Utilization</h2>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Request volume intensity</p>
                   </div>
               </div>
           </div>
           
           {isLoading ? (
             <div className="h-80 flex flex-col items-center justify-center gap-4">
               <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Computing Matrix...</p>
             </div>
           ) : stats.length > 0 ? (
             <div className="h-80 relative">
               <EntityUtilizationChart stats={stats} />
             </div>
           ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground text-xs font-black uppercase tracking-[0.2em] border border-dashed border-border rounded-3xl">Data Reservoir Empty</div>
           )}
        </div>

        <div className="glass p-10 rounded-[2.5rem] border border-border/40 space-y-8 shadow-2xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full -mr-32 -mt-32" />

           <div className="flex justify-between items-center relative">
               <div className="flex gap-3 items-center">
                   <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                      <TrendingUp className="w-6 h-6 text-emerald-500" />
                   </div>
                   <div>
                      <h2 className="text-xl font-black text-foreground leading-none">Committed Allocation</h2>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Departmental committed exposure</p>
                   </div>
               </div>
           </div>
           
           {isLoading ? (
             <div className="h-80 flex items-center justify-center">
               <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
             </div>
           ) : stats.length > 0 ? (
             <div className="space-y-6 pt-4 relative">
               {stats.sort((a: any, b: any) => (b.committedAmount ?? b.totalCost) - (a.committedAmount ?? a.totalCost)).slice(0, 6).map((stat: any, i: number) => (
                 <div key={i} className="group/row">
                   <div className="flex justify-between text-[11px] mb-2 font-black uppercase tracking-widest">
                     <span className="text-foreground group-hover/row:text-brand-primary transition-colors">{stat.department}</span>
                     <span className="text-muted-foreground">QAR {(stat.committedAmount ?? stat.totalCost).toLocaleString()}</span>
                   </div>
                   <div className="h-2.5 bg-secondary/50 rounded-full overflow-hidden border border-border/30">
                     <motion.div 
                       initial={{ width: 0 }}
                       animate={{ width: `${((stat.committedAmount ?? stat.totalCost) / maxCost) * 100}%` }}
                       transition={{ duration: 1.5, ease: "easeOut", delay: i * 0.1 }}
                       className="h-full rounded-full transition-all relative"
                       style={{ 
                         backgroundColor: colors[i % colors.length],
                         boxShadow: `0 0 15px ${colors[i % colors.length]}40`
                       }}
                     >
                       <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
                     </motion.div>
                   </div>
                 </div>
               ))}
               {stats.length > 6 && (
                 <p className="text-[9px] text-center font-black text-muted-foreground uppercase mt-4 tracking-[0.3em]">+ {stats.length - 6} more entities in ledger</p>
               )}
             </div>
           ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground text-xs font-black uppercase tracking-[0.2em] border border-dashed border-border rounded-3xl italic">Awaiting Financial Inputs</div>
           )}
        </div>
      </div>
    </div>
  );
}
