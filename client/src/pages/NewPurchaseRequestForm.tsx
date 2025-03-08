import React from 'react';
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Vendor, SubPurpose } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import PurchaseRequestForm from "@/components/PurchaseRequestForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { generateRequestPDF } from "@/lib/pdfGenerator";

export default function NewPurchaseRequestForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Flag to prevent duplicate toast notifications
  const hasShownSubmitToast = React.useRef(false);

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: subPurposes = [], isLoading: subPurposesLoading } = useQuery<SubPurpose[]>({
    queryKey: ["/api/subpurposes"],
  });

  const { data: branding } = useQuery({
    queryKey: ["/api/branding"],
  });

  const handleVendorCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
  };

  const handleDownload = async () => {
    const formData = queryClient.getQueryData(["currentFormData"]);
    if (!formData) {
      toast({
        title: "Error",
        description: "No form data available to download",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log("Starting PDF generation with branding:", branding);

      const doc = await generateRequestPDF(formData);
      doc.save(`${formData.title || 'purchase-request'}.pdf`);

      toast({
        title: "Success",
        description: "Purchase request details have been downloaded",
        variant: "default" 
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = (draft?: boolean) => {
    // Only show the toast notification once, prevent duplicates
    if (!hasShownSubmitToast.current) {
      toast({
        title: "Success",
        description: draft 
          ? "Purchase request has been saved as draft" 
          : "Purchase request has been submitted successfully",
        variant: "default"
      });
      hasShownSubmitToast.current = true;
    }
    setLocation("/");
  };

  const handleCancel = () => {
    setLocation("/");
  };

  if (vendorsLoading || subPurposesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#7156a2]/5 to-[#35bbba]/5 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6 flex justify-between items-center">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/")}
            className="hover:bg-[#7156a2]/10 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <Button
            variant="outline"
            onClick={handleDownload}
            className="hover:bg-[#35bbba]/10 transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Request
          </Button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-[#35bbba]/20 dark:border-[#35bbba]/30">
          <div className="border-b border-[#7156a2]/10 dark:border-[#7156a2]/20 pb-4 mb-6">
            <h1 className="text-2xl font-bold text-[#7156a2] dark:text-[#9f83d5]">
              New Purchase Request
            </h1>
            <p className="text-sm text-muted-foreground dark:text-gray-300 mt-1">
              Fill in the details below to create a new purchase request
            </p>
          </div>

          <PurchaseRequestForm
            subPurposes={subPurposes}
            vendors={vendors}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onVendorCreated={handleVendorCreated}
          />
        </div>
      </div>
    </div>
  );
}