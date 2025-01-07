import React from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateRequestPDF } from '@/lib/pdfGenerator';

interface RequestPDFProps {
  request: any; // Replace with proper type from your schema
  isOpen: boolean;
  onClose: () => void;
}

export function RequestPDF({ request, isOpen, onClose }: RequestPDFProps) {
  const { toast } = useToast();

  // Handle PDF download
  const handleDownload = async () => {
    try {
      const doc = await generateRequestPDF(request);
      doc.save(`Purchase_Request_${request.requestNumber}.pdf`);

      toast({
        title: "Success",
        description: "PDF downloaded successfully",
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Error",
        description: "Failed to download PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'QAR'
    }).format(value);
  };

  // Parse items from JSON string if needed
  const items = Array.isArray(request.items) ? request.items : JSON.parse(request.items || '[]');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0">
        <div className="pdf-container">
          {/* PDF Preview Header */}
          <div className="pdf-header no-print">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Purchase Request Preview</h2>
              <Button onClick={handleDownload} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>

          {/* PDF Content Preview */}
          <div className="pdf-content">
            {/* Basic Information */}
            <div className="pdf-section">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="pdf-label">Request Number</p>
                  <p className="pdf-value">{request.requestNumber}</p>
                </div>
                <div>
                  <p className="pdf-label">Status</p>
                  <p className="pdf-value capitalize">{request.status}</p>
                </div>
                <div>
                  <p className="pdf-label">Priority</p>
                  <p className="pdf-value capitalize">{request.priority}</p>
                </div>
                <div>
                  <p className="pdf-label">Created Date</p>
                  <p className="pdf-value">
                    {new Date(request.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Title and Description */}
            <div className="pdf-section">
              <div className="mb-4">
                <p className="pdf-label">Title</p>
                <p className="pdf-value">{request.title}</p>
              </div>
              <div>
                <p className="pdf-label">Description</p>
                <p className="pdf-value whitespace-pre-wrap">{request.description}</p>
              </div>
            </div>

            {/* Purpose Information */}
            <div className="pdf-section">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Purpose Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="pdf-label">Purpose Type</p>
                  <p className="pdf-value">{request.purposeType}</p>
                </div>
                <div>
                  <p className="pdf-label">Sub-purpose</p>
                  <p className="pdf-value">{request.subPurpose?.name}</p>
                </div>
              </div>
            </div>

            {/* Vendor Information */}
            <div className="pdf-section">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Vendor Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="pdf-label">Vendor Name</p>
                  <p className="pdf-value">{request.vendor?.name}</p>
                </div>
                <div>
                  <p className="pdf-label">Contact Person</p>
                  <p className="pdf-value">{request.vendor?.contactPerson}</p>
                </div>
                <div>
                  <p className="pdf-label">Email</p>
                  <p className="pdf-value">{request.vendor?.email}</p>
                </div>
                <div>
                  <p className="pdf-label">Phone</p>
                  <p className="pdf-value">{request.vendor?.phone}</p>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="pdf-section">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Items</h3>
              <div className="overflow-x-auto">
                <table className="pdf-table">
                  <thead>
                    <tr>
                      <th>Item</th>
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
                        <td className="text-right">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: request.currency || 'QAR'
                          }).format(item.estimatedCost)}
                        </td>
                        <td className="text-right">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: request.currency || 'QAR'
                          }).format(item.quantity * item.estimatedCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="text-right font-medium">Items Total:</td>
                      <td className="text-right font-medium">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: request.currency || 'QAR'
                        }).format(request.totalEstimatedCost)}
                      </td>
                    </tr>
                    {request.freightAmount > 0 && (
                      <tr>
                        <td colSpan={4} className="text-right font-medium">Freight Amount:</td>
                        <td className="text-right font-medium">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: request.currency || 'QAR'
                          }).format(request.freightAmount)}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={4} className="text-right font-bold">Total Cost:</td>
                      <td className="text-right font-bold">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: request.currency || 'QAR'
                        }).format(request.totalEstimatedCost + (request.freightAmount || 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Attached Documents */}
            {request.attachments?.length > 0 && (
              <div className="pdf-section">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Attached Documents</h3>
                <table className="pdf-table">
                  <thead>
                    <tr>
                      <th>Document Name</th>
                      <th>Type</th>
                      <th>Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {request.attachments.map((file: any, index: number) => (
                      <tr key={index}>
                        <td>{file.name}</td>
                        <td>{file.type}</td>
                        <td>
                          {file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}