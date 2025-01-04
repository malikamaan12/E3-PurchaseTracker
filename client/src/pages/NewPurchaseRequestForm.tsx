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

  // Fetch branding information
  const { data: branding } = useQuery({
    queryKey: ["/api/branding"],
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

  // Generate PDF with enhanced formatting and branding
  const generatePDF = (formData: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;

    // Helper function to add page
    const addPage = () => {
      doc.addPage();
      if (branding?.logo) {
        // Add header with logo to new page
        doc.addImage(
          `data:${branding.logoMimeType};base64,${branding.logo}`,
          'PNG',
          margin,
          10,
          30,
          15
        );
      }
    };

    // Add header with logo and company name
    if (branding?.logo) {
      doc.addImage(
        `data:${branding.logoMimeType};base64,${branding.logo}`,
        'PNG',
        margin,
        10,
        30,
        15
      );
    }

    // Company name and document title
    doc.setFontSize(20);
    doc.setTextColor(branding?.primaryColor || "#7156a2");
    doc.text(branding?.companyName || "Company Name", pageWidth / 2, 15, { align: "center" });

    doc.setFontSize(16);
    doc.text("Purchase Request", pageWidth / 2, 25, { align: "center" });

    // Request number and date
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Request Number: ${formData.requestNumber || "New Request"}`, margin, 35);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - margin, 35, { align: "right" });

    // Separator line
    doc.setDrawColor(branding?.accentColor || "#35bbba");
    doc.line(margin, 40, pageWidth - margin, 40);

    // Basic Information Section
    doc.setFontSize(14);
    doc.setTextColor(branding?.primaryColor || "#7156a2");
    doc.text("Request Details", margin, 50);

    // Request information table
    const basicInfo = [
      ["Title", formData.title || ""],
      ["Description", formData.description || ""],
      ["Purpose Type", formData.purposeType || ""],
      ["Sub Purpose", formData.subPurposeName || ""],
      ["Priority", formData.priority || ""],
      ["Currency", formData.currency || ""],
      ["Total Estimated Cost", `${formData.totalEstimatedCost || 0}`],
      ["Freight Amount", `${formData.freightAmount || 0}`],
    ];

    doc.autoTable({
      startY: 55,
      head: [],
      body: basicInfo,
      theme: 'plain',
      styles: { 
        fontSize: 10,
        cellPadding: 3,
        textColor: [50, 50, 50],
      },
      columnStyles: {
        0: { 
          fontStyle: 'bold',
          cellWidth: 50,
          fillColor: [branding?.secondaryColor || "#F0F0FA"],
        },
        1: { cellWidth: 120 }
      },
    });

    // Items Section
    const currentY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.setTextColor(branding?.primaryColor || "#7156a2");
    doc.text("Items", margin, currentY);

    const itemsTableHead = [
      ["Item Name", "Description", "Quantity", "Unit Cost", "Total Cost"]
    ];
    const itemsTableBody = formData.items?.map((item: any) => [
      item.name,
      item.description,
      item.quantity,
      item.estimatedCost,
      (item.quantity * item.estimatedCost).toFixed(2)
    ]) || [];

    doc.autoTable({
      startY: currentY + 5,
      head: itemsTableHead,
      body: itemsTableBody,
      theme: 'striped',
      headStyles: { 
        fillColor: [
          parseInt(branding?.primaryColor?.slice(1, 3) || "71", 16),
          parseInt(branding?.primaryColor?.slice(3, 5) || "56", 16),
          parseInt(branding?.primaryColor?.slice(5, 7) || "a2", 16)
        ],
        textColor: [255, 255, 255],
      },
      styles: { 
        fontSize: 9,
        cellPadding: 5,
      },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 60 },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' },
      },
    });

    // Approval Flow Section
    const approvalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.setTextColor(branding?.primaryColor || "#7156a2");
    doc.text("Approval Flow", margin, approvalY);

    const mandatoryApprovers = ["CEO Office", "Finance", "Director"];
    const additionalApprovers = formData.additionalApprovers || [];

    const approvalInfo = [
      ["Mandatory Approvers", mandatoryApprovers.join(", ")],
      ["Additional Approvers", additionalApprovers.join(", ") || "None"]
    ];

    doc.autoTable({
      startY: approvalY + 5,
      head: [],
      body: approvalInfo,
      theme: 'plain',
      styles: { 
        fontSize: 10,
        cellPadding: 3,
        textColor: [50, 50, 50],
      },
      columnStyles: {
        0: { 
          fontStyle: 'bold',
          cellWidth: 50,
          fillColor: [branding?.secondaryColor || "#F0F0FA"],
        },
        1: { cellWidth: 120 }
      },
    });

    // Add custom footer to each page
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      // Footer line
      const footerY = pageHeight - 20;
      doc.setDrawColor(branding?.accentColor || "#35bbba");
      doc.line(margin, footerY, pageWidth - margin, footerY);

      // Footer text
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(
        branding?.footerText || "Generated by VMS System",
        margin,
        pageHeight - 10
      );
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth - margin,
        pageHeight - 10,
        { align: "right" }
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