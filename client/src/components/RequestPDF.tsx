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

  // Handle PDF download
  const handleDownload = async () => {
    window.print();
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
      <DialogContent className="max-w-[210mm] p-0">
        <div className="pdf-container">
          <div className="pdf-header">
            <h1 className="text-2xl font-bold mb-1">Purchase Request</h1>
          </div>

          <div className="pdf-content">
            {/* Request Purpose & Priority */}
            <div className="pdf-section border-b pb-4">
              <h3 className="text-lg font-semibold mb-3">Request Purpose & Priority</h3>
              <div className="grid grid-cols-2 gap-x-8">
                <div>
                  <p className="pdf-label">Purpose Type</p>
                  <p className="pdf-value">{request.purposeType || 'E3 EVENT'}</p>
                </div>
                <div>
                  <p className="pdf-label">Sub-purpose</p>
                  <p className="pdf-value">{request.subPurpose?.name || 'Lego2025'}</p>
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <div className="pdf-section border-b pb-4">
              <h3 className="text-lg font-semibold mb-3">Basic Information</h3>
              <div>
                <p className="pdf-label">Request Title</p>
                <p className="pdf-value mb-4">{request.title}</p>

                <p className="pdf-label">Description</p>
                <p className="pdf-value whitespace-pre-wrap">{request.description}</p>
              </div>
            </div>

            {/* Items */}
            <div className="pdf-section">
              <h3 className="text-lg font-semibold mb-3">Items</h3>
              <table className="pdf-table">
                <thead className="bg-gray-100">
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Quantity</th>
                    <th className="text-right">Unit Cost</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any, index: number) => (
                    <tr key={index}>
                      <td>{item.name}</td>
                      <td className="text-right">{item.quantity}</td>
                      <td className="text-right">{formatCurrency(item.estimatedCost)}</td>
                      <td className="text-right">
                        {formatCurrency(item.quantity * item.estimatedCost)}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-medium">
                    <td colSpan={3} className="text-right border-t">Items Total:</td>
                    <td className="text-right border-t">
                      {formatCurrency(request.totalEstimatedCost)}
                    </td>
                  </tr>
                  {request.freightAmount > 0 && (
                    <tr className="font-medium">
                      <td colSpan={3} className="text-right">Freight Amount:</td>
                      <td className="text-right">{formatCurrency(request.freightAmount)}</td>
                    </tr>
                  )}
                  <tr className="font-bold">
                    <td colSpan={3} className="text-right border-t">Total Cost:</td>
                    <td className="text-right border-t">
                      {formatCurrency(request.totalEstimatedCost + (request.freightAmount || 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Generated Information */}
            <div className="pdf-footer-info">
              <p className="text-sm text-gray-500">
                Generated on {new Date().toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-500">
                Page 1
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons - Only visible in preview */}
        <div className="no-print flex justify-end p-4 border-t">
          <Button onClick={handleDownload} variant="secondary" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}