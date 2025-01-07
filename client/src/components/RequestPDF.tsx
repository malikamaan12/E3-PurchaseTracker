import React from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface RequestPDFProps {
  request: any; // Replace with proper type from your schema
  isOpen: boolean;
  onClose: () => void;
}

export function RequestPDF({ request, isOpen, onClose }: RequestPDFProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0">
        <div className="w-[595px] h-[842px] relative rounded-lg overflow-hidden shadow-lg bg-white"> {/* A4 dimensions */}
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-white border-b z-10">
            <div className="text-center space-y-2">
              <h1 className="text-xl font-bold text-gray-900">EVENTS & ENTERTAINMENT ENTERPRISES</h1>
              <h2 className="text-lg font-semibold text-gray-700">PURCHASE REQUEST</h2>
            </div>
          </div>

          {/* Content */}
          <div className="request-pdf-content p-6 mt-20">
            <div className="space-y-4">
              {/* Request Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-600">Request Number:</p>
                  <p className="text-sm">{request.requestNumber}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600">Date:</p>
                  <p className="text-sm">{new Date(request.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-600">Title:</p>
                <p className="text-sm">{request.title}</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-600">Description:</p>
                <p className="text-sm">{request.description}</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-600">Purpose Type:</p>
                <p className="text-sm">{request.purposeType}</p>
              </div>

              {/* Items Table */}
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-2">Items:</p>
                <table className="print-table">
                  <thead>
                    <tr>
                      <th className="text-left">Name</th>
                      <th className="text-left">Description</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Cost</th>
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
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="text-right font-semibold">Total:</td>
                      <td className="text-right font-semibold">
                        ${request.totalEstimatedCost}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Requester Information */}
              <div>
                <p className="text-sm font-semibold text-gray-600">Requester:</p>
                <p className="text-sm">{request.requester?.username}</p>
                <p className="text-sm text-gray-500">{request.requester?.department}</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t z-10 flex justify-between items-center">
            <p className="text-sm text-gray-600">ALL RIGHTS RESERVED BY E3</p>
            <Button onClick={() => window.print()} className="no-print" variant="secondary" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}