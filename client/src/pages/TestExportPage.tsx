import React, { useState } from 'react';
import { Button } from "../components/ui/button";
import { Parser } from '@json2csv/plainjs';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

export default function TestExportPage() {
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString().slice(11, 23)} - ${message}`]);
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
      } catch (saveError: any) {
        addLog(`Error in saveAs function: ${saveError.message || 'Unknown error'}`);
        console.error('Error in saveAs function:', saveError);
      }
    } catch (error: any) {
      addLog(`Error during CSV generation: ${error.message || 'Unknown error'}`);
      console.error('Error during CSV generation:', error);
    }
  };

  // Test function for alternative download method
  const testAlternativeDownload = () => {
    addLog('Starting alternative download test...');
    
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
    } catch (error: any) {
      addLog(`Error in alternative download method: ${error.message || 'Unknown error'}`);
      console.error('Error in alternative download method:', error);
    }
  };

  // Test function for Excel export
  const testExcelExport = () => {
    addLog('Starting Excel export test...');
    
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
      } catch (saveError: any) {
        addLog(`Error saving Excel file: ${saveError.message || 'Unknown error'}`);
        console.error('Error saving Excel file:', saveError);
      }
    } catch (error: any) {
      addLog(`Error during Excel generation: ${error.message || 'Unknown error'}`);
      console.error('Error during Excel generation:', error);
    }
  };

  // Clear logs
  const clearLogs = () => setLogs([]);

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Export Functionality Test Page</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
      
      <div className="bg-slate-100 dark:bg-slate-900 rounded-md p-4 mb-4">
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
      
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-md p-4">
        <h3 className="font-semibold mb-2">How This Works</h3>
        <p className="text-sm mb-2">
          This test page implements different methods of generating and downloading CSV and Excel files to help diagnose download issues.
        </p>
        <ul className="list-disc list-inside text-sm space-y-1">
          <li>The CSV tests use the @json2csv/plainjs Parser</li>
          <li>The Excel test uses the xlsx library</li>
          <li>All logs are displayed above for debugging</li>
        </ul>
      </div>
    </div>
  );
}