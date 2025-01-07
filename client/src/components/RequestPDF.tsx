import React, { useState } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { PDFCustomizationControls, type PDFConfig } from "./PDFCustomizationControls";

interface RequestPDFProps {
  request: any; // Replace with proper type from your schema
  isOpen: boolean;
  onClose: () => void;
}

export function RequestPDF({ request, isOpen, onClose }: RequestPDFProps) {
  const [pdfConfig, setPDFConfig] = useState<PDFConfig>({
    header: {
      title: "EVENTS & ENTERTAINMENT ENTERPRISES",
      subtitle: "PURCHASE REQUEST",
      showLogo: true,
      color: "#000000",
      fontSize: 16
    },
    content: {
      fontFamily: "Arial",
      fontSize: 12,
      spacing: 1.5
    },
    footer: {
      text: "ALL RIGHTS RESERVED BY E3",
      showPageNumbers: true,
      color: "#666666",
      fontSize: 12
    }
  });

  const getHeaderStyle = () => ({
    color: pdfConfig.header.color,
    fontSize: `${pdfConfig.header.fontSize}px`,
    fontFamily: pdfConfig.content.fontFamily
  });

  const getContentStyle = () => ({
    fontFamily: pdfConfig.content.fontFamily,
    fontSize: `${pdfConfig.content.fontSize}px`,
    lineHeight: pdfConfig.content.spacing
  });

  const getFooterStyle = () => ({
    color: pdfConfig.footer.color,
    fontSize: `${pdfConfig.footer.fontSize}px`,
    fontFamily: pdfConfig.content.fontFamily
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-screen-xl p-6">
        <div className="grid grid-cols-2 gap-6">
          {/* PDF Preview */}
          <div>
            <div className="w-[595px] h-[842px] relative rounded-lg overflow-hidden shadow-lg bg-white"> {/* A4 dimensions */}
              {/* Header */}
              <div className="absolute top-0 left-0 right-0 p-4 bg-white border-b z-10">
                <div className="text-center space-y-2" style={getHeaderStyle()}>
                  <h1 className="font-bold">{pdfConfig.header.title}</h1>
                  <h2 className="font-semibold">{pdfConfig.header.subtitle}</h2>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 mt-20" style={getContentStyle()}>
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
                    <p className="font-semibold text-gray-600">Requester:</p>
                    <p>{request.requester?.username}</p>
                    <p className="text-gray-500">{request.requester?.department}</p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t z-10 flex justify-between items-center" style={getFooterStyle()}>
                <p>{pdfConfig.footer.text}</p>
                <Button onClick={() => window.print()} className="no-print" variant="secondary" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          </div>

          {/* Customization Controls */}
          <div className="h-[842px] overflow-y-auto">
            <PDFCustomizationControls
              defaultConfig={pdfConfig}
              onConfigChange={setPDFConfig}
              onReset={() => setPDFConfig({
                header: {
                  title: "EVENTS & ENTERTAINMENT ENTERPRISES",
                  subtitle: "PURCHASE REQUEST",
                  showLogo: true,
                  color: "#000000",
                  fontSize: 16
                },
                content: {
                  fontFamily: "Arial",
                  fontSize: 12,
                  spacing: 1.5
                },
                footer: {
                  text: "ALL RIGHTS RESERVED BY E3",
                  showPageNumbers: true,
                  color: "#666666",
                  fontSize: 12
                }
              })}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}