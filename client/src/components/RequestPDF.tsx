import React from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RequestPDFProps {
  request: any; // Replace with proper type from your schema
  isOpen: boolean;
  onClose: () => void;
}

export function RequestPDF({ request, isOpen, onClose }: RequestPDFProps) {
  const { toast } = useToast();

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[210mm] p-0">
        <div className="pdf-container">
          {/* Header */}
          <div className="pdf-header">
            <h1 className="text-2xl font-bold tracking-tight">EVENTS & ENTERTAINMENT ENTERPRISES</h1>
            <h2 className="text-xl font-semibold mt-2">PURCHASE REQUEST</h2>
          </div>

          {/* Content */}
          <div className="pdf-content">
            {/* Request Info */}
            <div className="pdf-section">
              <div className="pdf-grid">
                <div>
                  <p className="pdf-label">Request Number:</p>
                  <p className="pdf-value">{request.requestNumber}</p>
                </div>
                <div>
                  <p className="pdf-label">Date:</p>
                  <p className="pdf-value">{new Date(request.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Request Details */}
            <div className="pdf-section">
              <div>
                <p className="pdf-label">Title:</p>
                <p className="pdf-value">{request.title}</p>
              </div>
              <div className="mt-4">
                <p className="pdf-label">Description:</p>
                <p className="pdf-value">{request.description}</p>
              </div>
              <div className="mt-4">
                <p className="pdf-label">Purpose Type:</p>
                <p className="pdf-value">{request.purposeType}</p>
              </div>
            </div>

            {/* Items Table */}
            <div className="pdf-section">
              <p className="pdf-label mb-2">Items:</p>
              <table className="pdf-table">
                <thead>
                  <tr>
                    <th className="w-1/3">Item Name</th>
                    <th className="w-1/3">Description</th>
                    <th className="text-right w-20">Quantity</th>
                    <th className="text-right w-28">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {JSON.parse(request.items).map((item: any, index: number) => (
                    <tr key={index}>
                      <td>{item.name}</td>
                      <td>{item.description}</td>
                      <td className="text-right">{item.quantity}</td>
                      <td className="text-right">${item.estimatedCost}</td>
                    </tr>
                  ))}
                  <tr className="font-medium">
                    <td colSpan={3} className="text-right border-t">Total:</td>
                    <td className="text-right border-t">${request.totalEstimatedCost}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Requester Info */}
            <div className="pdf-section">
              <p className="pdf-label">Requester:</p>
              <p className="pdf-value">{request.requester?.username}</p>
              <p className="text-sm text-gray-500">{request.requester?.department}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="pdf-footer">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-gray-600">ALL RIGHTS RESERVED BY E3</p>
              <Button onClick={handleDownload} className="no-print" variant="secondary" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}