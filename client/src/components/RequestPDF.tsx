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
      <DialogContent className="max-w-3xl p-0">
        <div className="print-container w-[210mm] min-h-[297mm] mx-auto bg-white shadow-lg overflow-hidden relative">
          {/* Header Section */}
          <div className="print-header py-6 px-8 text-center border-b bg-white">
            <h1 className="text-2xl font-bold text-gray-900 uppercase">Events & Entertainment Enterprises</h1>
            <h2 className="text-xl font-semibold text-gray-700 mt-2 uppercase">Purchase Request</h2>
          </div>

          {/* Content Section */}
          <div className="print-content px-8 py-6">
            {/* Request Info */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-sm font-semibold text-gray-600">Request Number:</p>
                <p className="text-sm">{request.requestNumber}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Date:</p>
                <p className="text-sm">{new Date(request.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-4 mb-6">
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
            </div>

            {/* Items Table */}
            <div className="mb-6">
              <p className="text-sm font-semibold text-gray-600 mb-2">Items:</p>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="bg-gray-50 px-3 py-1.5 text-left border font-semibold">Name</th>
                    <th className="bg-gray-50 px-3 py-1.5 text-left border font-semibold">Description</th>
                    <th className="bg-gray-50 px-3 py-1.5 text-right border font-semibold w-16">Qty</th>
                    <th className="bg-gray-50 px-3 py-1.5 text-right border font-semibold w-24">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {JSON.parse(request.items).map((item: any, index: number) => (
                    <tr key={index}>
                      <td className="border px-3 py-1">{item.name}</td>
                      <td className="border px-3 py-1">{item.description}</td>
                      <td className="border px-3 py-1 text-right">{item.quantity}</td>
                      <td className="border px-3 py-1 text-right">${item.estimatedCost}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={3} className="border px-3 py-1.5 text-right font-semibold">Total:</td>
                    <td className="border px-3 py-1.5 text-right font-semibold">
                      ${request.totalEstimatedCost}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Requester Info */}
            <div>
              <p className="text-sm font-semibold text-gray-600">Requester:</p>
              <p className="text-sm">{request.requester?.username}</p>
              <p className="text-sm text-gray-500">{request.requester?.department}</p>
            </div>
          </div>

          {/* Footer Section */}
          <div className="print-footer absolute bottom-0 left-0 right-0 py-4 px-8 border-t bg-white">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-gray-600">ALL RIGHTS RESERVED BY E3</p>
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