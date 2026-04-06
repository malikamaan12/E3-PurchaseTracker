"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Search, 
  Calendar, 
  DollarSign, 
  Users, 
  Snowflake, 
  CircleDot,
  ChevronRight,
  MoreVertical,
  Edit,
  History,
  Lock,
  Unlock,
  Building2,
  Wallet,
  ArrowRight
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import ProjectModal from "@/components/admin/ProjectModal";

/**
 * Admin Projects Management Page
 * High-density interface for managing Sub-Purposes (Projects/Events)
 * with date-bound validity and departmental budget splits.
 */
export default function AdminProjectsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);

  // 1. Fetch all projects (sub-purposes)
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["admin_projects"],
    queryFn: async () => {
      const res = await fetch("/api/admin/sub-purposes");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    }
  });

  // 2. Fetch Departments for budget splits
  const { data: departments = [] } = useQuery({
    queryKey: ["admin_departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments");
      if (!res.ok) throw new Error("Failed to fetch departments");
      return res.json();
    }
  });

  // 3. Status Toggle Mutation (Freeze/Activate)
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/admin/sub-purposes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Project hierarchy updated");
      queryClient.invalidateQueries({ queryKey: ["admin_projects"] });
    },
    onError: (err: any) => toast.error(err.message)
  });

  const filteredProjects = projects.filter((p: any) => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.purposeType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20 mb-3">
             <Wallet className="w-3 h-3" />
             Financial Governance
          </div>
          <h1 className="text-4xl font-serif font-black text-foreground tracking-tight">Project Control Center</h1>
          <p className="text-sm text-muted-foreground mt-2 font-medium max-w-2xl">
            Provision multi-departmental budgets, define asset validity periods, and monitor financial exposure for all capital projects and operational events.
          </p>
        </div>

        <button 
          onClick={() => {
            setSelectedProject(null);
            setIsModalOpen(true);
          }}
          className="bg-primary text-primary-foreground px-8 py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
        >
          <Plus className="w-5 h-5" />
          Initialize Project
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-card/50 border border-border p-2 rounded-[2.5rem] flex items-center gap-4 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
        <div className="bg-secondary/50 p-4 rounded-[2rem] flex items-center gap-4 flex-1">
          <Search className="w-5 h-5 text-muted-foreground/30" />
          <input 
            type="text" 
            placeholder="Search by project name or purpose classification..."
            className="bg-transparent border-none outline-none text-sm font-bold w-full placeholder:text-muted-foreground/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="hidden md:flex items-center gap-2 pr-4">
           <div className="h-10 w-px bg-border mx-2" />
           <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Projects: {filteredProjects.length}</span>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filteredProjects.map((project: any) => (
          <motion.div 
            layout
            key={project.id}
            className={`bg-card border rounded-[2.5rem] overflow-hidden group transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5 ${
              project.status === 'frozen' ? 'opacity-70 border-cyan-500/20' : 'border-border'
            }`}
          >
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                   <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-serif font-black tracking-tight">{project.name}</h3>
                      {project.status === 'frozen' && (
                        <span className="px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-500 text-[8px] font-black uppercase tracking-tighter border border-cyan-500/20">
                          Frozen
                        </span>
                      )}
                   </div>
                   <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      <Building2 className="w-3 h-3 text-primary" />
                      {project.purposeType}
                   </div>
                </div>
                
                <div className="flex items-center gap-2">
                   <button 
                     onClick={() => {
                       setSelectedProject(project.id);
                       setIsModalOpen(true);
                     }}
                     className="p-3 hover:bg-secondary rounded-2xl transition-all text-muted-foreground hover:text-primary outline-none"
                   >
                     <Edit className="w-5 h-5" />
                   </button>
                   <button 
                     onClick={() => toggleStatusMutation.mutate({ 
                       id: project.id, 
                       status: project.status === 'active' ? 'frozen' : 'active' 
                     })}
                     className={`p-3 rounded-2xl transition-all outline-none ${
                       project.status === 'active' 
                         ? 'hover:bg-cyan-500/10 text-muted-foreground hover:text-cyan-500' 
                         : 'bg-cyan-500/20 text-cyan-500'
                     }`}
                     title={project.status === 'active' ? "Freeze Project" : "Activate Project"}
                   >
                     <Snowflake className={`w-5 h-5 ${project.status === 'frozen' ? 'animate-pulse' : ''}`} />
                   </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                 {/* Budget Info */}
                 <div className="bg-secondary/30 p-6 rounded-[2rem] border border-border/50">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Allocated Budget</p>
                    <div className="flex items-baseline gap-2">
                       <span className="text-3xl font-serif font-black text-foreground">QAR {project.totalBudget.toLocaleString()}</span>
                    </div>
                    <div className="mt-4 h-1.5 w-full bg-border rounded-full overflow-hidden">
                       <div className="h-full bg-primary w-[65%]" />
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tighter">Budget Utilization: 65%</p>
                 </div>

                 {/* Validity Info */}
                 <div className="bg-secondary/30 p-6 rounded-[2rem] border border-border/50">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Validity Horizon</p>
                    <div className="space-y-3">
                       <div className="flex items-center gap-3">
                          <CircleDot className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs font-black uppercase tracking-wider">
                            {project.validFrom ? format(new Date(project.validFrom), 'MMM dd, yyyy') : "N/A"}
                          </span>
                       </div>
                       <div className="flex items-center gap-3">
                          <ArrowRight className="w-4 h-4 text-muted-foreground/30 ml-0.5" />
                       </div>
                       <div className="flex items-center gap-3">
                          <CircleDot className="w-4 h-4 text-rose-500" />
                          <span className="text-xs font-black uppercase tracking-wider">
                            {project.validTo ? format(new Date(project.validTo), 'MMM dd, yyyy') : "N/A"}
                          </span>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Departmental Splits Preview */}
              <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                 {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex-shrink-0 bg-secondary/50 px-4 py-2 rounded-xl border border-border text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                       DEPT-{i+1}: $50,000
                    </div>
                 ))}
                 <button className="flex-shrink-0 text-primary text-[9px] font-black uppercase tracking-widest flex items-center gap-1 hover:underline ml-2">
                    View Splits <ChevronRight className="w-3 h-3" />
                 </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="py-32 text-center">
           <div className="w-24 h-24 bg-secondary/50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 border border-border shadow-inner">
              <History className="w-10 h-10 text-muted-foreground/20" />
           </div>
           <h3 className="text-2xl font-serif font-black">No Active Projects Found</h3>
           <p className="text-muted-foreground font-medium mt-2 max-w-md mx-auto">Initialize your first corporate project or event to start managing departmental budget splits.</p>
        </div>
      )}

      {/* Project Creation/Edit Modal */}
      <ProjectModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projectId={selectedProject}
        departments={departments}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["admin_projects"] });
        }}
      />
    </div>
  );
}
