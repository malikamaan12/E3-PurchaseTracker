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
        <div className="w-[595px] min-h-[842px] relative bg-white shadow-lg mx-auto"> {/* A4 size in pixels */}
          {/* Header */}
          <div className="py-8 px-6 text-center border-b">
            <h1 className="text-2xl font-bold mb-2">EVENTS & ENTERTAINMENT ENTERPRISES</h1>
            <h2 className="text-xl font-semibold">PURCHASE REQUEST</h2>
          </div>

          {/* Content */}
          <div className="px-8 py-6">
            <div className="space-y-6">
              {/* Top Section */}
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-sm font-semibold mb-1">Request Number:</p>
                  <p className="text-sm">{request.requestNumber}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1">Date:</p>
                  <p className="text-sm">{new Date(request.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Request Details */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold mb-1">Title:</p>
                  <p className="text-sm">{request.title}</p>
                </div>

                <div>
                  <p className="text-sm font-semibold mb-1">Description:</p>
                  <p className="text-sm">{request.description}</p>
                </div>

                <div>
                  <p className="text-sm font-semibold mb-1">Purpose Type:</p>
                  <p className="text-sm">{request.purposeType}</p>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <p className="text-sm font-semibold mb-2">Items:</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="bg-gray-50 px-3 py-2 text-left border font-semibold">Name</th>
                      <th className="bg-gray-50 px-3 py-2 text-left border font-semibold">Description</th>
                      <th className="bg-gray-50 px-3 py-2 text-right border font-semibold w-20">Qty</th>
                      <th className="bg-gray-50 px-3 py-2 text-right border font-semibold w-24">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {JSON.parse(request.items).map((item: any, index: number) => (
                      <tr key={index}>
                        <td className="border px-3 py-1.5">{item.name}</td>
                        <td className="border px-3 py-1.5">{item.description}</td>
                        <td className="border px-3 py-1.5 text-right">{item.quantity}</td>
                        <td className="border px-3 py-1.5 text-right">${item.estimatedCost}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={3} className="border px-3 py-2 text-right font-semibold">Total:</td>
                      <td className="border px-3 py-2 text-right font-semibold">
                        ${request.totalEstimatedCost}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Requester Information */}
              <div className="pt-4">
                <p className="text-sm font-semibold mb-1">Requester:</p>
                <p className="text-sm">{request.requester?.username}</p>
                <p className="text-sm text-gray-500">{request.requester?.department}</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 py-4 px-8 border-t bg-white">
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