import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Vendor, SubPurpose } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import PurchaseRequestForm from "@/components/PurchaseRequestForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function NewPurchaseRequestForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const generatePDF = (formData: any) => {
    // Initialize PDF with A4 format
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    let startY = margin + 40; // Start after header

    const addHeaderAndFooter = () => {
      try {
        if (branding?.headerImage) {
          console.log("Adding header image");
          const headerHeight = 30; // Fixed 30mm height for header
          doc.addImage(
            branding.headerImage,
            branding.headerImageMimeType || 'JPEG',
            0, // x
            0, // y
            pageWidth, // width
            headerHeight, // height
            undefined,
            'FAST'
          );
          console.log("Header image added successfully");
        }

        if (branding?.footerImage) {
          console.log("Adding footer image");
          const footerHeight = 20; // Fixed 20mm height for footer
          doc.addImage(
            branding.footerImage,
            branding.footerImageMimeType || 'JPEG',
            0, // x
            pageHeight - footerHeight, // y position from bottom
            pageWidth, // width
            footerHeight, // height
            undefined,
            'FAST'
          );
          console.log("Footer image added successfully");
        }
      } catch (error) {
        console.error("Error adding header/footer:", error);
      }
    };

    // Add header and footer first
    addHeaderAndFooter();

    // Company Name and Date
    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    doc.text(branding?.companyName || "Company Name", margin, margin + 10);
    doc.text(new Date().toLocaleDateString(), pageWidth - margin - 30, margin + 10);

    // Request Details
    doc.setFontSize(16);
    doc.setTextColor(60, 60, 60);
    doc.text("Purchase Request Details", margin, startY);

    // Basic Information table
    const basicInfo = [
      ["Request Number", formData.requestNumber || "New Request"],
      ["Title", formData.title || ""],
      ["Description", formData.description || ""],
      ["Purpose Type", formData.purposeType || ""],
      ["Priority", formData.priority || ""],
      ["Currency", formData.currency || ""],
      ["Total Cost", `${formData.currency} ${formData.totalEstimatedCost || 0}`],
    ];

    doc.autoTable({
      startY: startY + 10,
      head: [],
      body: basicInfo,
      theme: 'striped',
      styles: {
        fontSize: 10,
        cellPadding: 5,
      },
      columnStyles: {
        0: { 
          fontStyle: 'bold',
          cellWidth: 40,
          fillColor: [240, 240, 250],
        },
        1: { cellWidth: 100 }
      },
      margin: { left: margin, right: margin }
    });

    // Items table
    const currentY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text("Items", margin, currentY);

    const itemHeaders = [["Item Name", "Description", "Quantity", "Unit Cost", "Total"]];
    const itemsData = formData.items?.map((item: any) => [
      item.name,
      item.description || "",
      item.quantity,
      `${formData.currency} ${item.estimatedCost}`,
      `${formData.currency} ${(item.quantity * item.estimatedCost).toFixed(2)}`
    ]) || [];

    doc.autoTable({
      startY: currentY + 5,
      head: itemHeaders,
      body: itemsData,
      theme: 'striped',
      styles: {
        fontSize: 9,
        cellPadding: 5,
      },
      headStyles: {
        fillColor: [113, 86, 158], // Primary color
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 60 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' }
      },
      margin: { left: margin, right: margin }
    });

    // Add header and footer to all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addHeaderAndFooter();
    }

    return doc;
  };

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
      console.log("Starting PDF generation with branding:", {
        headerImage: branding?.headerImage ? "present" : "missing",
        headerMimeType: branding?.headerImageMimeType,
        footerImage: branding?.footerImage ? "present" : "missing",
        footerMimeType: branding?.footerImageMimeType
      });

      const doc = generatePDF(formData);
      doc.save("purchase-request.pdf");

      toast({
        title: "Success",
        description: "Purchase request details have been downloaded",
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
    toast({
      title: "Success",
      description: `Request ${draft ? "saved as draft" : "submitted"} successfully`,
      variant: "default"
    });
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