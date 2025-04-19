import React, { useState, useEffect } from "react";
import { PdfSettings, DEFAULT_PDF_SETTINGS } from "../services/pdfService";
import { Card } from "@/components/ui/card";
import { Spinner } from "../components/ui/spinner";

interface PDFPreviewProps {
  settings?: Partial<PdfSettings>;
  previewData?: any;
}

const PDFPreview: React.FC<PDFPreviewProps> = ({
  settings = {},
  previewData,
}) => {
  const [loading, setLoading] = useState(true);

  // Ensure settings is never undefined
  const safeSettings = settings || {};

  useEffect(() => {
    // Simulate loading of PDF preview
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Apply settings to create a visual representation of the PDF
  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Spinner size="lg" label="Generating preview..." />
        </div>
      );
    }

    return (
      <div className="pdf-preview-container">
        {/* PDF Page Preview */}
        <div className="paper a4 mx-auto shadow-lg bg-white">
          {/* Header */}
          {safeSettings.showHeader !== false && (
            <div
              className="pdf-header"
              style={{
                backgroundColor: safeSettings.headerColor || "#0066cc",
                height: `${safeSettings.headerHeight || 60}px`,
                color: "#ffffff",
                padding: "8px 15px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div className="flex items-center">
                {safeSettings.showLogo !== false && safeSettings.logo && (
                  <div
                    className="pdf-logo mr-4"
                    style={{
                      justifyContent:
                        safeSettings.logoPosition === "center"
                          ? "center"
                          : safeSettings.logoPosition === "right"
                            ? "flex-end"
                            : "flex-start",
                    }}
                  >
                    <img
                      src={safeSettings.logo}
                      alt="Logo"
                      className="h-10 object-contain"
                    />
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-bold">
                    {safeSettings.headerTitle || "Purchase Request"}
                  </h1>
                  {safeSettings.headerSubtitle && (
                    <p className="text-sm">{safeSettings.headerSubtitle}</p>
                  )}
                </div>
              </div>

              {safeSettings.headerImage && (
                <div className="pdf-header-image">
                  <img
                    src={safeSettings.headerImage}
                    alt="Header"
                    className="h-12 object-contain"
                  />
                </div>
              )}
            </div>
          )}

          {/* Watermark (if enabled) */}
          {safeSettings.useWatermark && (
            <div
              className="pdf-watermark absolute"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                alignItems:
                  safeSettings.watermarkPosition === "corner"
                    ? "flex-start"
                    : "center",
                justifyContent:
                  safeSettings.watermarkPosition === "corner"
                    ? "flex-end"
                    : "center",
                pointerEvents: "none",
                opacity: safeSettings.watermarkOpacity || 0.15,
                zIndex: 10,
                overflow: "hidden",
              }}
            >
              {safeSettings.watermarkPosition === "tile" ? (
                <div
                  className="watermark-tile"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: `repeating-linear-gradient(${safeSettings.watermarkRotation || 45}deg, transparent, transparent 100px, rgba(117, 117, 117, 0.2) 100px, rgba(117, 117, 117, 0.2) 350px)`,
                    backgroundSize: "400px 400px",
                  }}
                >
                  <div className="grid grid-cols-3 gap-x-32 gap-y-40 p-20">
                    {Array(9)
                      .fill(0)
                      .map((_, index) => (
                        <div
                          key={index}
                          style={{
                            transform: `rotate(${safeSettings.watermarkRotation || 45}deg)`,
                            fontSize: "1.5rem",
                            fontWeight: "bold",
                            color: "#757575",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {safeSettings.watermarkText || "CONFIDENTIAL"}
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    transform: `rotate(${safeSettings.watermarkRotation || 45}deg)`,
                    fontSize:
                      safeSettings.watermarkPosition === "corner"
                        ? "1.5rem"
                        : "3rem",
                    fontWeight: "bold",
                    color: "#757575",
                    whiteSpace: "nowrap",
                    margin:
                      safeSettings.watermarkPosition === "corner"
                        ? "20px"
                        : "0",
                  }}
                >
                  {safeSettings.watermarkText || "CONFIDENTIAL"}
                </div>
              )}
            </div>
          )}

          {/* Content Section */}
          <div
            className="pdf-content"
            style={{
              padding: `${safeSettings.marginTop || 25}px ${safeSettings.marginRight || 25}px ${safeSettings.marginBottom || 25}px ${safeSettings.marginLeft || 25}px`,
              fontFamily: safeSettings.fontFamily || "Arial, sans-serif",
              fontSize: `${safeSettings.fontSize || 10}pt`,
              position: "relative",
              zIndex: 20,
            }}
          >
            {/* Basic Request Information */}
            {safeSettings.showBasicInfo !== false && (
              <div className="mb-6 border-b pb-4">
                <h2 className="text-lg font-semibold mb-3">Request Details</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Request Number:</p>
                    <p className="font-medium">PR-2025-001</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Date:</p>
                    <p className="font-medium">March 21, 2025</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status:</p>
                    <p className="font-medium">Pending Approval</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Priority:</p>
                    <p className="font-medium">High</p>
                  </div>
                </div>
              </div>
            )}
            {/* Requester Details */}
            {safeSettings.showRequesterDetails !== false && (
              <div className="mb-6 border-b pb-4">
                <h2 className="text-lg font-semibold mb-3">Requester</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Name:</p>
                    <p className="font-medium">John Smith</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Department:</p>
                    <p className="font-medium">Marketing</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email:</p>
                    <p className="font-medium">john.smith@example.com</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Phone:</p>
                    <p className="font-medium">+1 (555) 123-4567</p>
                  </div>
                </div>
              </div>
            )}
            {/* Purpose Information */}
            {safeSettings.showPurposeInfo !== false && (
              <div className="mb-6 border-b pb-4">
                <h2 className="text-lg font-semibold mb-3">Purpose</h2>
                <div className="mb-3">
                  <p className="text-sm text-gray-600">Purpose Type:</p>
                  <p className="font-medium">Marketing Campaign</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Description:</p>
                  <p className="font-medium">
                    This purchase request is for materials needed for the Q2
                    Marketing Campaign focused on new product launch.
                  </p>
                </div>
              </div>
            )}
            {/* Vendor Details */}
            {safeSettings.showVendorDetails !== false && (
              <div className="mb-6 border-b pb-4">
                <h2 className="text-lg font-semibold mb-3">
                  Vendor Information
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Vendor Name:</p>
                    <p className="font-medium">Acme Supplies Ltd.</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Contact Person:</p>
                    <p className="font-medium">Jane Doe</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email:</p>
                    <p className="font-medium">sales@acmesupplies.com</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Phone:</p>
                    <p className="font-medium">+1 (555) 987-6543</p>
                  </div>
                </div>
              </div>
            )}
            {/* Items List */}
            {safeSettings.showItems !== false && (
              <div className="mb-6 border-b pb-4">
                <h2 className="text-lg font-semibold mb-3">Items</h2>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left text-sm">Item</th>
                      <th className="border p-2 text-left text-sm">
                        Description
                      </th>
                      <th className="border p-2 text-right text-sm">
                        Quantity
                      </th>
                      <th className="border p-2 text-right text-sm">
                        Unit Cost
                      </th>
                      <th className="border p-2 text-right text-sm">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border p-2">Marketing Brochures</td>
                      <td className="border p-2">
                        Product brochures for event
                      </td>
                      <td className="border p-2 text-right">500</td>
                      <td className="border p-2 text-right">$2.50</td>
                      <td className="border p-2 text-right">$1,250.00</td>
                    </tr>
                    <tr>
                      <td className="border p-2">Display Stands</td>
                      <td className="border p-2">Portable display stands</td>
                      <td className="border p-2 text-right">5</td>
                      <td className="border p-2 text-right">$120.00</td>
                      <td className="border p-2 text-right">$600.00</td>
                    </tr>
                    <tr>
                      <td className="border p-2">Promotional Items</td>
                      <td className="border p-2">Branded pens and notepads</td>
                      <td className="border p-2 text-right">250</td>
                      <td className="border p-2 text-right">$3.75</td>
                      <td className="border p-2 text-right">$937.50</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50">
                      <td colSpan={3} className="border p-2"></td>
                      <td className="border p-2 text-right font-medium">
                        Subtotal:
                      </td>
                      <td className="border p-2 text-right font-medium">
                        $2,787.50
                      </td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td colSpan={3} className="border p-2"></td>
                      <td className="border p-2 text-right font-medium">
                        Freight:
                      </td>
                      <td className="border p-2 text-right font-medium">
                        $150.00
                      </td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td colSpan={3} className="border p-2"></td>
                      <td className="border p-2 text-right font-medium">
                        Total:
                      </td>
                      <td className="border p-2 text-right font-medium">
                        $2,937.50
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {/* Approvals */}
            {safeSettings.showApprovals !== false && (
              <div className="mb-6 border-b pb-4">
                <h2 className="text-lg font-semibold mb-3">Approvals</h2>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left text-sm">
                        Department
                      </th>
                      <th className="border p-2 text-left text-sm">Approver</th>
                      <th className="border p-2 text-left text-sm">Status</th>
                      <th className="border p-2 text-left text-sm">Date</th>
                      <th className="border p-2 text-left text-sm">Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border p-2">Department Head</td>
                      <td className="border p-2">Sarah Johnson</td>
                      <td className="border p-2">Approved</td>
                      <td className="border p-2">Mar 18, 2025</td>
                      <td className="border p-2">Approved as requested</td>
                    </tr>
                    <tr>
                      <td className="border p-2">Finance</td>
                      <td className="border p-2">Mike Williams</td>
                      <td className="border p-2">Pending</td>
                      <td className="border p-2">-</td>
                      <td className="border p-2">-</td>
                    </tr>
                    <tr>
                      <td className="border p-2">CEO Office</td>
                      <td className="border p-2">Robert Chen</td>
                      <td className="border p-2">Pending</td>
                      <td className="border p-2">-</td>
                      <td className="border p-2">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            {/* Attachments List */}
            {safeSettings.showAttachments !== false && (
              <div className="mb-6 border-b pb-4">
                <h2 className="text-lg font-semibold mb-3">Attachments</h2>
                <ul className="list-disc list-inside">
                  <li className="mb-1">Vendor_Quote_123456.pdf</li>
                  <li className="mb-1">Product_Specifications.docx</li>
                  <li className="mb-1">Campaign_Brief.pdf</li>
                </ul>
              </div>
            )}
            {/* Signature Lines */}
            {safeSettings.showSignatures !== false && (
              <div className="mb-6 mt-12">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <div className="border-t border-gray-400 pt-2">
                      <p className="text-sm text-center">Requester Signature</p>
                    </div>
                  </div>
                  <div>
                    <div className="border-t border-gray-400 pt-2">
                      <p className="text-sm text-center">
                        Final Approval Signature
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Company Information (if provided) */}
            {safeSettings.companyAddress ||
            safeSettings.companyPhone ||
            safeSettings.companyEmail ||
            safeSettings.companyWebsite ? (
              <div className="mt-8 pt-4 border-t text-center text-sm text-gray-500">
                {safeSettings.companyAddress && (
                  <p>{safeSettings.companyAddress}</p>
                )}
                <div className="flex justify-center space-x-4">
                  {safeSettings.companyPhone && (
                    <p>Phone: {safeSettings.companyPhone}</p>
                  )}
                  {safeSettings.companyEmail && (
                    <p>Email: {safeSettings.companyEmail}</p>
                  )}
                  {safeSettings.companyWebsite && (
                    <p>Web: {safeSettings.companyWebsite}</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Footer */}
          {safeSettings.showFooter !== false && (
            <div
              className="pdf-footer"
              style={{
                backgroundColor: safeSettings.footerColor || "#eeeeee",
                height: `${safeSettings.footerHeight || 30}px`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 15px",
                fontSize: "8pt",
              }}
            >
              <div>{safeSettings.footerText || "Purchase Request System"}</div>

              {safeSettings.footerImage && (
                <div className="pdf-footer-image">
                  <img
                    src={safeSettings.footerImage}
                    alt="Footer"
                    className="h-6 object-contain"
                  />
                </div>
              )}

              {safeSettings.pageNumbering !== false && <div>Page 1 of 1</div>}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="pdf-preview relative">
      {renderPreview()}

      <style>{`
        .paper {
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          position: relative;
          overflow: hidden;
        }
        
        .a4 {
          width: 100%;
          min-height: 842px;
          aspect-ratio: 1 / 1.4142;
          background: white;
        }
      `}</style>
    </div>
  );
};

export default PDFPreview;
