import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Vendor, SubPurpose } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import PurchaseRequestForm from "@/components/PurchaseRequestForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import { Loader2 } from "lucide-react";
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

  // Generate PDF with enhanced formatting
  const generatePDF = (formData: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Header with branding
    doc.setFillColor(113, 86, 162); // #7156a2
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text("Purchase Request", pageWidth / 2, 25, { align: "center" });

    // Reset text color
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);

    // Basic Information Section
    doc.setFontSize(16);
    doc.setTextColor(53, 187, 186); // #35bbba
    doc.text("Request Details", 20, 50);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);

    // Request information
    const basicInfo = [
      ["Title", formData.title || ""],
      ["Description", formData.description || ""],
      ["Priority", formData.priority || ""],
      ["Currency", formData.currency || ""],
      ["Total Cost", `${formData.totalEstimatedCost || 0}`],
    ];

    doc.autoTable({
      startY: 60,
      head: [],
      body: basicInfo,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 40 },
        1: { cellWidth: 130 }
      },
    });

    // Items Section
    const currentY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(16);
    doc.setTextColor(53, 187, 186);
    doc.text("Items", 20, currentY);
    doc.setTextColor(0, 0, 0);

    const itemsTableHead = [["Item Name", "Description", "Quantity", "Unit Cost", "Total"]];
    const itemsTableBody = formData.items?.map((item: any) => [
      item.name,
      item.description,
      item.quantity,
      item.estimatedCost,
      item.quantity * item.estimatedCost
    ]) || [];

    doc.autoTable({
      startY: currentY + 10,
      head: itemsTableHead,
      body: itemsTableBody,
      theme: 'striped',
      headStyles: { fillColor: [113, 86, 162] },
      styles: { fontSize: 10 },
    });

    // Approval Flow Section
    const approvalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(16);
    doc.setTextColor(53, 187, 186);
    doc.text("Approval Flow", 20, approvalY);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);

    const mandatoryApprovers = ["CEO Office", "Finance", "Director"];
    const additionalApprovers = formData.additionalApprovers || [];

    const approvalInfo = [
      ["Mandatory Approvers", mandatoryApprovers.join(", ")],
      ["Additional Approvers", additionalApprovers.join(", ") || "None"]
    ];

    doc.autoTable({
      startY: approvalY + 10,
      head: [],
      body: approvalInfo,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 40 },
        1: { cellWidth: 130 }
      },
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    doc.setFontSize(10);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.height - 10,
        { align: "center" }
      );
      doc.text(
        new Date().toLocaleDateString(),
        20,
        doc.internal.pageSize.height - 10
      );
    }

    return doc;
  };

  // Handle download
  const handleDownload = () => {
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
      const doc = generatePDF(formData);
      doc.save("purchase-request.pdf");

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