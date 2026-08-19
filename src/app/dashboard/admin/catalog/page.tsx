"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Search, 
  ChevronDown, 
  ChevronRight, 
  FolderTree, 
  Snowflake, 
  Play, 
  Edit, 
  Briefcase,
  Layers,
  Calendar,
  DollarSign,
  AlertCircle,
  MoreVertical,
  History
} from "lucide-react";
import { format } from "date-fns";
import { safeFormatDate, safeFormatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "@/lib/apiClient";
import PurposeModal from "@/components/admin/PurposeModal";
import ProjectModal from "@/components/admin/ProjectModal";
import { useAuth } from "@/context/AuthContext";

/**
 * Admin Governance Catalog Page
 * Hierarchical interface for managing Purpose Categories and their nested Projects.
 * Implements strict "Freeze" governance and date-bound validity.
 */
export default function AdminCatalogPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<number[]>([]);
  
  // Modals state
  const [isPurposeModalOpen, setIsPurposeModalOpen] = useState(false);
  const [selectedPurposeId, setSelectedPurposeId] = useState<number | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
 
  // 1. Fetch Hierarchical Catalog
  const { data: catalog = [], isLoading } = useQuery({
    queryKey: ["admin_catalog"],
    queryFn: () => apiClient.admin.catalog.list(),
    enabled: !!user && !isAuthLoading
  });
 
  // 2. Fetch Departments (needed for ProjectModal)
  const { data: departments = [] } = useQuery({
    queryKey: ["admin_departments"],
    queryFn: () => apiClient.departments.list(),
    enabled: !!user && !isAuthLoading
  });

  // 3. Mutations for Status Toggling
  const togglePurposeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiClient.admin.purposes.update(id, { status });
    },
    onSuccess: () => {
      toast.success("Category status updated");
      queryClient.invalidateQueries({ queryKey: ["admin_catalog"] });
    }
  });

  const toggleProjectStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiClient.admin.subPurposes.update(id, { status });
    },
    onSuccess: () => {
      toast.success("Project status updated");
      queryClient.invalidateQueries({ queryKey: ["admin_catalog"] });
    }
  });

  const toggleExpand = (id: number) => {
    setExpandedCategories(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filteredCatalog = catalog.filter((cat: any) => 
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.subPurposes.some((sp: any) => sp.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Synchronizing Governance Structures...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20 mb-3">
             <FolderTree className="w-3 h-3" />
             Strategic Catalog Management
          </div>
          <h1 className="text-4xl font-serif font-black text-foreground tracking-tight">Purpose Governance</h1>
          <p className="text-sm text-muted-foreground mt-2 font-medium max-w-2xl">
            Establish the foundational procurement hierarchy. Define high-level Purpose Categories and manage nested strategic Projects with strict financial exposure controls.
          </p>
        </div>

        <button 
          onClick={() => {
            setSelectedPurposeId(null);
            setIsPurposeModalOpen(true);
          }}
          className="bg-primary text-primary-foreground px-8 py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
        >
          <Plus className="w-5 h-5" />
          New Category
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-card/50 border border-border p-2 rounded-[2.5rem] flex items-center gap-4 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
        <div className="bg-secondary/50 p-4 rounded-[2rem] flex items-center gap-4 flex-1">
          <Search className="w-5 h-5 text-muted-foreground/30" />
          <input 
            type="text" 
            placeholder="Search categories or projects..."
            className="bg-transparent border-none outline-none text-sm font-bold w-full placeholder:text-muted-foreground/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Hierarchical Catalog */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredCatalog.map((category: any) => (
            <div key={category.id} className="group">
              {/* Parent Category Row */}
              <div 
                className={`bg-card border rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 hover:shadow-xl ${
                  category.status === 'frozen' ? 'opacity-70 border-cyan-500/20 grayscale' : 'border-border'
                }`}
              >
                <div className="flex items-center gap-3 sm:gap-6 flex-1 min-w-0">
                  <button 
                    onClick={() => toggleExpand(category.id)}
                    aria-label={`Toggle projects under ${category.name}`}
                    className="p-2.5 hover:bg-secondary rounded-xl transition-all min-h-[44px] min-w-[44px] inline-flex items-center justify-center shrink-0 touch-target"
                  >
                    {expandedCategories.includes(category.id) ? (
                      <ChevronDown className="w-5 h-5 text-primary" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <h3 className="text-base sm:text-xl font-serif font-black truncate">{category.name}</h3>
                      <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter border ${
                        category.status === 'active' 
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                          : 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20'
                      }`}>
                        {category.status}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-60 line-clamp-1">
                      {category.description || "No description provided"}
                    </p>
                  </div>

                  <div className="hidden md:flex items-center gap-8 px-8 border-x border-border/50 shrink-0">
                    <div className="text-center">
                      <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground block">Projects</span>
                      <span className="text-sm font-black text-foreground">{category.subPurposes?.length || 0}</span>
                    </div>
                    <div className="text-center">
                       <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground block">Active Submissions</span>
                       <span className="text-sm font-black text-foreground">Available</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-center">
                  <button 
                    onClick={() => {
                      setSelectedPurposeId(category.id);
                      setIsPurposeModalOpen(true);
                    }}
                    aria-label={`Edit ${category.name}`}
                    className="p-2.5 hover:bg-secondary rounded-2xl text-muted-foreground hover:text-primary transition-all min-h-[44px] min-w-[44px] inline-flex items-center justify-center touch-target"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => togglePurposeStatus.mutate({ 
                      id: category.id, 
                      status: category.status === 'active' ? 'frozen' : 'active' 
                    })}
                    aria-label={`${category.status === 'active' ? 'Freeze' : 'Activate'} ${category.name}`}
                    className={`p-2.5 rounded-2xl transition-all min-h-[44px] min-w-[44px] inline-flex items-center justify-center touch-target ${
                      category.status === 'active' 
                        ? 'hover:bg-cyan-500/10 text-muted-foreground hover:text-cyan-500' 
                        : 'bg-cyan-500/20 text-cyan-500'
                    }`}
                  >
                    {category.status === 'active' ? <Snowflake className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedProjectId(null);
                      setSelectedPurposeId(category.id);
                      setIsProjectModalOpen(true);
                    }}
                    aria-label={`Add project under ${category.name}`}
                    className="flex items-center gap-2 bg-secondary hover:bg-primary hover:text-primary-foreground px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all min-h-[44px] touch-target"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Project
                  </button>
                </div>
              </div>

              {/* Nested Sub-Purposes */}
              <AnimatePresence>
                {expandedCategories.includes(category.id) && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pl-4 sm:pl-14 pr-2 sm:pr-6 py-4 space-y-3">
                      {category.subPurposes?.length > 0 ? (
                        category.subPurposes.map((project: any) => (
                          <div 
                            key={project.id}
                            className={`bg-secondary/30 border border-border/50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group/sub ${
                              project.status === 'frozen' ? 'opacity-50 grayscale' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                               <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center shrink-0">
                                  <Layers className="w-4 h-4 text-muted-foreground/40" />
                               </div>
                               <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                     <h4 className="text-sm font-black truncate">{project.name}</h4>
                                     {project.status === 'frozen' && (
                                       <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-500 border border-cyan-500/10">Frozen</span>
                                     )}
                                  </div>
                                  <div className="flex items-center gap-3 sm:gap-4 mt-1 flex-wrap">
                                     <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase opacity-60">
                                        <Calendar className="w-3 h-3" />
                                        {safeFormatDate(project.validFrom, 'MMM d', 'Start')} {"->"} {safeFormatDate(project.validTo, 'MMM d', 'End')}
                                     </div>
                                     <div className="flex items-center gap-1.5 text-[9px] font-black text-primary uppercase">
                                        <DollarSign className="w-3 h-3" />
                                        QAR {safeFormatNumber(project.totalBudget)}
                                     </div>
                                  </div>
                               </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center opacity-100 md:opacity-0 md:group-hover/sub:opacity-100 transition-all">
                               <button 
                                 onClick={() => {
                                   setSelectedProjectId(project.id);
                                   setIsProjectModalOpen(true);
                                 }}
                                 aria-label={`Edit project ${project.name}`}
                                 className="p-2 hover:bg-card rounded-xl text-muted-foreground hover:text-primary transition-all min-h-[44px] min-w-[44px] inline-flex items-center justify-center touch-target"
                               >
                                 <Edit className="w-4 h-4" />
                               </button>
                               <button 
                                 onClick={() => toggleProjectStatus.mutate({ 
                                   id: project.id, 
                                   status: project.status === 'active' ? 'frozen' : 'active' 
                                 })}
                                 aria-label={`${project.status === 'active' ? 'Freeze' : 'Activate'} project ${project.name}`}
                                 className={`p-2 rounded-xl transition-all min-h-[44px] min-w-[44px] inline-flex items-center justify-center touch-target ${
                                   project.status === 'active' 
                                     ? 'hover:bg-cyan-500/10 text-muted-foreground hover:text-cyan-500' 
                                     : 'bg-cyan-500/20 text-cyan-500'
                                 }`}
                               >
                                 {project.status === 'active' ? <Snowflake className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                               </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 border-2 border-dashed border-border rounded-3xl opacity-30">
                           <Layers className="w-6 h-6 mx-auto mb-2" />
                           <p className="text-[9px] font-black uppercase tracking-widest">No Projects Initialized Under This Category</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </AnimatePresence>
      </div>

      {catalog.length === 0 && (
        <div className="py-32 text-center">
           <div className="w-24 h-24 bg-secondary/50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 border border-border shadow-inner">
              <History className="w-10 h-10 text-muted-foreground/20" />
           </div>
           <h3 className="text-2xl font-serif font-black">Governance Repository Empty</h3>
           <p className="text-muted-foreground font-medium mt-2 max-w-md mx-auto">Initialize your first strategic purpose category to start structuring the procurement framework.</p>
        </div>
      )}

      {/* Modals */}
      <PurposeModal 
        isOpen={isPurposeModalOpen}
        onClose={() => setIsPurposeModalOpen(false)}
        purposeId={selectedPurposeId}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin_catalog"] })}
      />

      <ProjectModal 
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        projectId={selectedProjectId}
        departments={departments}
        purposeCategoryId={selectedPurposeId}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin_catalog"] })}
      />
    </div>
  );
}
