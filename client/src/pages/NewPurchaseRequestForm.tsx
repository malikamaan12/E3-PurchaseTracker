import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Vendor } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import { useApprovers } from "@/hooks/use-approvers";
import PurchaseRequestForm from "@/components/PurchaseRequestForm";

export default function NewPurchaseRequestForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: approvers = [] } = useApprovers();

  // Fetch vendors for the form
  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const handleSubmit = (draft?: boolean) => {
    // Show success message
    toast({
      title: "Success",
      description: `Request ${draft ? "saved as draft" : "submitted"} successfully`,
    });

    // Redirect to the dashboard
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
            subPurposes={[]}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            vendors={vendors}
            approvers={approvers}
          />
        </div>
      </div>
    </div>
  );
}