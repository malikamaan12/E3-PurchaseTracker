"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { Settings2, Save, Droplet, Type, FileImage } from "lucide-react";

export default function PdfSettingsPage() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Record<string, string>>({});

  const { data: initialSettings, isLoading } = useQuery({
    queryKey: ["admin_system_settings"],
    queryFn: () => apiClient.admin.systemSettings.get(),
  });

  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings);
    }
  }, [initialSettings]);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, string>) => apiClient.admin.systemSettings.update(data),
    onSuccess: () => {
      toast.success("Settings saved successfully");
      queryClient.invalidateQueries({ queryKey: ["admin_system_settings"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to save settings"),
  });

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground tracking-tight">PDF Document Settings</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium italic">Configure global appearance for generated Transport Manifests and Purchase Orders.</p>
        </div>
        <div className="bg-secondary/50 px-4 py-2 rounded-xl flex items-center gap-2 border border-border text-purple-500 transition-colors">
          <Settings2 className="w-5 h-5" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Branding */}
        <div className="bg-card p-8 rounded-3xl border border-border space-y-6 shadow-xl transition-colors">
          <div className="flex items-center gap-2 border-b border-border pb-4">
            <Droplet className="w-5 h-5 text-brand-primary" />
            <h2 className="text-lg font-bold text-foreground">Branding Colors</h2>
          </div>
          
          <div className="space-y-4">
            <label className="block">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Primary Header Color (Hex)</span>
              <input 
                type="text" 
                value={settings["pdf_header_color"] || "#000000"} 
                onChange={(e) => handleChange("pdf_header_color", e.target.value)}
                className="w-full bg-secondary border border-border text-foreground rounded-xl px-4 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Footer Color (Hex)</span>
              <input 
                type="text" 
                value={settings["pdf_footer_color"] || "#333333"} 
                onChange={(e) => handleChange("pdf_footer_color", e.target.value)}
                className="w-full bg-secondary border border-border text-foreground rounded-xl px-4 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
              />
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
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Header Title (e.g. E3 ERP)</span>
              <input 
                type="text" 
                value={settings["pdf_header_title"] || "ENTERPRISE PROCUREMENT"} 
                onChange={(e) => handleChange("pdf_header_title", e.target.value)}
                className="w-full bg-secondary border border-border text-foreground rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Company Legal Footer Text</span>
              <textarea 
                rows={3}
                value={settings["pdf_footer_text"] || ""} 
                onChange={(e) => handleChange("pdf_footer_text", e.target.value)}
                className="w-full bg-secondary border border-border text-foreground rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                placeholder="E.g. Address, VAT number..."
              />
            </label>
             <label className="block">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Watermark Text</span>
              <input 
                type="text" 
                value={settings["pdf_watermark_text"] || "INTERNAL ONLY"} 
                onChange={(e) => handleChange("pdf_watermark_text", e.target.value)}
                className="w-full bg-secondary border border-border text-foreground rounded-xl px-4 py-2 font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
            </label>
          </div>
        </div>

        {/* Global toggles */}
        <div className="bg-card p-8 rounded-3xl border border-border space-y-6 lg:col-span-2 flex items-center justify-between shadow-xl transition-colors">
            <div className="space-y-1">
              <h3 className="text-foreground font-bold">Require Signatures Layout</h3>
              <p className="text-xs text-muted-foreground font-medium">Injects digital signature lines at the end of the PDF.</p>
            </div>
            
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={settings["pdf_require_signatures"] === "true"}
                onChange={(e) => handleChange("pdf_require_signatures", e.target.checked ? "true" : "false")}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
        </div>

        <div className="lg:col-span-2 pt-4">
           <button 
             type="submit" 
             disabled={updateMutation.isPending}
             className="w-full bg-primary hover:brightness-110 text-primary-foreground font-bold text-lg py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl active:scale-[0.98]"
           >
             <Save className="w-5 h-5"/>
             Save Configuration
           </button>
        </div>
      </form>
    </div>
  );
}
