import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Vendor, SubPurpose } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import PurchaseRequestForm from "@/components/PurchaseRequestForm";
import { Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function NewPurchaseRequestForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Fetch vendors for the form with proper error handling
  const { data: vendors = [], isLoading: isLoadingVendors, error: vendorError } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    retry: 3,
    retryDelay: 1000,
  });

  // Fetch sub-purposes with proper error handling
  const { data: subPurposes = [], isLoading: isLoadingSubPurposes, error: subPurposeError } = useQuery<SubPurpose[]>({
    queryKey: ["/api/sub-purposes"],
    retry: 3,
    retryDelay: 1000,
  });

  // Handle loading states with a proper loading indicator
  if (isLoadingVendors || isLoadingSubPurposes) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#7156a2]/5 to-[#35bbba]/5">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading form data...</p>
        </div>
      </div>
    );
  }

  // Handle any errors with a proper error display
  if (vendorError || subPurposeError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#7156a2]/5 to-[#35bbba]/5">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="flex mb-4 gap-2">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <h1 className="text-2xl font-bold text-destructive">Error Loading Form</h1>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {vendorError ? "Failed to load vendors." : "Failed to load sub-purposes."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-primary text-primary-foreground rounded-md py-2 hover:bg-primary/90 transition-colors"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = (draft?: boolean) => {
    toast({
      title: "Success",
      description: `Request ${draft ? "saved as draft" : "submitted"} successfully`,
    });
    setLocation("/");
  };

  const handleCancel = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#7156a2]/5 to-[#35bbba]/5 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-[#191160] mb-6">
            New Purchase Request
          </h1>

          <PurchaseRequestForm
            subPurposes={subPurposes}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            vendors={vendors}
          />
        </div>
      </div>
    </div>
  );
}