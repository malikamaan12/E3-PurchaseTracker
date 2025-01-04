import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Vendor, SubPurpose } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import PurchaseRequestForm from "@/components/PurchaseRequestForm";
import PreviewPDF from "@/components/PreviewPDF";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import { Loader2 } from "lucide-react";
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function NewPurchaseRequestForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [headerPosition, setHeaderPosition] = useState({ x: 0, y: 0 });
  const [footerPosition, setFooterPosition] = useState({ x: 0, y: 0 });

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: subPurposes = [], isLoading: subPurposesLoading } = useQuery<SubPurpose[]>({
    queryKey: ["/api/subpurposes"],
  });

  const { data: branding } = useQuery({
    queryKey: ["/api/branding"],
  });

  const handlePositionChange = (type: 'header' | 'footer', position: { x: number, y: number }) => {
    if (type === 'header') {
      setHeaderPosition(position);
    } else {
      setFooterPosition(position);
    }
  };

  // Handle vendor creation
  const handleVendorCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
  };

  const generatePDF = (formData: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    let startY = margin;

    // Helper function to add header and footer with custom positions
    const addHeaderAndFooter = () => {
      try {
        if (branding?.headerImage) {
          const headerHeight = pageHeight * 0.15;
          doc.addImage(
            `data:${branding.headerImageMimeType};base64,${branding.headerImage}`,
            'JPEG',
            headerPosition.x,
            headerPosition.y,
            pageWidth,
            headerHeight
          );
          startY = headerHeight + headerPosition.y + 10;
          console.log("Header image added successfully at position:", headerPosition);
        }

        if (branding?.footerImage) {
          const footerHeight = pageHeight * 0.1;
          doc.addImage(
            `data:${branding.footerImageMimeType};base64,${branding.footerImage}`,
            'JPEG',
            footerPosition.x,
            pageHeight - footerHeight + footerPosition.y,
            pageWidth,
            footerHeight
          );
          console.log("Footer image added successfully at position:", footerPosition);
        }
      } catch (error) {
        console.error("Error adding header/footer images:", error);
      }
    };

    // Add header and footer to first page
    addHeaderAndFooter();

    // Request information
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Request Number: ${formData.requestNumber || "New Request"}`, margin, startY);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - margin, startY, { align: "right" });

    // Basic Information Section
    doc.setFontSize(14);
    doc.setTextColor(branding?.primaryColor || "#7156a2");
    doc.text("Request Details", margin, startY + 20);

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
      startY: startY + 25,
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
      margin: { left: margin, right: margin }
    });

    // Items Section
    const currentY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.setTextColor(branding?.primaryColor || "#7156a2");
    doc.text("Items", margin, currentY);

    const itemsTableHead = [["Item Name", "Description", "Quantity", "Unit Cost", "Total Cost"]];
    const itemsTableBody = formData.items?.map((item: any) => [
      item.name,
      item.description || "",
      item.quantity,
      `${formData.currency} ${item.estimatedCost}`,
      `${formData.currency} ${(item.quantity * item.estimatedCost).toFixed(2)}`
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
      console.log("Starting PDF generation with branding and positions:", {
        headerPosition,
        footerPosition,
        headerImage: branding?.headerImage ? "present" : "missing",
        footerImage: branding?.footerImage ? "present" : "missing"
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

        <div className="space-y-6">
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

          <div className="bg-white rounded-lg shadow-md p-6 border border-[#35bbba]/20">
            <div className="border-b border-[#7156a2]/10 pb-4 mb-6">
              <h2 className="text-xl font-bold text-[#7156a2]">
                PDF Preview
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Preview how your PDF will look and adjust header/footer positions
              </p>
            </div>

            <PreviewPDF 
              branding={branding}
              formData={queryClient.getQueryData(["currentFormData"])}
              onPositionChange={handlePositionChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}