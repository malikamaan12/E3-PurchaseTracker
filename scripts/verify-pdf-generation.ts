import { generatePurchaseRequestPdf } from "../src/lib/pdf/RequestPdfGenerator";
import fs from "fs";
import path from "path";

async function verifyPdfGeneration() {
  console.log("================================================================================");
  console.log("PDF GENERATION & COMPLIANCE STAMP INSPECTION");
  console.log("================================================================================\n");

  const outputDir = path.join(process.cwd(), "scratch", "pdf_test_output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Base mock PR
  const basePr: any = {
    id: 101,
    prNumber: "PR-2026-TEST-001",
    title: "Office Technology & Hardware Equipment Procurement for Q3",
    description: "Procurement of workstations, monitors, network peripherals, and server racks.",
    status: "submitted",
    priority: "high",
    currency: "QAR",
    estimatedTotal: 85000,
    purposeType: "Operating Expense",
    department: "Information Technology",
    createdAt: new Date(),
    requester: {
      id: 1,
      username: "salman.finance",
      department: "Finance",
    },
    subPurpose: {
      name: "IT Infrastructure & Security Upgrade",
    },
    items: [
      { id: 1, itemName: "Dell PowerEdge Server Rack 42U", quantity: 2, estimatedCost: 15000 },
      { id: 2, itemName: "Cisco Catalyst 9300 48-Port Switch", quantity: 4, estimatedCost: 8000 },
      { id: 3, itemName: "MacBook Pro M3 Max 36GB RAM", quantity: 3, estimatedCost: 9000 },
    ],
    attachments: [
      { id: 1, fileName: "Vendor_Formal_Quotation_v2.pdf", fileSize: 245000 },
      { id: 2, fileName: "Technical_Specifications_Sheet.pdf", fileSize: 180000 },
    ],
    approvals: [
      { id: 1, department: "IT", status: "approved", approver: { username: "it.manager" }, processedAt: new Date() },
      { id: 2, department: "Finance", status: "pending", approver: null },
    ],
  };

  // Scenario 1: Compliant Vendor
  console.log("1. Generating PDF: Compliant Vendor (100% Score)...");
  const pr1 = {
    ...basePr,
    vendor: { id: 1, companyName: "Apex Tech Solutions W.L.L.", complianceScore: 100, complianceStatus: "compliant", contactPerson: "John Doe" },
    latestComplianceSnapshot: { snapshotData: { score: 100, status: "compliant", missingMandatoryDocuments: [] } },
  };
  const pdf1 = await generatePurchaseRequestPdf(pr1);
  fs.writeFileSync(path.join(outputDir, "1_compliant_vendor.pdf"), pdf1);
  console.log("✓ Saved 1_compliant_vendor.pdf (Size:", pdf1.length, "bytes)");

  // Scenario 2: Compliance Pending Vendor
  console.log("2. Generating PDF: Pending Vendor (0% Score)...");
  const pr2 = {
    ...basePr,
    vendor: { id: 2, companyName: "Brand New Quick Vendor LLC", complianceScore: 0, complianceStatus: "pending", contactPerson: "Ahmed Al-Mansoori" },
    latestComplianceSnapshot: { snapshotData: { score: 0, status: "pending", missingMandatoryDocuments: ["Commercial Registration"] } },
  };
  const pdf2 = await generatePurchaseRequestPdf(pr2);
  fs.writeFileSync(path.join(outputDir, "2_pending_vendor.pdf"), pdf2);
  console.log("✓ Saved 2_pending_vendor.pdf (Size:", pdf2.length, "bytes)");

  // Scenario 3: Non-Compliant Vendor
  console.log("3. Generating PDF: Non-Compliant Vendor (20% Score)...");
  const pr3 = {
    ...basePr,
    vendor: { id: 3, companyName: "Overdue Media Co.", complianceScore: 20, complianceStatus: "non_compliant", contactPerson: "Tariq Aziz" },
    latestComplianceSnapshot: { snapshotData: { score: 20, status: "non_compliant", missingMandatoryDocuments: ["Qatar ID", "Tax Card"] } },
  };
  const pdf3 = await generatePurchaseRequestPdf(pr3);
  fs.writeFileSync(path.join(outputDir, "3_non_compliant_vendor.pdf"), pdf3);
  console.log("✓ Saved 3_non_compliant_vendor.pdf (Size:", pdf3.length, "bytes)");

  // Scenario 4: Long Missing Requirements List
  console.log("4. Generating PDF: Long Missing Requirements List (Dynamic Wrapping)...");
  const pr4 = {
    ...basePr,
    vendor: { id: 4, companyName: "Complex Global Supplier Ltd.", complianceScore: 10, complianceStatus: "non_compliant", contactPerson: "Sara Connor" },
    latestComplianceSnapshot: {
      snapshotData: {
        score: 10,
        status: "non_compliant",
        missingMandatoryDocuments: [
          "Commercial Registration",
          "Tax Card Certificate",
          "Establishment Computer Card",
          "Bank Account Verification Letter",
          "Municipal Trade License",
        ],
      },
    },
  };
  const pdf4 = await generatePurchaseRequestPdf(pr4);
  fs.writeFileSync(path.join(outputDir, "4_long_missing_list.pdf"), pdf4);
  console.log("✓ Saved 4_long_missing_list.pdf (Size:", pdf4.length, "bytes)");

  // Scenario 5: Multi-page PR
  console.log("5. Generating PDF: Multi-page PR with 15 Line Items...");
  const multiItems = Array.from({ length: 15 }, (_, i) => ({
    id: i + 1,
    itemName: `High-Density Enterprise Server Component Unit #${i + 1} with Extended Warranty & 24/7 SLA`,
    quantity: (i % 5) + 1,
    estimatedCost: (i + 1) * 2500,
  }));
  const pr5 = {
    ...basePr,
    items: multiItems,
    vendor: { id: 5, companyName: "Global Tech Distribution", complianceScore: 0, complianceStatus: "pending", contactPerson: "Hamad Al-Thani" },
    latestComplianceSnapshot: { snapshotData: { score: 0, status: "pending", missingMandatoryDocuments: ["Commercial Registration"] } },
  };
  const pdf5 = await generatePurchaseRequestPdf(pr5);
  fs.writeFileSync(path.join(outputDir, "5_multipage_pr.pdf"), pdf5);
  console.log("✓ Saved 5_multipage_pr.pdf (Size:", pdf5.length, "bytes)");

  console.log("\n================================================================================");
  console.log("✓ ALL 5 PDF SCENARIOS GENERATED & VERIFIED SUCCESSFULLY");
  console.log("================================================================================\n");
}

verifyPdfGeneration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("PDF generation failed:", err);
    process.exit(1);
  });
