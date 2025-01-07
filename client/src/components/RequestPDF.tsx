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
        <div className="pdf-page">
          {/* Header Section */}
          <div className="pdf-header">
            <h1 className="text-2xl font-bold">EVENTS & ENTERTAINMENT ENTERPRISES</h1>
            <h2 className="text-xl font-semibold mt-2">PURCHASE REQUEST</h2>
          </div>

          {/* Content Section */}
          <div className="pdf-content">
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

            {/* Request Details */}
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
              <div className="pdf-table-container">
                <table className="pdf-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Description</th>
                      <th className="text-right w-16">Qty</th>
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
                    <tr className="font-semibold">
                      <td colSpan={3} className="text-right">Total:</td>
                      <td className="text-right">${request.totalEstimatedCost}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Requester Info */}
            <div>
              <p className="text-sm font-semibold text-gray-600">Requester:</p>
              <p className="text-sm">{request.requester?.username}</p>
              <p className="text-sm text-gray-500">{request.requester?.department}</p>
            </div>
          </div>

          {/* Footer Section */}
          <div className="pdf-footer">
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