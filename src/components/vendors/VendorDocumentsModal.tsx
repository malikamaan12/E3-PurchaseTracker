"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { X, FileText, Upload, Calendar, AlertCircle, CheckCircle2, Trash2, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { format, differenceInDays } from "date-fns";

export function VendorDocumentsModal({ open, onOpenChange, vendor }: any) {
  const queryClient = useQueryClient();
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("Commercial Registration");
  const [expiryDate, setExpiryDate] = useState("");
  const [fileUrl, setFileUrl] = useState(""); // Simplified for demo, normally an actual upload

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["vendor_documents", vendor?.id],
    queryFn: () => apiClient.vendors.documents.list(vendor.id),
    enabled: !!vendor?.id && open
  });

  const uploadMutation = useMutation({
    mutationFn: (data: any) => apiClient.vendors.documents.upload(vendor.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor_documents", vendor?.id] });
      toast.success("Document uploaded securely");
      setDocName("");
      setExpiryDate("");
      setFileUrl("");
    },
    onError: (err: any) => toast.error(err.message || "Failed to upload document")
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: number) => apiClient.vendors.documents.delete(vendor.id, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor_documents", vendor?.id] });
      toast.success("Document removed");
    }
  });

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName || !fileUrl) {
      toast.error("Please provide document name and a valid file/URL");
      return;
    }
    uploadMutation.mutate({
      documentType: docType,
      documentName: docName,
      fileUrl: fileUrl,
      expiryDate: expiryDate ? new Date(expiryDate).toISOString() : null
    });
  };

  const getStatusDisplay = (doc: any) => {
    if (!doc.expiryDate) return { color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2, text: "Valid (No Expiry)" };
    
    const daysLeft = differenceInDays(new Date(doc.expiryDate), new Date());
    if (daysLeft < 0) return { color: "text-rose-500", bg: "bg-rose-500/10", icon: AlertCircle, text: "Expired" };
    if (daysLeft <= 30) return { color: "text-amber-500", bg: "bg-amber-500/10", icon: Clock, text: `Expiring in ${daysLeft} days` };
    
    return { color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2, text: "Valid" };
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl z-[101] focus:outline-none">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-card p-8 border border-border shadow-2xl relative overflow-hidden rounded-[2.5rem] max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-8 relative">
              <div>
                <Dialog.Title className="text-3xl font-serif font-black text-foreground tracking-tighter">
                  Compliance Documents
                </Dialog.Title>
                <Dialog.Description className="text-xs font-black uppercase text-muted-foreground tracking-widest mt-2">
                  Manage {vendor?.companyName}'s official certifications
                </Dialog.Description>
              </div>
              <Dialog.Close className="p-2.5 rounded-2xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border">
                <X className="w-5 h-5" />
              </Dialog.Close>
            </div>

            {/* Upload Form */}
            <form onSubmit={handleUpload} className="bg-secondary/30 border border-border p-6 rounded-3xl mb-8">
              <h4 className="text-xs font-black uppercase tracking-widest text-foreground mb-4 flex items-center gap-2">
                <Upload className="w-4 h-4 text-brand-primary" />
                Upload New Document
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <label className="text-[10px] uppercase font-bold text-muted-foreground">Document Type</label>
                   <select 
                     value={docType}
                     onChange={(e) => setDocType(e.target.value)}
                     className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:ring-2 focus:ring-brand-primary/20 outline-none"
                   >
                     <option value="Commercial Registration">Commercial Registration</option>
                     <option value="Tax Certificate">Tax Certificate</option>
                     <option value="NDA">NDA</option>
                     <option value="ISO Certificate">ISO Certificate</option>
                     <option value="Other">Other</option>
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] uppercase font-bold text-muted-foreground">Document Name</label>
                   <input 
                     type="text" 
                     value={docName}
                     onChange={(e) => setDocName(e.target.value)}
                     placeholder="e.g. CR 2026"
                     className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:ring-2 focus:ring-brand-primary/20 outline-none"
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] uppercase font-bold text-muted-foreground">File URL (Simulation)</label>
                   <input 
                     type="url" 
                     value={fileUrl}
                     onChange={(e) => setFileUrl(e.target.value)}
                     placeholder="https://storage.example.com/doc.pdf"
                     className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:ring-2 focus:ring-brand-primary/20 outline-none"
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] uppercase font-bold text-muted-foreground">Expiry Date (Optional)</label>
                   <input 
                     type="date" 
                     value={expiryDate}
                     onChange={(e) => setExpiryDate(e.target.value)}
                     className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:ring-2 focus:ring-brand-primary/20 outline-none"
                   />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button 
                  type="submit" 
                  disabled={uploadMutation.isPending}
                  className="bg-brand-primary text-primary-foreground px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {uploadMutation.isPending ? "Uploading..." : "Attach Document"}
                </button>
              </div>
            </form>

            {/* Document List */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Official Records</h4>
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground animate-pulse text-sm font-bold">Loading vault...</div>
              ) : documents.length === 0 ? (
                <div className="p-8 border border-dashed border-border rounded-3xl text-center">
                  <FileText className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-sm font-bold text-muted-foreground">No compliance documents attached.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc: any) => {
                    const status = getStatusDisplay(doc);
                    const StatusIcon = status.icon;
                    return (
                      <div key={doc.id} className="flex items-center justify-between p-4 bg-secondary/20 border border-border rounded-2xl hover:bg-secondary/40 transition-colors group">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center text-muted-foreground">
                             <FileText className="w-5 h-5" />
                           </div>
                           <div>
                             <h5 className="text-sm font-bold text-foreground">{doc.documentName}</h5>
                             <div className="flex items-center gap-3 mt-1">
                               <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{doc.documentType}</span>
                               {doc.expiryDate && (
                                 <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                                   <Calendar className="w-3 h-3" /> Exp: {format(new Date(doc.expiryDate), "MMM dd, yyyy")}
                                 </span>
                               )}
                             </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-4">
                           <div className={`px-3 py-1 rounded-full flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${status.bg} ${status.color}`}>
                             <StatusIcon className="w-3.5 h-3.5" />
                             {status.text}
                           </div>
                           <button 
                             onClick={() => deleteMutation.mutate(doc.id)}
                             className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
