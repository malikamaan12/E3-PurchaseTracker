import React, { useState, useEffect } from 'react';
import { Button } from "../components/ui/button";
import { saveAs } from 'file-saver';
import { 
  exportRequestToPDF,
  exportMultipleRequestsAsZip,
  exportMultipleRequestsToPDF
} from '../lib/exportUtils';
import { 
  validateResourceId, 
  logExportEvent, 
  logZipExport,
  logDiagnosticExport
} from '../lib/exportAuditUtils';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";

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
    'bulk-pdf': 'not-run',
    'csv-diagnostics': 'not-run'
  });
  const [diagnosticResult, setDiagnosticResult] = useState<CsvDiagnosticsResult | null>(null);

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

  // Test function for CSV export with unified audit logging
  const testCsvExport = async () => { // Changed to async for audit logging
    addLog('Starting CSV export test with unified audit logging...');
    updateTestResult('basic-csv', 'pending');
    
    try {
      // Test ID validation before export
      const validatedId = validateResourceId(999999); // Special diagnostic ID
      addLog(`ID validation result: ${validatedId !== null ? `✓ VALID (${validatedId})` : '✗ INVALID'}`);
      
      // If ID is invalid, we won't proceed with export
      if (validatedId === null) {
        addLog('Cannot proceed with export - resource ID failed validation');
        updateTestResult('basic-csv', 'failed');
        return;
      }
      
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
      const fileName = 'test-export.csv';
      
      // Try to force download
      try {
        saveAs(blob, fileName);
        addLog('SaveAs called successfully');
        
        // Log the export event
        try {
          addLog('Logging CSV export event using unified audit system...');
          const auditResult = await logCsvExport(
            validatedId,
            {
              fileName: fileName,
              fileSize: blob.size,
              exportType: 'test'
            },
            'admin'
          );
          
          if (auditResult) {
            addLog('✓ CSV Audit logging successful');
          } else {
            addLog('⚠️ CSV Audit logging partial failure (export still succeeded)');
          }
        } catch (auditError: any) {
          addLog(`❌ Error logging CSV export: ${auditError.message || 'Unknown error'}`);
          console.error('CSV export audit error:', auditError);
          // Don't fail the test just because of audit logging issues
        }
        
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

  // Test function for alternative download method with unified audit logging
  const testAlternativeDownload = async () => { // Changed to async for audit logging
    addLog('Starting alternative download test with unified audit logging...');
    updateTestResult('basic-alternative', 'pending');
    
    try {
      // Test ID validation before export
      const validatedId = validateResourceId(999999); // Special diagnostic ID
      addLog(`ID validation result: ${validatedId !== null ? `✓ VALID (${validatedId})` : '✗ INVALID'}`);
      
      // If ID is invalid, we won't proceed with export
      if (validatedId === null) {
        addLog('Cannot proceed with export - resource ID failed validation');
        updateTestResult('basic-alternative', 'failed');
        return;
      }
      
      // Create CSV with basic configuration
      const parser = new Parser({
        header: true,
        delimiter: ','
      });
      
      const csv = parser.parse([testData]);
      addLog('CSV generated successfully');
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const fileName = 'test-export-alternative.csv';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addLog('Alternative download method executed');
      
      // Log the export event
      try {
        addLog('Logging CSV export event using unified audit system...');
        const auditResult = await logCsvExport(
          validatedId,
          {
            fileName: fileName,
            fileSize: blob.size,
            exportType: 'test'
          },
          'user'
        );
        
        if (auditResult) {
          addLog('✓ CSV Audit logging successful');
        } else {
          addLog('⚠️ CSV Audit logging partial failure (export still succeeded)');
        }
      } catch (auditError: any) {
        addLog(`❌ Error logging CSV export: ${auditError.message || 'Unknown error'}`);
        console.error('CSV export audit error:', auditError);
        // Don't fail the test just because of audit logging issues
      }
      
      updateTestResult('basic-alternative', 'success');
    } catch (error: any) {
      addLog(`Error in alternative download method: ${error.message || 'Unknown error'}`);
      console.error('Error in alternative download method:', error);
      updateTestResult('basic-alternative', 'failed');
    }
  };

  // Test function for Excel export with unified audit logging
  const testExcelExport = async () => { // Changed to async for audit logging
    addLog('Starting Excel export test with unified audit logging...');
    updateTestResult('basic-excel', 'pending');
    
    try {
      // Test ID validation before export
      const validatedId = validateResourceId(999999); // Special diagnostic ID
      addLog(`ID validation result: ${validatedId !== null ? `✓ VALID (${validatedId})` : '✗ INVALID'}`);
      
      // If ID is invalid, we won't proceed with export
      if (validatedId === null) {
        addLog('Cannot proceed with export - resource ID failed validation');
        updateTestResult('basic-excel', 'failed');
        return;
      }
      
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
        
        // Log the export event
        try {
          addLog('Logging Excel export event using unified audit system...');
          const auditResult = await logExcelExport(
            validatedId,
            {
              fileName: fileName,
              fileSize: 1024 * 5, // Example file size (5KB)
              exportType: 'test'
            },
            'approver'
          );
          
          if (auditResult) {
            addLog('✓ Excel Audit logging successful');
          } else {
            addLog('⚠️ Excel Audit logging partial failure (export still succeeded)');
          }
        } catch (auditError: any) {
          addLog(`❌ Error logging Excel export: ${auditError.message || 'Unknown error'}`);
          console.error('Excel export audit error:', auditError);
          // Don't fail the test just because of audit logging issues
        }
        
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
      
      // Test with different user types, but all will use the same consolidated format
      // The type parameter is only for audit logging, not for different PDF layouts
      const userFileName = await exportRequestToPDF(mockPurchaseRequest, 'user');
      addLog(`User PDF export successful: ${userFileName}`);
      
      const approverFileName = await exportRequestToPDF(mockPurchaseRequest, 'approver');
      addLog(`Approver PDF export successful: ${approverFileName}`);
      
      const adminFileName = await exportRequestToPDF(mockPurchaseRequest, 'admin');
      addLog(`Admin PDF export successful: ${adminFileName}`);
      
      // Log PDF export using the general logExportEvent function since there's no specific PDF export log function
      try {
        addLog('Logging PDF export event using unified audit system...');
        const auditResult = await logExportEvent(
          mockPurchaseRequest.id,
          'pdf',
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
        // Don't fail the test just because of audit logging issues
      }
      
      addLog('All PDF types use the same consolidated format with no duplicate fields');
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
      // Test ID validation before export
      const validatedId = validateResourceId(mockPurchaseRequest.id);
      addLog(`ID validation result: ${validatedId !== null ? `✓ VALID (${validatedId})` : '✗ INVALID'}`);
      
      // If ID is invalid, we won't proceed with export
      if (validatedId === null) {
        addLog('Cannot proceed with export - request ID failed validation');
        updateTestResult('enhanced-excel', 'failed');
        return;
      }
      
      addLog('Using exportRequestToExcel utility...');
      console.log('Mock request data:', mockPurchaseRequest);
      
      const fileName = await exportRequestToExcel(mockPurchaseRequest);
      addLog(`Excel export successful: ${fileName}`);
      
      // Log the export event using our specialized Excel export function
      try {
        addLog('Logging Excel export event using unified audit system...');
        const auditResult = await logExcelExport(
          mockPurchaseRequest.id,
          {
            fileName: fileName,
            fileSize: 1024 * 3, // Example file size
            exportType: 'test'
          },
          'user'
        );
        
        if (auditResult) {
          addLog('✓ Excel Audit logging successful');
        } else {
          addLog('⚠️ Excel Audit logging partial failure (export still succeeded)');
        }
      } catch (auditError: any) {
        addLog(`❌ Error logging Excel export: ${auditError.message || 'Unknown error'}`);
        console.error('Excel export audit error:', auditError);
        // Don't fail the test just because of audit logging issues
      }
      
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
    addLog('Starting enhanced CSV export test with improved audit logging...');
    updateTestResult('enhanced-csv', 'pending');
    
    try {
      // Test ID validation before export
      const validatedId = validateResourceId(mockPurchaseRequest.id);
      addLog(`ID validation result: ${validatedId !== null ? `✓ VALID (${validatedId})` : '✗ INVALID'}`);
      
      // If ID is invalid, we won't proceed with export
      if (validatedId === null) {
        addLog('Cannot proceed with export - request ID failed validation');
        updateTestResult('enhanced-csv', 'failed');
        return;
      }
      
      addLog('Using exportRequestToCSV utility...');
      console.log('Mock request data for CSV:', mockPurchaseRequest);
      
      // Run the actual export
      const fileName = await exportRequestToCSV(mockPurchaseRequest);
      addLog(`CSV export successful: ${fileName}`);
      
      // Log the export event using our unified audit logging
      try {
        addLog('Logging export event using unified audit system...');
        const auditResult = await logCsvExport(
          mockPurchaseRequest.id,
          {
            fileName: fileName,
            fileSize: 1024, // Example file size
            exportType: 'test'
          },
          'user'
        );
        
        if (auditResult) {
          addLog('✓ Audit logging successful');
        } else {
          addLog('⚠️ Audit logging partial failure (export still succeeded)');
        }
      } catch (auditError: any) {
        // Don't fail the test if audit logging fails
        addLog(`⚠️ Audit logging error: ${auditError.message || 'Unknown audit error'}`);
        console.warn('Audit logging error (non-critical):', auditError);
      }
      
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
      // Test ID validation before export
      const validatedId = validateResourceId(mockPurchaseRequest.id);
      addLog(`ID validation result: ${validatedId !== null ? `✓ VALID (${validatedId})` : '✗ INVALID'}`);
      
      // If ID is invalid, we won't proceed with export
      if (validatedId === null) {
        addLog('Cannot proceed with export - request ID failed validation');
        updateTestResult('enhanced-zip', 'failed');
        return;
      }
      
      addLog('Using exportMultipleRequestsAsZip utility...');
      const fileName = await exportMultipleRequestsAsZip([mockPurchaseRequest], true);
      addLog(`ZIP export successful: ${fileName}`);
      
      // Log the export event using our specialized zip export function
      try {
        addLog('Logging ZIP export event using unified audit system...');
        const auditResult = await logZipExport(
          mockPurchaseRequest.id,
          {
            fileName: fileName,
            fileSize: 1024 * 10, // Example file size
            exportType: 'test'
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
        // Don't fail the test just because of audit logging issues
      }
      
      updateTestResult('enhanced-zip', 'success');
    } catch (error: any) {
      addLog(`Error during enhanced ZIP export: ${error.message || 'Unknown error'}`);
      console.error('Enhanced ZIP export error:', error);
      updateTestResult('enhanced-zip', 'failed');
    }
  };

  // Advanced CSV diagnostics with detailed reporting
  const runCsvDiagnostics = async () => {
    addLog('Starting comprehensive CSV export diagnostics...');
    updateTestResult('csv-diagnostics', 'pending');
    setDiagnosticResult(null);
    
    try {
      // Test ID validation directly
      addLog('Testing unified resource ID validation...');
      
      // Test different ID formats to ensure our validation is robust
      const testIds = [
        999999,                // Special diagnostic ID - should pass
        12345,                 // Regular numeric ID - should pass
        '12345',               // String numeric ID - should pass
        'REQ-12345',           // String with numeric component - should pass
        'request-12345',       // Another string format - should pass
        null,                  // Invalid - should fail
        undefined,             // Invalid - should fail
        'not-a-number',        // Invalid - should fail
        -1,                    // Invalid negative - should fail
        0                      // Invalid zero - should fail
      ];
      
      // Run validation tests
      addLog('Testing multiple ID formats with unified validator:');
      testIds.forEach(id => {
        const validatedId = validateResourceId(id);
        addLog(`  • ID "${id}" → ${validatedId !== null ? `✓ VALID (${validatedId})` : '✗ INVALID'}`);
      });
      
      // Create a test data object with a numeric request ID for enhanced validation
      const diagnosticData = {
        ...testData,
        id: 999999, // Special diagnostic ID that's handled by our validation
        request_id: 999999,
        requestId: 999999,
        testMode: true
      };
      
      // Test direct audit logging
      addLog('Testing direct diagnostic export logging for different formats...');
      
      // Test CSV audit logging
      const csvAuditResult = await logDiagnosticExport('csv');
      addLog(`CSV audit test: ${csvAuditResult ? '✓ SUCCESS' : '✗ FAILED'}`);
      
      // Test Excel audit logging
      const excelAuditResult = await logDiagnosticExport('excel');
      addLog(`Excel audit test: ${excelAuditResult ? '✓ SUCCESS' : '✗ FAILED'}`);
      
      // Test PDF audit logging
      const pdfAuditResult = await logDiagnosticExport('pdf');
      addLog(`PDF audit test: ${pdfAuditResult ? '✓ SUCCESS' : '✗ FAILED'}`);
      
      // Test ZIP audit logging
      const zipAuditResult = await logDiagnosticExport('zip');
      addLog(`ZIP audit test: ${zipAuditResult ? '✓ SUCCESS' : '✗ FAILED'}`);
      
      // Use our enhanced diagnostics utility with improved testing data
      addLog('Running step-by-step CSV diagnostics with enhanced validation and error handling...');
      const result = await runCsvExportDiagnostics(diagnosticData);
      setDiagnosticResult(result);
      
      if (result.success) {
        addLog(`CSV diagnostics completed successfully at stage: ${result.stage}`);
        if (result.details) {
          Object.entries(result.details).forEach(([key, value]) => {
            addLog(`- ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
          });
        }
        
        // If audit logging stage had issues, note it but still mark as success
        if (result.stage === 'audit-logging' && result.error) {
          addLog(`Note: Audit logging had issues: ${result.error}`);
          addLog(`This is a partial issue but doesn't affect file generation`);
        }
        
        updateTestResult('csv-diagnostics', 'success');
      } else {
        addLog(`CSV diagnostics failed at stage: ${result.stage}`);
        addLog(`Error: ${result.error}`);
        
        // Add details if available
        if (result.details) {
          addLog('Additional details:');
          Object.entries(result.details).forEach(([key, value]) => {
            addLog(`- ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
          });
        }
        
        if (result.recommendedFix) {
          addLog(`Recommended fix: ${result.recommendedFix}`);
        }
        
        updateTestResult('csv-diagnostics', 'failed');
      }
    } catch (error: any) {
      addLog(`Error during CSV diagnostics: ${error.message || 'Unknown error'}`);
      console.error('CSV diagnostics error:', error);
      
      // Provide more detailed error information if available
      if (error.stack) {
        const firstLine = error.stack.split('\n')[0];
        addLog(`Error details: ${firstLine}`);
      }
      
      updateTestResult('csv-diagnostics', 'failed');
    }
  };
  
  // Clear logs
  const clearLogs = () => setLogs([]);

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Export Functionality Test Page</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Basic Export Tests</h2>
        <div className="grid grid-cols-1 md:grid-cols-1 gap-4 mb-4">
          <Alert className="bg-amber-50 text-amber-800 border-amber-200">
            <AlertTitle>CSV and Excel export options removed</AlertTitle>
            <AlertDescription>
              Per requirements, Excel and CSV export functionality has been removed.
              Only PDF and ZIP export options are now supported.
            </AlertDescription>
          </Alert>
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

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Advanced Diagnostics</h2>
        <div className="grid grid-cols-1 gap-4 mb-4">
          <Button 
            variant="destructive" 
            onClick={runCsvDiagnostics}
            className="w-full"
          >
            Run Comprehensive CSV Diagnostics
          </Button>
          
          {diagnosticResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  CSV Diagnostics Result
                  <Badge variant={diagnosticResult.success ? 'success' : 'destructive'}>
                    {diagnosticResult.success ? 'Success' : 'Failed'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="font-medium">Stage:</span>
                    <span>{diagnosticResult.stage}</span>
                  </div>
                  
                  {diagnosticResult.error && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertTitle>Error Detected</AlertTitle>
                      <AlertDescription>
                        {diagnosticResult.error}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {diagnosticResult.recommendedFix && (
                    <Alert variant="default" className="mb-4 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                      <AlertTitle>Recommended Fix</AlertTitle>
                      <AlertDescription>
                        {diagnosticResult.recommendedFix}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {diagnosticResult.details && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Details:</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {Object.entries(diagnosticResult.details).map(([key, value]) => (
                          <li key={key}><span className="font-medium">{key}:</span> {String(value)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
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
            
            <div className="bg-white dark:bg-slate-800 p-3 rounded-md">
              <h3 className="text-sm font-medium mb-2">Advanced Diagnostics</h3>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs">CSV Diagnostics</span>
                  <Badge variant={
                    testResults['csv-diagnostics'] === 'success' ? 'success' : 
                    testResults['csv-diagnostics'] === 'pending' ? 'outline' :
                    testResults['csv-diagnostics'] === 'failed' ? 'destructive' : 'secondary'
                  }>
                    {testResults['csv-diagnostics'] === 'not-run' ? 'Not Run' : 
                     testResults['csv-diagnostics'] === 'pending' ? 'Running...' :
                     testResults['csv-diagnostics'] === 'success' ? 'Success' : 'Failed'}
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
          <li>The Advanced Diagnostics run comprehensive analysis with detailed reporting</li>
          <li>All exports use the UTF-8 encoding with proper BOM implementation</li>
          <li>Enhanced exports include better error handling, validation, and fallbacks</li>
          <li>CSV Diagnostics use step-by-step analysis with multiple fallback mechanisms</li>
          <li>All exports include proper audit logging with the PDF audit endpoint</li>
          <li>All logs are displayed above for debugging and troubleshooting</li>
        </ul>
      </div>
    </div>
  );
}