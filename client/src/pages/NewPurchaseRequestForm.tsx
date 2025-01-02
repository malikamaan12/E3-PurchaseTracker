import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Vendor, SubPurpose } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import PurchaseRequestForm from "@/components/PurchaseRequestForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import { Loader2 } from "lucide-react";

export default function NewPurchaseRequestForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch vendors and subpurposes for the form
  const { data: vendors = [], isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: subPurposes = [], isLoading: subPurposesLoading } = useQuery<SubPurpose[]>({
    queryKey: ["/api/subpurposes"],
  });

  // Handle successful submission
  const handleSubmit = (draft?: boolean) => {
    toast({
      title: "Success",
      description: `Request ${draft ? "saved as draft" : "submitted"} successfully`,
      variant: "default"
    });

    // Redirect to the dashboard
    setLocation("/");
  };

  // Handle cancellation
  const handleCancel = () => {
    setLocation("/");
  };

  // Handle vendor creation
  const handleVendorCreated = () => {
    // Invalidate and refetch vendors query
    queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
  };

  // Handle download
  const handleDownload = () => {
    // Implement download functionality
    toast({
      title: "Download Started",
      description: "Your purchase request details are being downloaded",
      variant: "default"
    });
  };

  // Show loading state
  if (vendorsLoading || subPurposesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
            className="hover:bg-[#7156a2]/10 transition-colors flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <Button
            variant="outline"
            onClick={handleDownload}
            className="hover:bg-[#35bbba]/10 transition-colors flex items-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Request
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-[#35bbba]/20">
          <div className="border-b border-[#7156a2]/10 pb-4 mb-6">
            <h1 className="text-2xl font-bold text-[#7156a2]">
              New Purchase Request
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
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