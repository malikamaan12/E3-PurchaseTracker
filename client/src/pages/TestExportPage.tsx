import React, { useState, useEffect } from 'react';
import { Button } from "../components/ui/button";
import { Parser } from '@json2csv/plainjs';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { 
  exportRequestToCSV, 
  exportRequestToExcel, 
  exportRequestToPDF,
  exportMultipleRequestsToExcel,
  exportMultipleRequestsAsZip,
  exportMultipleRequestsToPDF
} from '../lib/exportUtils';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";

export default function TestExportPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<{[key: string]: 'success' | 'pending' | 'failed' | 'not-run'}>({
    'basic-csv': 'not-run',
    'basic-excel': 'not-run',
    'basic-alternative': 'not-run',
    'enhanced-pdf': 'not-run',
    'enhanced-excel': 'not-run',
    'enhanced-csv': 'not-run',
    'enhanced-zip': 'not-run',
    'bulk-excel': 'not-run',
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
      },
      {
        id: 3,
        status: 'approved',
        department: 'CEO Office',
        approverId: 3,
        approver: {
          id: 3,
          username: 'CEO Approver',
          department: 'CEO Office'
        },
        comments: 'This is a duplicate CEO approval with an older timestamp',
        processedAt: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      },
      {
        id: 4,
        status: 'approved',
        department: 'CEO Office',
        approverId: 3,
        approver: {
          id: 3,
          username: 'CEO Approver',
          department: 'CEO Office'
        },
        comments: 'This is another duplicate CEO approval with an even older timestamp',
        processedAt: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
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

  // Test data for CSV export
  const testData = {
    request_number: 'REQ-TEST-123',
    title: 'Test Request for CSV Export',
    status: 'draft',
    priority: 'high',
    created_date: new Date().toISOString(),
    requester: 'Test User',
    department: 'Testing Department',
    purpose_type: 'Software',
    sub_purpose: 'Development Tools',
    description: 'This is a test request for CSV export functionality',
    total_estimated_cost: 1500,
    currency: 'USD',
    vendor: 'Test Vendor Inc.'
  };

  // Test function for CSV export
  const testCsvExport = () => {
    addLog('Starting CSV export test...');
    updateTestResult('basic-csv', 'pending');
    
    try {
      // Create CSV with basic configuration
      const parser = new Parser({
        header: true,
        delimiter: ','
      });
      
      // Parse data - must be in array format
      const csv = parser.parse([testData]);
      addLog('CSV generated successfully');
      
      // Create blob for download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      
      // Try to force download
      try {
        saveAs(blob, 'test-export.csv');
        addLog('SaveAs called successfully');
        updateTestResult('basic-csv', 'success');
      } catch (saveError: any) {
        addLog(`Error in saveAs function: ${saveError.message || 'Unknown error'}`);
        console.error('Error in saveAs function:', saveError);
        updateTestResult('basic-csv', 'failed');
      }
    } catch (error: any) {
      addLog(`Error during CSV generation: ${error.message || 'Unknown error'}`);
      console.error('Error during CSV generation:', error);
      updateTestResult('basic-csv', 'failed');
    }
  };

  // Test function for alternative download method
  const testAlternativeDownload = () => {
    addLog('Starting alternative download test...');
    updateTestResult('basic-alternative', 'pending');
    
    try {
      // Create CSV with basic configuration
      const parser = new Parser({
        header: true,
        delimiter: ','
      });
      
      const csv = parser.parse([testData]);
      addLog('CSV generated successfully');
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'test-export-alternative.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addLog('Alternative download method executed');
      updateTestResult('basic-alternative', 'success');
    } catch (error: any) {
      addLog(`Error in alternative download method: ${error.message || 'Unknown error'}`);
      console.error('Error in alternative download method:', error);
      updateTestResult('basic-alternative', 'failed');
    }
  };

  // Test function for Excel export
  const testExcelExport = () => {
    addLog('Starting Excel export test...');
    updateTestResult('basic-excel', 'pending');
    
    try {
      // Create a simple workbook
      const wb = XLSX.utils.book_new();
      
      // Convert our data to worksheet format
      const ws = XLSX.utils.json_to_sheet([testData]);
      
      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(wb, ws, 'TestData');
      
      // Generate file and attempt to save
      try {
        const fileName = 'test-excel-export.xlsx';
        XLSX.writeFile(wb, fileName);
        addLog('Excel file generated and download initiated');
        updateTestResult('basic-excel', 'success');
      } catch (saveError: any) {
        addLog(`Error saving Excel file: ${saveError.message || 'Unknown error'}`);
        console.error('Error saving Excel file:', saveError);
        updateTestResult('basic-excel', 'failed');
      }
    } catch (error: any) {
      addLog(`Error during Excel generation: ${error.message || 'Unknown error'}`);
      console.error('Error during Excel generation:', error);
      updateTestResult('basic-excel', 'failed');
    }
  };
  
  // Test enhanced export utilities with consolidated PDF format
  const testEnhancedPdfExport = async () => {
    addLog('Starting enhanced PDF export test with consolidated format...');
    updateTestResult('enhanced-pdf', 'pending');
    
    try {
      // Test our consolidated PDF format that works for all user types
      addLog('Using exportRequestToPDF utility with consolidated format...');
      
      // Using single consolidated format with type parameter just for audit purposes
      const fileName = await exportRequestToPDF(mockPurchaseRequest, 'user');
      addLog(`PDF export successful with consolidated format: ${fileName}`);
      updateTestResult('enhanced-pdf', 'success');
    } catch (error: any) {
      addLog(`Error during enhanced PDF export: ${error.message || 'Unknown error'}`);
      console.error('Enhanced PDF export error:', error);
      updateTestResult('enhanced-pdf', 'failed');
    }
  };
  
  // Test bulk export utilities
  const testBulkExcelExport = async () => {
    addLog('Starting bulk Excel export test...');
    updateTestResult('bulk-excel', 'pending');
    
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
          title: 'Third Test Request',
          status: 'approved'
        }
      ];
      
      addLog(`Preparing bulk Excel export for ${mockRequests.length} requests...`);
      console.log('Mock requests for bulk export:', mockRequests);
      
      const fileName = await exportMultipleRequestsToExcel(mockRequests);
      addLog(`Bulk Excel export successful: ${fileName}`);
      updateTestResult('bulk-excel', 'success');
    } catch (error: any) {
      addLog(`Error during bulk Excel export: ${error.message || 'Unknown error'}`);
      console.error('Bulk Excel export error:', error);
      
      // More detailed error logging
      if (error.stack) {
        addLog(`Error stack: ${error.stack.split('\n')[0]}`);
      }
      updateTestResult('bulk-excel', 'failed');
    }
  };
  
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
          title: 'Third Test Request',
          status: 'approved'
        }
      ];
      
      addLog(`Preparing bulk ZIP export for ${mockRequests.length} requests...`);
      
      const fileName = await exportMultipleRequestsAsZip(mockRequests, true);
      addLog(`Bulk ZIP export successful: ${fileName}`);
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
        },
        {
          ...mockPurchaseRequest,
          id: 12347,
          requestNumber: 'REQ-TEST-12347',
          title: 'Third Test Request',
          status: 'approved'
        }
      ];
      
      addLog(`Preparing bulk PDF export for ${mockRequests.length} requests...`);
      
      const fileName = await exportMultipleRequestsToPDF(mockRequests);
      addLog(`Bulk PDF export successful: ${fileName}`);
      updateTestResult('bulk-pdf', 'success');
    } catch (error: any) {
      addLog(`Error during bulk PDF export: ${error.message || 'Unknown error'}`);
      console.error('Bulk PDF export error:', error);
      updateTestResult('bulk-pdf', 'failed');
    }
  };
  
  const testEnhancedExcelExport = async () => {
    addLog('Starting enhanced Excel export test...');
    updateTestResult('enhanced-excel', 'pending');
    
    try {
      addLog('Using exportRequestToExcel utility...');
      console.log('Mock request data:', mockPurchaseRequest);
      
      const fileName = await exportRequestToExcel(mockPurchaseRequest);
      addLog(`Excel export successful: ${fileName}`);
      updateTestResult('enhanced-excel', 'success');
    } catch (error: any) {
      addLog(`Error during enhanced Excel export: ${error.message || 'Unknown error'}`);
      console.error('Enhanced Excel export error:', error);
      
      // More detailed error logging
      if (error.stack) {
        addLog(`Error stack: ${error.stack.split('\n')[0]}`);
      }
      updateTestResult('enhanced-excel', 'failed');
    }
  };
  
  const testEnhancedCsvExport = async () => {
    addLog('Starting enhanced CSV export test...');
    updateTestResult('enhanced-csv', 'pending');
    
    try {
      addLog('Using exportRequestToCSV utility...');
      console.log('Mock request data for CSV:', mockPurchaseRequest);
      
      const fileName = await exportRequestToCSV(mockPurchaseRequest);
      addLog(`CSV export successful: ${fileName}`);
      updateTestResult('enhanced-csv', 'success');
    } catch (error: any) {
      addLog(`Error during enhanced CSV export: ${error.message || 'Unknown error'}`);
      console.error('Enhanced CSV export error:', error);
      
      // More detailed error logging
      if (error.stack) {
        addLog(`Error stack: ${error.stack.split('\n')[0]}`);
      }
      updateTestResult('enhanced-csv', 'failed');
    }
  };
  
  const testEnhancedZipExport = async () => {
    addLog('Starting enhanced ZIP export test...');
    updateTestResult('enhanced-zip', 'pending');
    
    try {
      addLog('Using exportMultipleRequestsAsZip utility...');
      const fileName = await exportMultipleRequestsAsZip([mockPurchaseRequest], true);
      addLog(`ZIP export successful: ${fileName}`);
      updateTestResult('enhanced-zip', 'success');
    } catch (error: any) {
      addLog(`Error during enhanced ZIP export: ${error.message || 'Unknown error'}`);
      console.error('Enhanced ZIP export error:', error);
      updateTestResult('enhanced-zip', 'failed');
    }
  };

  // Clear logs
  const clearLogs = () => setLogs([]);

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Export Functionality Test Page</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Basic Export Tests</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Button 
            variant="default" 
            onClick={testCsvExport}
            className="w-full"
          >
            Test CSV Export (SaveAs)
          </Button>
          
          <Button 
            variant="default" 
            onClick={testAlternativeDownload}
            className="w-full"
          >
            Test CSV Export (Alternative)
          </Button>
          
          <Button 
            variant="default" 
            onClick={testExcelExport}
            className="w-full"
          >
            Test Excel Export
          </Button>
        </div>
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
            onClick={testEnhancedExcelExport}
            className="w-full"
          >
            Test Enhanced Excel Export
          </Button>
          
          <Button 
            variant="outline" 
            onClick={testEnhancedCsvExport}
            className="w-full"
          >
            Test Enhanced CSV Export
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Button 
            variant="secondary" 
            onClick={testBulkExcelExport}
            className="w-full"
          >
            Test Bulk Excel Export
          </Button>
          
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
              <h3 className="text-sm font-medium mb-2">Basic Export Tests</h3>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs">CSV Export (SaveAs)</span>
                  <Badge variant={
                    testResults['basic-csv'] === 'success' ? 'success' : 
                    testResults['basic-csv'] === 'pending' ? 'outline' :
                    testResults['basic-csv'] === 'failed' ? 'destructive' : 'secondary'
                  }>
                    {testResults['basic-csv'] === 'not-run' ? 'Not Run' : 
                     testResults['basic-csv'] === 'pending' ? 'Running...' :
                     testResults['basic-csv'] === 'success' ? 'Success' : 'Failed'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs">CSV Export (Alternative)</span>
                  <Badge variant={
                    testResults['basic-alternative'] === 'success' ? 'success' : 
                    testResults['basic-alternative'] === 'pending' ? 'outline' :
                    testResults['basic-alternative'] === 'failed' ? 'destructive' : 'secondary'
                  }>
                    {testResults['basic-alternative'] === 'not-run' ? 'Not Run' : 
                     testResults['basic-alternative'] === 'pending' ? 'Running...' :
                     testResults['basic-alternative'] === 'success' ? 'Success' : 'Failed'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs">Excel Export</span>
                  <Badge variant={
                    testResults['basic-excel'] === 'success' ? 'success' : 
                    testResults['basic-excel'] === 'pending' ? 'outline' :
                    testResults['basic-excel'] === 'failed' ? 'destructive' : 'secondary'
                  }>
                    {testResults['basic-excel'] === 'not-run' ? 'Not Run' : 
                     testResults['basic-excel'] === 'pending' ? 'Running...' :
                     testResults['basic-excel'] === 'success' ? 'Success' : 'Failed'}
                  </Badge>
                </div>
              </div>
            </div>
            
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
                  <span className="text-xs">Excel Export</span>
                  <Badge variant={
                    testResults['enhanced-excel'] === 'success' ? 'success' : 
                    testResults['enhanced-excel'] === 'pending' ? 'outline' :
                    testResults['enhanced-excel'] === 'failed' ? 'destructive' : 'secondary'
                  }>
                    {testResults['enhanced-excel'] === 'not-run' ? 'Not Run' : 
                     testResults['enhanced-excel'] === 'pending' ? 'Running...' :
                     testResults['enhanced-excel'] === 'success' ? 'Success' : 'Failed'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs">CSV Export</span>
                  <Badge variant={
                    testResults['enhanced-csv'] === 'success' ? 'success' : 
                    testResults['enhanced-csv'] === 'pending' ? 'outline' :
                    testResults['enhanced-csv'] === 'failed' ? 'destructive' : 'secondary'
                  }>
                    {testResults['enhanced-csv'] === 'not-run' ? 'Not Run' : 
                     testResults['enhanced-csv'] === 'pending' ? 'Running...' :
                     testResults['enhanced-csv'] === 'success' ? 'Success' : 'Failed'}
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
                  <span className="text-xs">Bulk Excel Export</span>
                  <Badge variant={
                    testResults['bulk-excel'] === 'success' ? 'success' : 
                    testResults['bulk-excel'] === 'pending' ? 'outline' :
                    testResults['bulk-excel'] === 'failed' ? 'destructive' : 'secondary'
                  }>
                    {testResults['bulk-excel'] === 'not-run' ? 'Not Run' : 
                     testResults['bulk-excel'] === 'pending' ? 'Running...' :
                     testResults['bulk-excel'] === 'success' ? 'Success' : 'Failed'}
                  </Badge>
                </div>
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
          It includes both basic direct implementations and our enhanced export utilities.
        </p>
        <ul className="list-disc list-inside text-sm space-y-1">
          <li>The Basic Tests use direct library calls (saveAs, createObjectURL, etc.)</li>
          <li>The Enhanced Tests use our improved utilities from exportUtils.ts</li>
          <li>The Bulk Tests verify multiple-request exports with proper file formatting</li>
          <li>All exports use the UTF-8 encoding with proper BOM implementation</li>
          <li>Enhanced exports include better error handling, validation, and fallbacks</li>
          <li>All downloads use the same safeDownload method with multiple fallback mechanisms</li>
          <li>All logs are displayed above for debugging and troubleshooting</li>
        </ul>
      </div>
    </div>
  );
}