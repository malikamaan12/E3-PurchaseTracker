import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Vendor, SubPurpose } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import PurchaseRequestForm from "@/components/PurchaseRequestForm";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NewPurchaseRequestForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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

  // Show loading state
  if (vendorsLoading || subPurposesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#7058a3]/5 to-[#3eb6ba]/5">
        <Loader2 className="h-8 w-8 animate-spin text-[#7058a3]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#7058a3]/5 to-[#3eb6ba]/5 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6 border border-[#7058a3]/10">
          <div className="flex items-center gap-4 mb-6">
            <Button
              onClick={() => setLocation("/")}
              variant="ghost"
              className="text-[#7058a3] hover:text-[#7058a3]/90 hover:bg-[#7058a3]/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold text-[#7058a3]">
              New Purchase Request
            </h1>
          </div>

          <PurchaseRequestForm
            subPurposes={subPurposes}
            vendors={vendors}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  );
}