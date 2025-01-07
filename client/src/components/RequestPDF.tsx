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
        <div className="w-[595px] h-[842px] relative rounded-lg overflow-hidden shadow-lg bg-white"> {/* A4 dimensions in pixels */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-white border-b z-10">
            <div className="text-center space-y-2">
              <h1 className="text-xl font-bold text-gray-900">EVENTS & ENTERTAINMENT ENTERPRISES</h1>
              <h2 className="text-lg font-semibold text-gray-700">PURCHASE REQUEST</h2>
            </div>
          </div>

          <div className="mt-16 h-[calc(100%-88px)] overflow-y-auto px-6 py-4"> {/* Adjusted for header and footer height */}
            <div className="space-y-4">
              {/* Request Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-gray-600">Request Number:</p>
                  <p>{request.requestNumber}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-600">Date:</p>
                  <p>{new Date(request.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-gray-600">Title:</p>
                <p>{request.title}</p>
              </div>

              <div>
                <p className="font-semibold text-gray-600">Description:</p>
                <p>{request.description}</p>
              </div>

              <div>
                <p className="font-semibold text-gray-600">Purpose Type:</p>
                <p>{request.purposeType}</p>
              </div>

              {/* Items Table */}
              <div>
                <p className="font-semibold text-gray-600 mb-2">Items:</p>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border px-3 py-2 text-left">Name</th>
                      <th className="border px-3 py-2 text-left">Description</th>
                      <th className="border px-3 py-2 text-right">Qty</th>
                      <th className="border px-3 py-2 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {JSON.parse(request.items).map((item: any, index: number) => (
                      <tr key={index}>
                        <td className="border px-3 py-2">{item.name}</td>
                        <td className="border px-3 py-2">{item.description}</td>
                        <td className="border px-3 py-2 text-right">{item.quantity}</td>
                        <td className="border px-3 py-2 text-right">${item.estimatedCost}</td>
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
              <div>
                <p className="font-semibold text-gray-600">Requester:</p>
                <p>{request.requester?.username}</p>
                <p className="text-gray-500">{request.requester?.department}</p>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t z-10 flex justify-between items-center">
            <p className="text-gray-600">ALL RIGHTS RESERVED BY E3</p>
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