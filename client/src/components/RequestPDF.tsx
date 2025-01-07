import React from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface RequestPDFProps {
  request: any; // Replace with proper type from your schema
  isOpen: boolean;
  onClose: () => void;
}

export function RequestPDF({ request, isOpen, onClose }: RequestPDFProps) {
  const { toast } = useToast();
  const { data: pdfSettings } = useQuery({ queryKey: ["/api/pdf-settings"] });

  // Function to log PDF events
  const logPDFEvent = async (action: 'pdf_viewed' | 'pdf_downloaded' | 'pdf_generated') => {
    try {
      const response = await fetch('/api/pdf/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          requestId: request.id
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to log PDF event');
      }
    } catch (error) {
      console.error('Error logging PDF event:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to log PDF operation"
      });
    }
  };

  // Log view event when PDF is opened
  React.useEffect(() => {
    if (isOpen) {
      logPDFEvent('pdf_viewed');
    }
  }, [isOpen]);

  // Handle PDF download
  const handleDownload = async () => {
    await logPDFEvent('pdf_downloaded');
    window.print();
  };

  const headerColor = pdfSettings?.headerColor || '#1a365d';
  const footerColor = pdfSettings?.footerColor || '#1a365d';
  const headerTitle = pdfSettings?.headerTitle || 'EVENTS & ENTERTAINMENT ENTERPRISES';
  const headerSubtitle = pdfSettings?.headerSubtitle || 'PURCHASE REQUEST';
  const footerText = pdfSettings?.footerText || 'ALL RIGHTS RESERVED BY E3';
  const watermarkText = pdfSettings?.watermarkText;
  const watermarkOpacity = pdfSettings?.watermarkOpacity || 0.1;

  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: request.currency || 'USD'
    }).format(value);
  };

  // Parse items from JSON string
  const items = JSON.parse(request.items);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[210mm] p-0">
        <div className="pdf-container">
          {/* Header */}
          <div 
            className="pdf-header"
            style={{ 
              backgroundColor: `${headerColor}10`,
              borderColor: headerColor
            }}
          >
            {pdfSettings?.companyLogo && (
              <img 
                src={pdfSettings.companyLogo} 
                alt="Company Logo" 
                className="h-16 mb-4"
              />
            )}
            <h1 
              className="text-2xl font-bold tracking-tight"
              style={{ color: headerColor }}
            >
              {headerTitle}
            </h1>
            <h2 className="text-xl font-semibold mt-2">
              {headerSubtitle}
            </h2>
          </div>

          {/* Content */}
          <div className="pdf-content">
            {/* Watermark if enabled */}
            {watermarkText && (
              <div 
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ opacity: watermarkOpacity }}
              >
                <div className="rotate-[-45deg] text-4xl text-gray-200">
                  {watermarkText}
                </div>
              </div>
            )}

            {/* Request Info */}
            <div className="pdf-section">
              <div className="pdf-grid">
                <div>
                  <p className="pdf-label">Request Number:</p>
                  <p className="pdf-value">{request.requestNumber}</p>
                </div>
                <div>
                  <p className="pdf-label">Date:</p>
                  <p className="pdf-value">
                    {new Date(request.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Request Details */}
            <div className="pdf-section">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="pdf-label">Title:</p>
                  <p className="pdf-value">{request.title}</p>
                </div>
                <div>
                  <p className="pdf-label">Status:</p>
                  <p className="pdf-value capitalize">{request.status}</p>
                </div>
                <div>
                  <p className="pdf-label">Purpose Type:</p>
                  <p className="pdf-value">{request.purposeType}</p>
                </div>
                <div>
                  <p className="pdf-label">Sub Purpose:</p>
                  <p className="pdf-value">{request.subPurpose?.name}</p>
                </div>
                <div>
                  <p className="pdf-label">Priority:</p>
                  <p className="pdf-value capitalize">{request.priority}</p>
                </div>
                <div>
                  <p className="pdf-label">Currency:</p>
                  <p className="pdf-value">{request.currency || 'USD'}</p>
                </div>
              </div>
              <div className="mt-4">
                <p className="pdf-label">Description:</p>
                <p className="pdf-value whitespace-pre-wrap">{request.description}</p>
              </div>
            </div>

            {/* Vendor Details */}
            <div className="pdf-section">
              <h3 className="text-lg font-semibold mb-2">Vendor Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="pdf-label">Company Name:</p>
                  <p className="pdf-value">{request.vendor?.companyName}</p>
                </div>
                <div>
                  <p className="pdf-label">Contact Person:</p>
                  <p className="pdf-value">{request.vendor?.contactPerson}</p>
                </div>
                <div>
                  <p className="pdf-label">Email:</p>
                  <p className="pdf-value">{request.vendor?.email}</p>
                </div>
                <div>
                  <p className="pdf-label">Phone:</p>
                  <p className="pdf-value">{request.vendor?.phone}</p>
                </div>
                <div className="col-span-2">
                  <p className="pdf-label">Address:</p>
                  <p className="pdf-value">{request.vendor?.address}</p>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="pdf-section">
              <h3 className="text-lg font-semibold mb-2">Items</h3>
              <table className="pdf-table">
                <thead style={{ backgroundColor: `${headerColor}10` }}>
                  <tr>
                    <th>Item Name</th>
                    <th>Description</th>
                    <th className="text-right">Quantity</th>
                    <th className="text-right">Unit Cost</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any, index: number) => (
                    <tr key={index}>
                      <td>{item.name}</td>
                      <td>{item.description}</td>
                      <td className="text-right">{item.quantity}</td>
                      <td className="text-right">{formatCurrency(item.estimatedCost)}</td>
                      <td className="text-right">
                        {formatCurrency(item.quantity * item.estimatedCost)}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-medium" style={{ backgroundColor: `${headerColor}05` }}>
                    <td colSpan={4} className="text-right border-t">Subtotal:</td>
                    <td className="text-right border-t">
                      {formatCurrency(request.totalEstimatedCost)}
                    </td>
                  </tr>
                  {request.freightAmount > 0 && (
                    <tr className="font-medium" style={{ backgroundColor: `${headerColor}05` }}>
                      <td colSpan={4} className="text-right">Freight Amount:</td>
                      <td className="text-right">{formatCurrency(request.freightAmount)}</td>
                    </tr>
                  )}
                  <tr className="font-bold" style={{ backgroundColor: `${headerColor}10` }}>
                    <td colSpan={4} className="text-right">Grand Total:</td>
                    <td className="text-right">
                      {formatCurrency(request.totalEstimatedCost + (request.freightAmount || 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Attachments */}
            {request.attachments?.length > 0 && (
              <div className="pdf-section">
                <h3 className="text-lg font-semibold mb-2">Attached Documents</h3>
                <table className="pdf-table">
                  <thead style={{ backgroundColor: `${headerColor}10` }}>
                    <tr>
                      <th>File Name</th>
                      <th>Type</th>
                      <th className="text-right">Size</th>
                      <th>Upload Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {request.attachments.map((attachment: any, index: number) => (
                      <tr key={index}>
                        <td>{attachment.fileName}</td>
                        <td>{attachment.fileType}</td>
                        <td className="text-right">
                          {Math.round(attachment.fileSize / 1024)} KB
                        </td>
                        <td>
                          {new Date(attachment.uploadedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Requester Info */}
            <div className="pdf-section">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="pdf-label">Requester:</p>
                  <p className="pdf-value">{request.requester?.username}</p>
                  <p className="text-sm text-gray-500">{request.requester?.department}</p>
                </div>
                {request.approver && (
                  <div>
                    <p className="pdf-label">Approved By:</p>
                    <p className="pdf-value">{request.approver.username}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(request.approvalDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div 
            className="pdf-footer"
            style={{ 
              backgroundColor: `${footerColor}10`,
              borderColor: footerColor
            }}
          >
            <div className="flex justify-between items-center">
              <p 
                className="text-sm font-medium"
                style={{ color: footerColor }}
              >
                {footerText}
              </p>
              <Button onClick={handleDownload} className="no-print" variant="secondary" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
            {pdfSettings?.pageNumbering && (
              <div className="absolute bottom-4 right-4 text-sm text-gray-500 no-print">
                Page 1
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}