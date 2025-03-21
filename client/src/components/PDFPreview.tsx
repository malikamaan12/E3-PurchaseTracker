import React, { useState, useEffect } from 'react';
import { PdfSettings } from '../services/pdfService';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

interface PDFPreviewProps {
  settings: Partial<PdfSettings>;
  previewData?: any;
}

const PDFPreview: React.FC<PDFPreviewProps> = ({ settings, previewData }) => {
  const [loading, setLoading] = useState(true);
  
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
          {settings.showHeader !== false && (
            <div 
              className="pdf-header"
              style={{
                backgroundColor: settings.headerColor || '#0066cc',
                height: `${settings.headerHeight || 60}px`,
                color: '#ffffff',
                padding: '8px 15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div className="flex items-center">
                {settings.showLogo !== false && settings.logo && (
                  <div 
                    className="pdf-logo mr-4"
                    style={{
                      justifyContent: settings.logoPosition === 'center' ? 'center' 
                        : settings.logoPosition === 'right' ? 'flex-end' 
                        : 'flex-start'
                    }}
                  >
                    <img 
                      src={settings.logo} 
                      alt="Logo" 
                      className="h-10 object-contain" 
                    />
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-bold">{settings.headerTitle || 'Purchase Request'}</h1>
                  {settings.headerSubtitle && (
                    <p className="text-sm">{settings.headerSubtitle}</p>
                  )}
                </div>
              </div>
              
              {settings.headerImage && (
                <div className="pdf-header-image">
                  <img 
                    src={settings.headerImage} 
                    alt="Header" 
                    className="h-12 object-contain" 
                  />
                </div>
              )}
            </div>
          )}
          
          {/* Watermark (if enabled) */}
          {settings.useWatermark && (
            <div 
              className="pdf-watermark absolute"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                opacity: settings.watermarkOpacity || 0.15,
                zIndex: 10,
                overflow: 'hidden'
              }}
            >
              <div 
                style={{
                  transform: `rotate(${settings.watermarkRotation || 45}deg)`,
                  fontSize: '3rem',
                  fontWeight: 'bold',
                  color: '#757575',
                  whiteSpace: 'nowrap'
                }}
              >
                {settings.watermarkText || 'CONFIDENTIAL'}
              </div>
            </div>
          )}
          
          {/* Content Section */}
          <div 
            className="pdf-content"
            style={{
              padding: `${settings.marginTop || 25}px ${settings.marginRight || 25}px ${settings.marginBottom || 25}px ${settings.marginLeft || 25}px`,
              fontFamily: settings.fontFamily || 'Arial, sans-serif',
              fontSize: `${settings.fontSize || 10}pt`,
              position: 'relative',
              zIndex: 20
            }}
          >
            {/* Basic Request Information */}
            {settings.showBasicInfo !== false && (
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
            {settings.showRequesterDetails !== false && (
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
            {settings.showPurposeInfo !== false && (
              <div className="mb-6 border-b pb-4">
                <h2 className="text-lg font-semibold mb-3">Purpose</h2>
                <div className="mb-3">
                  <p className="text-sm text-gray-600">Purpose Type:</p>
                  <p className="font-medium">Marketing Campaign</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Description:</p>
                  <p className="font-medium">This purchase request is for materials needed for the Q2 Marketing Campaign focused on new product launch.</p>
                </div>
              </div>
            )}
            
            {/* Vendor Details */}
            {settings.showVendorDetails !== false && (
              <div className="mb-6 border-b pb-4">
                <h2 className="text-lg font-semibold mb-3">Vendor Information</h2>
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
            {settings.showItems !== false && (
              <div className="mb-6 border-b pb-4">
                <h2 className="text-lg font-semibold mb-3">Items</h2>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left text-sm">Item</th>
                      <th className="border p-2 text-left text-sm">Description</th>
                      <th className="border p-2 text-right text-sm">Quantity</th>
                      <th className="border p-2 text-right text-sm">Unit Cost</th>
                      <th className="border p-2 text-right text-sm">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border p-2">Marketing Brochures</td>
                      <td className="border p-2">Product brochures for event</td>
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
                      <td className="border p-2 text-right font-medium">Subtotal:</td>
                      <td className="border p-2 text-right font-medium">$2,787.50</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td colSpan={3} className="border p-2"></td>
                      <td className="border p-2 text-right font-medium">Freight:</td>
                      <td className="border p-2 text-right font-medium">$150.00</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td colSpan={3} className="border p-2"></td>
                      <td className="border p-2 text-right font-medium">Total:</td>
                      <td className="border p-2 text-right font-medium">$2,937.50</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            
            {/* Approvals */}
            {settings.showApprovals !== false && (
              <div className="mb-6 border-b pb-4">
                <h2 className="text-lg font-semibold mb-3">Approvals</h2>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left text-sm">Department</th>
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
            {settings.showAttachments !== false && (
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
            {settings.showSignatures !== false && (
              <div className="mb-6 mt-12">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <div className="border-t border-gray-400 pt-2">
                      <p className="text-sm text-center">Requester Signature</p>
                    </div>
                  </div>
                  <div>
                    <div className="border-t border-gray-400 pt-2">
                      <p className="text-sm text-center">Final Approval Signature</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Company Information (if provided) */}
            {settings.companyAddress || settings.companyPhone || settings.companyEmail || settings.companyWebsite ? (
              <div className="mt-8 pt-4 border-t text-center text-sm text-gray-500">
                {settings.companyAddress && <p>{settings.companyAddress}</p>}
                <div className="flex justify-center space-x-4">
                  {settings.companyPhone && <p>Phone: {settings.companyPhone}</p>}
                  {settings.companyEmail && <p>Email: {settings.companyEmail}</p>}
                  {settings.companyWebsite && <p>Web: {settings.companyWebsite}</p>}
                </div>
              </div>
            ) : null}
          </div>
          
          {/* Footer */}
          {settings.showFooter !== false && (
            <div 
              className="pdf-footer"
              style={{
                backgroundColor: settings.footerColor || '#eeeeee',
                height: `${settings.footerHeight || 30}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 15px',
                fontSize: '8pt'
              }}
            >
              <div>
                {settings.footerText || 'Purchase Request System'}
              </div>
              
              {settings.footerImage && (
                <div className="pdf-footer-image">
                  <img 
                    src={settings.footerImage} 
                    alt="Footer" 
                    className="h-6 object-contain" 
                  />
                </div>
              )}
              
              {settings.pageNumbering !== false && (
                <div>Page 1 of 1</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="pdf-preview relative">
      {renderPreview()}
      
      <style jsx>{`
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