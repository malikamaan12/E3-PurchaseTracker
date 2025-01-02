import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Vendor, SubPurpose } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import PurchaseRequestForm from "@/components/PurchaseRequestForm";
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
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-[#191160] mb-6">
            New Purchase Request
          </h1>

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