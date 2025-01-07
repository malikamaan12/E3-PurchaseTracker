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
        <div className="request-pdf">
          {/* Header */}
          <div className="request-pdf-header">
            <h1 className="text-xl font-bold text-gray-900">EVENTS & ENTERTAINMENT ENTERPRISES</h1>
            <h2 className="text-lg font-semibold text-gray-700">PURCHASE REQUEST</h2>
          </div>

          {/* Content */}
          <div className="request-pdf-content">
            <div className="space-y-6">
              {/* Request Details */}
              <div className="space-y-4">
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
          </div>

          {/* Footer */}
          <div className="request-pdf-footer">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">ALL RIGHTS RESERVED BY E3</p>
              <Button onClick={() => window.print()} className="no-print" variant="secondary" size="sm">
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