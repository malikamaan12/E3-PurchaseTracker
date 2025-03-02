// This is a test script to verify CSV generation and downloading functionality
import { Parser } from '@json2csv/plainjs';
import { saveAs } from 'file-saver';

// Test basic data
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

// Function to test CSV generation and download
function testCsvExport() {
  console.log('Starting CSV export test...');
  
  try {
    // Create CSV with basic configuration
    const parser = new Parser({
      header: true,
      delimiter: ','
    });
    
    // Parse data - must be in array format
    const csv = parser.parse([testData]);
    console.log('CSV generated successfully:');
    console.log(csv.substring(0, 200) + '...');
    
    // Create blob for download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    
    // Try to force download
    try {
      saveAs(blob, 'test-export.csv');
      console.log('SaveAs called successfully');
    } catch (saveError) {
      console.error('Error in saveAs function:', saveError);
    }
    
    // Alternative download method
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'test-export-alternative.csv';
      link.click();
      URL.revokeObjectURL(url);
      console.log('Alternative download method executed');
    } catch (alternativeError) {
      console.error('Error in alternative download method:', alternativeError);
    }
  } catch (error) {
    console.error('Error during CSV generation:', error);
  }
}

// Run the test
testCsvExport();

console.log('Test completed. Check your downloads folder for test-export.csv');

// Export the function for browser console testing
window.testCsvExport = testCsvExport;