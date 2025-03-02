import { Parser } from '@json2csv/plainjs';

// Sample data resembling our actual data structure
const basicData = {
  request_number: 'REQ-123',
  title: 'Test Request',
  status: 'draft',
  priority: 'medium',
  created_date: new Date().toISOString(),
  requester: 'John Doe',
  department: 'IT',
  purpose_type: 'Hardware',
  sub_purpose: 'Laptop',
  description: 'Need a new laptop',
  total_estimated_cost: 1500,
  currency: 'USD',
  vendor: 'Dell'
};

// Items data
const items = [
  {
    item_number: 1,
    name: 'Laptop XPS',
    quantity: 1,
    estimated_cost: 1200,
    total: 1200,
    description: 'Dell XPS 13'
  },
  {
    item_number: 2,
    name: 'Monitor',
    quantity: 2,
    estimated_cost: 150,
    total: 300,
    description: 'Dell 27 inch monitor'
  }
];

// Approvals data
const approvals = [
  {
    approval_number: 1,
    department: 'IT',
    approver: 'Jane Smith',
    status: 'approved',
    date: new Date().toISOString(),
    comments: 'Approved as requested'
  }
];

// Test each export type
try {
  console.log("Testing Basic Data Export:");
  const basicParser = new Parser();
  const basicCsv = basicParser.parse([basicData]);
  console.log(basicCsv.substring(0, 100) + '...\n');
  
  console.log("Testing Items Export:");
  const itemsParser = new Parser();
  const itemsCsv = itemsParser.parse(items);
  console.log(itemsCsv);
  
  console.log("\nTesting Approvals Export:");
  const approvalsParser = new Parser();
  const approvalsCsv = approvalsParser.parse(approvals);
  console.log(approvalsCsv);
  
} catch (err) {
  console.error("Error:", err.message);
}