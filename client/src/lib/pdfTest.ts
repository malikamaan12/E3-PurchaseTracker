// Test file to debug jsPDF autoTable issue
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Create a simple test function
export function testAutoTable() {
  console.log('Testing autoTable functionality...');
  
  const doc = new jsPDF();
  
  // Log the doc object to see what methods are available
  console.log('jsPDF instance methods:', Object.getOwnPropertyNames(doc));
  console.log('jsPDF prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(doc)));
  
  // Check if autoTable exists
  console.log('autoTable method exists:', typeof (doc as any).autoTable);
  
  try {
    // Try to call autoTable
    (doc as any).autoTable({
      head: [['Test']],
      body: [['Data']]
    });
    console.log('autoTable call successful');
  } catch (error) {
    console.error('autoTable error:', error);
  }
}