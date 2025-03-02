import { Parser } from '@json2csv/plainjs';

// Sample data
const data = [
  { id: 1, name: 'John', age: 30 },
  { id: 2, name: 'Jane', age: 25 },
  { id: 3, name: 'Bob', age: 40 }
];

// Try to convert to CSV
try {
  console.log("Creating parser...");
  const parser = new Parser();
  
  console.log("Parsing data...");
  const csv = parser.parse(data);
  
  console.log("CSV output:");
  console.log(csv);
} catch (err) {
  console.error("Error:", err.message);
}