"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { Settings2, Save, Droplet, Type, FileImage } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function PdfSettingsPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Record<string, any>>({});

  const { data: initialSettings, isLoading } = useQuery({
    queryKey: ["admin_pdf_settings"],
    queryFn: () => apiClient.admin.pdfSettings.get(),
    enabled: !!user && !isAuthLoading
  });

  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings);
    }
  }, [initialSettings]);

  const handleChange = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiClient.admin.pdfSettings.update(data),
    onSuccess: () => {
      toast.success("Branding configuration saved successfully");
      queryClient.invalidateQueries({ queryKey: ["admin_pdf_settings"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to save branding"),
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, type }: { file: File, type: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/pdf-settings/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: (data, variables) => {
      const fieldMap: Record<string, string> = {
        logo: "logo",
        header: "headerImage",
        footer: "footerImage"
      };
      const fieldName = fieldMap[variables.type];
      handleChange(fieldName, data.publicUrl);
      toast.success(`${variables.type.toUpperCase()} uploaded successfully`);
    },
    onError: (err: any) => toast.error(err.message || "Failed to upload image"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(settings);
  };

  const ImageUploadZone = ({ label, type, currentUrl }: { label: string, type: string, currentUrl?: string }) => {
    const [isDragging, setIsDragging] = useState(false);
    const inputId = `file-upload-${type}`;

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        uploadMutation.mutate({ file, type });
      }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        uploadMutation.mutate({ file, type });
      }
    };

    return (
      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative group border-2 border-dashed rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center gap-3 min-h-[160px] ${
          isDragging ? 'border-brand-primary bg-brand-primary/5' : 'border-border hover:border-brand-primary/50'
        }`}
      >
        {currentUrl ? (
          <div className="relative w-full h-full flex flex-col items-center gap-2">
            <img src={currentUrl} alt={label} className="max-h-24 object-contain rounded-lg shadow-sm" />
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">{label}</span>
            <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl backdrop-blur-sm">
               <FileImage className="w-6 h-6 text-brand-primary animate-bounce" />
            </div>
          </div>
        ) : (
          <>
            <FileImage className={`w-8 h-8 ${isDragging ? 'text-brand-primary animate-pulse' : 'text-muted-foreground group-hover:text-brand-primary'} transition-colors`} />
            <div className="text-center">
              <p className="text-xs font-bold text-foreground">{label}</p>
              <p className="text-[10px] text-muted-foreground mt-1 tracking-tight">Drop PNG or Click Browse</p>
            </div>
          </>
        )}

        <input 
          type="file" 
          accept="image/*" 
          id={inputId}
          className="hidden" 
          onChange={handleFileChange}
        />
        <label 
          htmlFor={inputId}
          className="mt-2 px-4 py-1.5 bg-secondary hover:bg-brand-primary hover:text-white text-muted-foreground rounded-full text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all active:scale-95 shadow-sm border border-border"
        >
          Browse Files
        </label>

        {uploadMutation.isPending && uploadMutation.variables?.type === type && (
          <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] flex items-center justify-center rounded-2xl">
            <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto pb-20">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground tracking-tight">PDF Document Settings</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium italic">Configure global appearance for generated Transport Manifests and Purchase Orders.</p>
        </div>
        <div className="bg-secondary/50 px-4 py-2 rounded-xl flex items-center gap-2 border border-border text-brand-primary hover:scale-105 transition-all cursor-pointer">
          <Settings2 className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-widest">Configuration</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Branding Assets (PNG Uploads - Step 3) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card p-6 rounded-3xl border border-border shadow-xl space-y-6">
             <div className="flex items-center gap-2 border-b border-border pb-4">
              <FileImage className="w-5 h-5 text-brand-primary" />
              <h2 className="text-lg font-bold text-foreground tracking-tight">Custom PNG Branding</h2>
            </div>
            
            <ImageUploadZone label="Primary Company Logo" type="logo" currentUrl={settings["logo"]} />
            <ImageUploadZone label="Header Image" type="header" currentUrl={settings["headerImage"]} />
            <ImageUploadZone label="Footer Graphics" type="footer" currentUrl={settings["footerImage"]} />
          </div>
        </div>

        {/* Global Configuration */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Branding Colors */}
            <div className="bg-card p-8 rounded-3xl border border-border space-y-6 shadow-xl transition-colors">
              <div className="flex items-center gap-2 border-b border-border pb-4">
                <Droplet className="w-5 h-5 text-brand-primary" />
                <h2 className="text-lg font-bold text-foreground">Branding Colors</h2>
              </div>
              
              <div className="space-y-4">
                <label className="block">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Primary Header (#5B4B8A)</span>
                  <div className="flex gap-2">
                    <div className="w-10 h-10 rounded-xl border border-border shadow-inner mt-2 shrink-0" style={{ backgroundColor: settings.headerColor ?? "#5B4B8A" }} />
                    <input 
                      type="text" 
                      value={settings.headerColor ?? "#5B4B8A"} 
                      onChange={(e) => handleChange("headerColor", e.target.value)}
                      className="w-full bg-secondary border border-border text-foreground rounded-xl px-4 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Footer Brand (#2FB7B2)</span>
                   <div className="flex gap-2">
                    <div className="w-10 h-10 rounded-xl border border-border shadow-inner mt-2 shrink-0" style={{ backgroundColor: settings.footerColor ?? "#2FB7B2" }} />
                    <input 
                      type="text" 
                      value={settings.footerColor ?? "#2FB7B2"} 
                      onChange={(e) => handleChange("footerColor", e.target.value)}
                      className="w-full bg-secondary border border-border text-foreground rounded-xl px-4 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                    />
                  </div>
                </label>
              </div>
            </div>

            {/* Typography & Content */}
            <div className="bg-card p-8 rounded-3xl border border-border space-y-6 shadow-xl transition-colors">
              <div className="flex items-center gap-2 border-b border-border pb-4">
                <Type className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-bold text-foreground">Document Content</h2>
              </div>
              
              <div className="space-y-4">
                <label className="block">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Header Title (E3 ERP)</span>
                  <input 
                    type="text" 
                    value={settings.headerTitle ?? "PURCHASE MANAGEMENT SYSTEM"} 
                    onChange={(e) => handleChange("headerTitle", e.target.value)}
                    className="w-full bg-secondary border border-border text-foreground rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Watermark Text</span>
                  <input 
                    type="text" 
                    value={settings.watermarkText ?? "INTERNAL ONLY"} 
                    onChange={(e) => handleChange("watermarkText", e.target.value)}
                    className="w-full bg-secondary border border-border text-foreground rounded-xl px-4 py-2 font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="bg-card p-8 rounded-3xl border border-border space-y-6 shadow-xl">
             <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-foreground font-bold">Require Signatures Layout</h3>
                  <p className="text-xs text-muted-foreground font-medium">Injects digital signature lines at the end of the PDF.</p>
                </div>
                
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={!!settings.showSignatures}
                    onChange={(e) => handleChange("showSignatures", e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
            </div>
          </div>

          <div className="pt-4">
             <button 
               type="submit" 
               disabled={updateMutation.isPending}
               className="w-full bg-primary hover:brightness-110 text-primary-foreground font-bold text-lg py-5 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl active:scale-[0.98] group"
             >
               <Save className="w-6 h-6 group-hover:rotate-12 transition-transform"/>
               Save Document Branding Configuration
             </button>
          </div>
        </div>
      </form>
    </div>
  );
}
