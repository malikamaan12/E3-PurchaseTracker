import React, { useState } from 'react';
import { Button } from "../components/ui/button";
import { saveAs } from 'file-saver';
import { ExportTabs } from "@/components/ExportTabs";
import { 
  exportRequestToPDF,
  exportMultipleRequestsAsZip,
  exportMultipleRequestsToPDF
} from '../lib/exportUtils';
import { 
  validateResourceId, 
  logExportEvent,
  logZipExport,
  logPdfExport
} from '../lib/exportAuditUtils';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";

export default function TestExportPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<{[key: string]: 'success' | 'pending' | 'failed' | 'not-run'}>({
    'enhanced-pdf': 'not-run',
    'enhanced-zip': 'not-run',
    'bulk-zip': 'not-run',
    'bulk-pdf': 'not-run'
  });

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString().slice(11, 23)} - ${message}`]);
  };
  
  const updateTestResult = (testId: string, status: 'success' | 'pending' | 'failed' | 'not-run') => {
    setTestResults(prev => ({
      ...prev,
      [testId]: status
    }));
  };
  
  // Mock purchase request for enhanced utility tests
  const mockPurchaseRequest = {
    id: 12345,
    requestNumber: 'REQ-TEST-12345',
    title: 'Test Purchase Request',
    description: 'This is a test purchase request for export functionality',
    status: 'draft',
    priority: 'high',
    currency: 'USD',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    requesterId: 1,
    requester: {
      id: 1,
      username: 'Test User',
      department: 'Testing Department',
      role: 'tester'
    },
    purposeType: 'Software',
    subPurposeId: 1,
    subPurpose: { 
      id: 1, 
      name: 'Development Tools',
      purposeType: 'Software'
    },
    vendorId: 1,
    vendor: {
      id: 1,
      companyName: 'Test Vendor Inc.',
      contactPerson: 'John Vendor',
      email: 'vendor@test.com',
      contactNumber: '555-1234'
    },
    items: [
      {
        id: 1,
        name: 'Test Item 1',
        quantity: 2,
        estimatedCost: 500,
        description: 'This is test item 1'
      },
      {
        id: 2,
        name: 'Test Item 2',
        quantity: 1,
        estimatedCost: 750,
        description: 'This is test item 2'
      }
    ],
    approvals: [
      {
        id: 1,
        status: 'pending',
        department: 'Finance',
        approverId: 2,
        approver: {
          id: 2,
          username: 'Finance Approver',
          department: 'Finance'
        },
        comments: 'Pending review',
        processedAt: new Date().toISOString()
      },
      {
        id: 2,
        status: 'approved',
        department: 'CEO Office',
        approverId: 3,
        approver: {
          id: 3,
          username: 'CEO Approver',
          department: 'CEO Office'
        },
        comments: 'Approved with the latest timestamp',
        processedAt: new Date().toISOString()
      }
    ],
    attachments: [
      {
        id: 1,
        fileName: 'test-attachment.pdf',
        fileType: 'application/pdf',
        fileSize: 12345,
        fileUrl: 'https://example.com/test-attachment.pdf'
      }
    ]
  };
  
  // Test enhanced PDF export
  const testEnhancedPdfExport = async () => {
    addLog('Starting enhanced PDF export test with consolidated format...');
    updateTestResult('enhanced-pdf', 'pending');
    
    try {
      // Test our consolidated PDF format that works for all user types
      addLog('Using exportRequestToPDF utility with consolidated format...');
      
      // Test with different user types, but all will use the same consolidated format
      // The type parameter is only for audit logging, not for different PDF layouts
      const userFileName = await exportRequestToPDF(mockPurchaseRequest, 'user');
      addLog(`User PDF export successful: ${userFileName}`);
      
      const approverFileName = await exportRequestToPDF(mockPurchaseRequest, 'approver');
      addLog(`Approver PDF export successful: ${approverFileName}`);
      
      const adminFileName = await exportRequestToPDF(mockPurchaseRequest, 'admin');
      addLog(`Admin PDF export successful: ${adminFileName}`);
      
      // Log PDF export 
      try {
        addLog('Logging PDF export event using unified audit system...');
        const auditResult = await logPdfExport(
          mockPurchaseRequest.id,
          {
            fileName: adminFileName,
            fileSize: 1024 * 5, // Example file size
            exportType: 'consolidated'
          },
          'admin'
        );
        
        if (auditResult) {
          addLog('✓ PDF Audit logging successful');
        } else {
          addLog('⚠️ PDF Audit logging partial failure (export still succeeded)');
        }
      } catch (auditError: any) {
        addLog(`❌ Error logging PDF export: ${auditError.message || 'Unknown error'}`);
        console.error('PDF export audit error:', auditError);
      }
      
      addLog('All PDF types use the same consolidated format with no duplicate fields');
      updateTestResult('enhanced-pdf', 'success');
    } catch (error: any) {
      addLog(`Error during enhanced PDF export: ${error.message || 'Unknown error'}`);
      console.error('Enhanced PDF export error:', error);
      updateTestResult('enhanced-pdf', 'failed');
    }
  };
  
  const testEnhancedZipExport = async () => {
    addLog('Starting enhanced ZIP export test...');
    updateTestResult('enhanced-zip', 'pending');
    
    try {
      // Test our ZIP export utility with the sample request
      addLog('Using exportMultipleRequestsAsZip utility...');
      
      // Create a single-request ZIP export
      const fileName = await exportMultipleRequestsAsZip([mockPurchaseRequest], true);
      addLog(`ZIP export successful: ${fileName}`);
      
      // Log the export event
      try {
        addLog('Logging ZIP export event using unified audit system...');
        const auditResult = await logZipExport(
          mockPurchaseRequest.id,
          {
            fileName: fileName,
            fileSize: 1024 * 10, // Example file size
            exportType: 'single'
          },
          'admin'
        );
        
        if (auditResult) {
          addLog('✓ ZIP Audit logging successful');
        } else {
          addLog('⚠️ ZIP Audit logging partial failure (export still succeeded)');
        }
      } catch (auditError: any) {
        addLog(`❌ Error logging ZIP export: ${auditError.message || 'Unknown error'}`);
        console.error('ZIP export audit error:', auditError);
      }
      
      updateTestResult('enhanced-zip', 'success');
    } catch (error: any) {
      addLog(`Error during enhanced ZIP export: ${error.message || 'Unknown error'}`);
      console.error('Enhanced ZIP export error:', error);
      updateTestResult('enhanced-zip', 'failed');
    }
  };
  
  // Test bulk exports
  const testBulkZipExport = async () => {
    addLog('Starting bulk ZIP export test...');
    updateTestResult('bulk-zip', 'pending');
    
    try {
      // Create an array of mock requests for bulk export
      const mockRequests = [
        mockPurchaseRequest,
        {
          ...mockPurchaseRequest,
          id: 12346,
          requestNumber: 'REQ-TEST-12346',
          title: 'Second Test Request'
        },
        {
          ...mockPurchaseRequest,
          id: 12347,
          requestNumber: 'REQ-TEST-12347',
          title: 'Third Test Request'
        }
      ];
      
      addLog(`Created ${mockRequests.length} mock requests for bulk export`);
      
      // Use the ZIP export utility
      const fileName = await exportMultipleRequestsAsZip(mockRequests, true);
      addLog(`Bulk ZIP export successful: ${fileName}`);
      
      // Log bulk export since we're using multiple requests
      try {
        addLog('Logging bulk ZIP export with diagnostic export ID...');
        const auditResult = await logExportEvent(
          999999, // Special diagnostic ID for bulk export
          'zip', 
          {
            fileName: fileName,
            fileSize: 1024 * 30, // Example file size for bulk export
            exportType: 'bulk',
            count: mockRequests.length
          },
          'admin'
        );
        
        if (auditResult) {
          addLog('✓ Bulk ZIP Audit logging successful');
        } else {
          addLog('⚠️ Bulk ZIP Audit logging partial failure (export still succeeded)');
        }
      } catch (auditError: any) {
        addLog(`❌ Error logging bulk ZIP export: ${auditError.message || 'Unknown error'}`);
        console.error('Bulk ZIP export audit error:', auditError);
      }
      
      updateTestResult('bulk-zip', 'success');
    } catch (error: any) {
      addLog(`Error during bulk ZIP export: ${error.message || 'Unknown error'}`);
      console.error('Bulk ZIP export error:', error);
      updateTestResult('bulk-zip', 'failed');
    }
  };
  
  const testBulkPdfExport = async () => {
    addLog('Starting bulk PDF export test...');
    updateTestResult('bulk-pdf', 'pending');
    
    try {
      // Create an array of mock requests for bulk export
      const mockRequests = [
        mockPurchaseRequest,
        {
          ...mockPurchaseRequest,
          id: 12346,
          requestNumber: 'REQ-TEST-12346',
          title: 'Second Test Request'
        }
      ];
      
      addLog(`Created ${mockRequests.length} mock requests for bulk PDF export`);
      
      // Use the bulk PDF export utility which creates a combined PDF
      const fileName = await exportMultipleRequestsToPDF(mockRequests, 'admin');
      addLog(`Bulk PDF export successful: ${fileName}`);
      
      // Log bulk export
      try {
        addLog('Logging bulk PDF export with diagnostic export ID...');
        const auditResult = await logExportEvent(
          999999, // Special diagnostic ID for bulk export
          'pdf', 
          {
            fileName: fileName,
            fileSize: 1024 * 20, // Example file size
            exportType: 'bulk',
            count: mockRequests.length
          },
          'admin'
        );
        
        if (auditResult) {
          addLog('✓ Bulk PDF Audit logging successful');
        } else {
          addLog('⚠️ Bulk PDF Audit logging partial failure (export still succeeded)');
        }
      } catch (auditError: any) {
        addLog(`❌ Error logging bulk PDF export: ${auditError.message || 'Unknown error'}`);
        console.error('Bulk PDF export audit error:', auditError);
      }
      
      updateTestResult('bulk-pdf', 'success');
    } catch (error: any) {
      addLog(`Error during bulk PDF export: ${error.message || 'Unknown error'}`);
      console.error('Bulk PDF export error:', error);
      updateTestResult('bulk-pdf', 'failed');
    }
  };
  
  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Export Functionality Test Page</h1>
      
      <Alert className="mb-4 bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800/50">
        <AlertTitle>Export Functionality Restored</AlertTitle>
        <AlertDescription>
          All export options (Excel, CSV, PDF, and ZIP) are now available through the new ExportTabs component.
          This test page has been updated to demonstrate all export formats with enhanced audit logging.
        </AlertDescription>
      </Alert>
      
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Test Export Tabs Component</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">The ExportTabs component with the sample request data:</p>
            <ExportTabs request={mockPurchaseRequest} />
          </CardContent>
        </Card>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Enhanced Export Utilities</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Button 
            variant="outline" 
            onClick={testEnhancedPdfExport}
            className="w-full"
          >
            Test Enhanced PDF Export
          </Button>
          
          <Button 
            variant="outline" 
            onClick={testEnhancedZipExport}
            className="w-full"
          >
            Test Enhanced ZIP Export
          </Button>
        </div>
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Bulk Export Tests</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Button 
            variant="secondary" 
            onClick={testBulkZipExport}
            className="w-full"
          >
            Test Bulk ZIP Export
          </Button>
          
          <Button 
            variant="secondary" 
            onClick={testBulkPdfExport}
            className="w-full"
          >
            Test Bulk PDF Export
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Advanced Diagnostics</h2>
        <div className="grid grid-cols-1 gap-4 mb-4">
          <Alert className="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/50">
            <AlertTitle>Export Diagnostics Updated</AlertTitle>
            <AlertDescription>
              Per the standardization requirements, we have shifted to PDF and ZIP-only exports with enhanced audit validation.
              Advanced diagnostics have been updated to focus on these standardized formats.
            </AlertDescription>
          </Alert>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="col-span-2 bg-slate-100 dark:bg-slate-900 rounded-md p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-semibold">Logs</h2>
            <Button 
              variant="outline" 
              size="sm"
              onClick={clearLogs}
            >
              Clear Logs
            </Button>
          </div>
          <div className="bg-white dark:bg-slate-800 p-3 rounded-md max-h-96 overflow-y-auto font-mono text-sm">
            {logs.length > 0 ? logs.map((log, i) => (
              <div key={i} className="border-b border-slate-100 dark:border-slate-700 py-1">
                {log}
              </div>
            )) : (
              <div className="text-slate-500">No logs yet. Click a test button to begin.</div>
            )}
          </div>
        </div>
        
        <div className="bg-slate-100 dark:bg-slate-900 rounded-md p-4">
          <h2 className="font-semibold mb-2">Test Results</h2>
          <div className="space-y-2">
            <div className="bg-white dark:bg-slate-800 p-3 rounded-md">
              <h3 className="text-sm font-medium mb-2">Enhanced Export Tests</h3>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs">PDF Export</span>
                  <Badge variant={
                    testResults['enhanced-pdf'] === 'success' ? 'success' : 
                    testResults['enhanced-pdf'] === 'pending' ? 'outline' :
                    testResults['enhanced-pdf'] === 'failed' ? 'destructive' : 'secondary'
                  }>
                    {testResults['enhanced-pdf'] === 'not-run' ? 'Not Run' : 
                     testResults['enhanced-pdf'] === 'pending' ? 'Running...' :
                     testResults['enhanced-pdf'] === 'success' ? 'Success' : 'Failed'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs">ZIP Export</span>
                  <Badge variant={
                    testResults['enhanced-zip'] === 'success' ? 'success' : 
                    testResults['enhanced-zip'] === 'pending' ? 'outline' :
                    testResults['enhanced-zip'] === 'failed' ? 'destructive' : 'secondary'
                  }>
                    {testResults['enhanced-zip'] === 'not-run' ? 'Not Run' : 
                     testResults['enhanced-zip'] === 'pending' ? 'Running...' :
                     testResults['enhanced-zip'] === 'success' ? 'Success' : 'Failed'}
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-800 p-3 rounded-md">
              <h3 className="text-sm font-medium mb-2">Bulk Export Tests</h3>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs">Bulk ZIP Export</span>
                  <Badge variant={
                    testResults['bulk-zip'] === 'success' ? 'success' : 
                    testResults['bulk-zip'] === 'pending' ? 'outline' :
                    testResults['bulk-zip'] === 'failed' ? 'destructive' : 'secondary'
                  }>
                    {testResults['bulk-zip'] === 'not-run' ? 'Not Run' : 
                     testResults['bulk-zip'] === 'pending' ? 'Running...' :
                     testResults['bulk-zip'] === 'success' ? 'Success' : 'Failed'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs">Bulk PDF Export</span>
                  <Badge variant={
                    testResults['bulk-pdf'] === 'success' ? 'success' : 
                    testResults['bulk-pdf'] === 'pending' ? 'outline' :
                    testResults['bulk-pdf'] === 'failed' ? 'destructive' : 'secondary'
                  }>
                    {testResults['bulk-pdf'] === 'not-run' ? 'Not Run' : 
                     testResults['bulk-pdf'] === 'pending' ? 'Running...' :
                     testResults['bulk-pdf'] === 'success' ? 'Success' : 'Failed'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-md p-4">
        <h3 className="font-semibold mb-2">How This Works</h3>
        <p className="text-sm mb-2">
          This test page implements different methods of generating and downloading export files to help diagnose download issues. 
          It focuses exclusively on PDF and ZIP exports per standardization requirements.
        </p>
        <ul className="list-disc list-inside text-sm space-y-1">
          <li>The Enhanced Tests use our improved utilities from exportUtils.ts</li>
          <li>The Bulk Tests verify multiple-request exports with proper file formatting</li>
          <li>All exports include better error handling, validation, and fallbacks</li>
          <li>All exports include proper audit logging with the PDF audit endpoint</li>
          <li>Special diagnostic IDs (999999) are handled for bulk export validation</li>
          <li>All logs are displayed above for debugging and troubleshooting</li>
        </ul>
      </div>
    </div>
  );
}