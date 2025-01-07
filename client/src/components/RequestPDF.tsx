import React, { useEffect, useState } from 'react';
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
  const [appliedStyles, setAppliedStyles] = useState<string>("");

  // Fetch PDF layout from Anthropic service
  const { data: pdfData, isLoading, error } = useQuery({
    queryKey: [`/api/requests/${request.id}/pdf`],
    enabled: isOpen,
  });

  useEffect(() => {
    if (pdfData?.layout?.styles) {
      // Apply generated styles
      const styleElement = document.createElement('style');
      styleElement.textContent = pdfData.layout.styles;
      document.head.appendChild(styleElement);
      setAppliedStyles(pdfData.layout.styles);

      return () => {
        document.head.removeChild(styleElement);
      };
    }
  }, [pdfData]);

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[210mm] p-0">
          <div className="flex items-center justify-center h-[297mm]">
            <p>Generating optimized PDF layout...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    toast({
      title: "Error",
      description: "Failed to generate PDF layout. Please try again.",
      variant: "destructive",
    });
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[210mm] p-0">
        <div className="a4-container">
          {pdfData?.layout?.layout ? (
            <div
              dangerouslySetInnerHTML={{ __html: pdfData.layout.layout }}
            />
          ) : (
            <>
              <div className="a4-header">
                <div className="text-center">
                  <h1 className="text-xl font-bold tracking-wide">EVENTS & ENTERTAINMENT ENTERPRISES</h1>
                  <h2 className="text-lg font-semibold mt-2">PURCHASE REQUEST</h2>
                </div>
              </div>

              <div className="a4-content">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Request Number:</p>
                    <p className="text-sm">{request.requestNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Date:</p>
                    <p className="text-sm">{new Date(request.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Title:</p>
                    <p className="text-sm">{request.title}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Description:</p>
                    <p className="text-sm">{request.description}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Purpose Type:</p>
                    <p className="text-sm">{request.purposeType}</p>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-sm font-medium text-gray-600 mb-2">Items:</p>
                  <div className="a4-table-container">
                    <table className="a4-table">
                      <thead>
                        <tr>
                          <th>Item Name</th>
                          <th>Description</th>
                          <th className="text-right w-20">Quantity</th>
                          <th className="text-right w-24">Cost</th>
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
                </div>

                <div className="mt-6">
                  <p className="text-sm font-medium text-gray-600">Requester:</p>
                  <p className="text-sm">{request.requester?.username}</p>
                  <p className="text-sm text-gray-500">{request.requester?.department}</p>
                </div>
              </div>

              <div className="a4-footer">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium">ALL RIGHTS RESERVED BY E3</p>
                  <Button onClick={() => window.print()} className="no-print" variant="secondary" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}