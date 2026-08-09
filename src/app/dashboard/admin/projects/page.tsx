"use client";

import React, { useState, useEffect, useRef } from "react";
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
  ArrowRight,
  Trash2,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import ProjectModal from "@/components/admin/ProjectModal";

/**
 * Admin Projects Management Page
 * High-density interface for managing Sub-Purposes (Projects/Events)
 * with date-bound validity and departmental budget splits.
 */
export default function AdminProjectsPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [projectToDelete, setProjectToDelete] = useState<any>(null);

  // 1. Fetch all projects (sub-purposes)
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["admin_projects"],
    queryFn: async () => {
      const res = await fetch("/api/admin/sub-purposes");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
    enabled: !!user && !isAuthLoading
  });

  // 2. Fetch Departments for budget splits
  const { data: departments = [] } = useQuery({
    queryKey: ["admin_departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments");
      if (!res.ok) throw new Error("Failed to fetch departments");
      return res.json();
    },
    enabled: !!user && !isAuthLoading
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

  // 4. Delete Project Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/sub-purposes/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed to delete project");
      return data;
    },
    onSuccess: () => {
      toast.success("Project deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["admin_projects"] });
      setProjectToDelete(null);
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete project")
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
              <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4 mb-6">
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
                     title="Edit Project"
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
                   <button 
                     onClick={() => setProjectToDelete(project)}
                     className="p-3 hover:bg-rose-500/10 rounded-2xl transition-all text-muted-foreground hover:text-rose-500 outline-none"
                     title="Delete Project"
                   >
                     <Trash2 className="w-5 h-5" />
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

      {/* Delete / Freeze Safeguard Modal with Keyboard Tab Navigation */}
      <DeleteProjectModal 
        project={projectToDelete}
        isOpen={Boolean(projectToDelete)}
        onClose={() => setProjectToDelete(null)}
        onConfirmDelete={(id) => deleteMutation.mutate(id)}
        onConfirmFreeze={(id) => {
          toggleStatusMutation.mutate({ id, status: "frozen" });
          setProjectToDelete(null);
        }}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}

function DeleteProjectModal({ 
  project, 
  isOpen, 
  onClose, 
  onConfirmDelete, 
  onConfirmFreeze, 
  isDeleting 
}: { 
  project: any; 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirmDelete: (id: number) => void; 
  onConfirmFreeze: (id: number) => void; 
  isDeleting: boolean;
}) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const deleteBtnRef = useRef<HTMLButtonElement>(null);
  const freezeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (project?.committedAmount > 0) {
          freezeBtnRef.current?.focus();
        } else {
          cancelBtnRef.current?.focus();
        }
      }, 50);
    }
  }, [isOpen, project]);

  if (!isOpen || !project) return null;

  const usedAmount = Number(project.committedAmount || 0);
  const hasUsedAmount = usedAmount > 0;

  // Keyboard navigation & Focus trapping (Tab / Shift+Tab / Esc)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === "Tab") {
      const focusables = [
        cancelBtnRef.current,
        hasUsedAmount ? freezeBtnRef.current : deleteBtnRef.current,
      ].filter(Boolean) as HTMLElement[];

      if (focusables.length === 0) return;

      const currentIndex = focusables.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey) {
        if (currentIndex <= 0) {
          e.preventDefault();
          focusables[focusables.length - 1].focus();
        }
      } else {
        if (currentIndex === focusables.length - 1) {
          e.preventDefault();
          focusables[0].focus();
        }
      }
    }
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
        onKeyDown={handleKeyDown}
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-card border border-border/80 w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 overflow-hidden relative"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className={`p-4 rounded-2xl ${hasUsedAmount ? "bg-cyan-500/10 text-cyan-500 border border-cyan-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"}`}>
              {hasUsedAmount ? <Snowflake className="w-7 h-7 animate-pulse" /> : <Trash2 className="w-7 h-7" />}
            </div>
            <div>
              <h3 className="text-xl font-serif font-black tracking-tight text-foreground">
                {hasUsedAmount ? "Project Can Only Be Frozen" : "Delete Strategic Project"}
              </h3>
              <p className="text-xs font-mono font-bold text-muted-foreground mt-0.5 uppercase tracking-wider">{project.name}</p>
            </div>
          </div>

          {hasUsedAmount ? (
            <div className="bg-cyan-500/10 border border-cyan-500/30 p-5 rounded-2xl mb-6 space-y-2">
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Financial History Detected</span>
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed font-medium">
                This project has used/committed funds of <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">QAR {usedAmount.toLocaleString()}</span>. Under governance rules, projects with spent funds <span className="font-bold underline">cannot be deleted</span>. You can freeze this project to restrict future requests while preserving audit logs.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed mb-6 font-medium">
              Are you sure you want to delete <span className="font-bold text-foreground">"{project.name}"</span>? This will permanently remove the project definition and budget allocations.
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              ref={cancelBtnRef}
              type="button"
              tabIndex={0}
              onClick={onClose}
              className="px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest text-muted-foreground hover:bg-secondary border border-border/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer"
            >
              Cancel
            </button>

            {hasUsedAmount ? (
              <button
                ref={freezeBtnRef}
                type="button"
                tabIndex={0}
                onClick={() => onConfirmFreeze(project.id)}
                className="px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-cyan-500 text-white hover:bg-cyan-600 shadow-lg shadow-cyan-500/20 focus:ring-2 focus:ring-cyan-500/40 outline-none transition-all flex items-center gap-2 cursor-pointer"
              >
                <Snowflake className="w-4 h-4" /> Freeze Project Now
              </button>
            ) : (
              <button
                ref={deleteBtnRef}
                type="button"
                tabIndex={0}
                disabled={isDeleting}
                onClick={() => onConfirmDelete(project.id)}
                className="px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-500/20 focus:ring-2 focus:ring-rose-500/40 outline-none transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete Project
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
