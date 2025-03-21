import React from 'react';
import { Card } from '@/components/ui/card';
import { PdfSettings } from '../services/pdfService';
import { Spinner } from '@/components/ui/spinner';

interface PDFPreviewProps {
  settings: Partial<PdfSettings>;
  sampleData?: any;
  loading?: boolean;
}

const PDFPreview: React.FC<PDFPreviewProps> = ({
  settings,
  sampleData,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner size="lg" />
        <span className="ml-2">Generating preview...</span>
      </div>
    );
  }

  // Create styles for the preview based on settings
  const headerStyle = {
    height: `${settings.headerHeight || 60}px`,
    backgroundColor: settings.headerColor || '#0066cc',
    color: '#ffffff',
    padding: '10px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: settings.logoPosition === 'center' ? 'center' : 'space-between',
    flexDirection: settings.logoPosition === 'right' ? 'row-reverse' : 'row',
  } as React.CSSProperties;

  const footerStyle = {
    height: `${settings.footerHeight || 30}px`,
    backgroundColor: settings.footerColor || '#eeeeee',
    color: '#333333',
    padding: '5px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties;

  const contentStyle = {
    padding: `${settings.marginTop || 25}px ${settings.marginRight || 25}px ${settings.marginBottom || 25}px ${settings.marginLeft || 25}px`,
    fontSize: `${settings.fontSize || 10}px`,
    position: 'relative',
    minHeight: '300px',
  } as React.CSSProperties;

  const watermarkStyle = settings.useWatermark ? {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 10,
    opacity: settings.watermarkOpacity || 0.15,
    fontSize: '48px',
    color: '#999999',
    transform: `rotate(${settings.watermarkRotation || 45}deg)`
  } as React.CSSProperties : {};

  return (
    <div className="pdf-preview h-full">
      <Card className="h-full shadow-lg overflow-hidden flex flex-col">
        {/* Header */}
        {settings.showHeader !== false && (
          <div style={headerStyle} className="pdf-header">
            {settings.showLogo && (
              <div className="pdf-logo">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-primary-600">
                  LOGO
                </div>
              </div>
            )}
            <div className="pdf-header-text">
              <h1 className="text-xl font-bold">{settings.headerTitle || 'Purchase Request'}</h1>
              {settings.headerSubtitle && <p className="text-sm opacity-90">{settings.headerSubtitle}</p>}
            </div>
          </div>
        )}

        {/* Content with watermark */}
        <div style={contentStyle} className="pdf-content flex-grow relative">
          {/* Watermark */}
          {settings.useWatermark && (
            <div style={watermarkStyle} className="pdf-watermark">
              {settings.watermarkText || 'CONFIDENTIAL'}
            </div>
          )}

          {/* Basic Info Section */}
          {settings.showBasicInfo !== false && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Basic Information</h2>
              <div className="grid grid-cols-2 gap-4 border rounded p-3">
                <div>
                  <p className="text-xs text-gray-500">Request Number</p>
                  <p>PR-12345</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <p>Pending Approval</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Date Submitted</p>
                  <p>March 15, 2025</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Priority</p>
                  <p>High</p>
                </div>
              </div>
            </div>
          )}

          {/* Requester Details Section */}
          {settings.showRequesterDetails !== false && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Requester Details</h2>
              <div className="border rounded p-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Name</p>
                    <p>John Smith</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Department</p>
                    <p>Operations</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p>john.smith@company.com</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Contact</p>
                    <p>+1 (555) 123-4567</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Purpose Information Section */}
          {settings.showPurposeInfo !== false && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Purpose Information</h2>
              <div className="border rounded p-3">
                <div className="mb-3">
                  <p className="text-xs text-gray-500">Purpose Type</p>
                  <p>Office Supplies</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Description</p>
                  <p>Quarterly supply replenishment for the operations department including printer paper, ink cartridges, and office stationery.</p>
                </div>
              </div>
            </div>
          )}

          {/* Vendor Details Section */}
          {settings.showVendorDetails !== false && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Vendor Details</h2>
              <div className="border rounded p-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Vendor Name</p>
                    <p>Office Supply Co.</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Contact Person</p>
                    <p>Sarah Johnson</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p>info@officesupplyco.com</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p>+1 (555) 987-6543</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Items Section */}
          {settings.showItems !== false && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Items</h2>
              <div className="border rounded overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left">Item</th>
                      <th className="p-2 text-right">Quantity</th>
                      <th className="p-2 text-right">Unit Price</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="p-2">Printer Paper (A4, 500 sheets)</td>
                      <td className="p-2 text-right">10</td>
                      <td className="p-2 text-right">$5.99</td>
                      <td className="p-2 text-right">$59.90</td>
                    </tr>
                    <tr className="border-t">
                      <td className="p-2">Ink Cartridge (Black)</td>
                      <td className="p-2 text-right">4</td>
                      <td className="p-2 text-right">$24.99</td>
                      <td className="p-2 text-right">$99.96</td>
                    </tr>
                    <tr className="border-t">
                      <td className="p-2">Ballpoint Pens (Box of 20)</td>
                      <td className="p-2 text-right">5</td>
                      <td className="p-2 text-right">$7.50</td>
                      <td className="p-2 text-right">$37.50</td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-gray-100">
                    <tr className="border-t font-semibold">
                      <td className="p-2" colSpan={3}>Total</td>
                      <td className="p-2 text-right">$197.36</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Approval Flow Section */}
          {settings.showApprovals !== false && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Approval Flow</h2>
              <div className="border rounded p-3">
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-xs font-semibold">Department</div>
                  <div className="text-xs font-semibold">Approver</div>
                  <div className="text-xs font-semibold">Status</div>
                  <div className="text-xs font-semibold">Date</div>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2 border-t pt-2">
                  <div>Operations</div>
                  <div>Jane Doe</div>
                  <div className="text-green-600">Approved</div>
                  <div>Mar 16, 2025</div>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2 border-t pt-2">
                  <div>Finance</div>
                  <div>Robert Smith</div>
                  <div className="text-yellow-600">Pending</div>
                  <div>-</div>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2 border-t pt-2">
                  <div>CEO Office</div>
                  <div>Michael Johnson</div>
                  <div className="text-gray-400">Waiting</div>
                  <div>-</div>
                </div>
              </div>
            </div>
          )}

          {/* Attachments Section */}
          {settings.showAttachments !== false && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Attachments</h2>
              <div className="border rounded p-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-gray-100 rounded">PDF</div>
                    <span>vendor_quote.pdf</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-gray-100 rounded">JPG</div>
                    <span>product_catalog.jpg</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Company Info (Footer) */}
          {settings.companyAddress && (
            <div className="mt-10 text-xs text-center text-gray-500">
              <p>{settings.companyAddress}</p>
              {settings.companyPhone && settings.companyEmail && (
                <p>{settings.companyPhone} | {settings.companyEmail}</p>
              )}
              {settings.companyWebsite && (
                <p>{settings.companyWebsite}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {settings.showFooter !== false && (
          <div style={footerStyle} className="pdf-footer">
            <div>{settings.footerText || 'Confidential - For internal use only'}</div>
            {settings.pageNumbering && <div>Page 1 of 1</div>}
          </div>
        )}
      </Card>
    </div>
  );
};

export default PDFPreview;