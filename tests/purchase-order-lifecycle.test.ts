import { db } from "../db";
import { users, vendors, purchaseRequests, purchaseOrders, purchaseOrderEvents } from "../db/schema";
import { eq } from "drizzle-orm";
import { PurchaseOrderService } from "../src/lib/services/PurchaseOrderService";
import { generatePurchaseOrderPdf } from "../src/lib/pdf/PoPdfGenerator";

async function runPurchaseOrderTests() {
  console.log("=================================================================");
  console.log("RUNNING SUITE: Purchase Order (PO) System Lifecycle & Security Tests");
  console.log("=================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`✓ [PASS] Test ${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`✗ [FAIL] Test ${totalTests}: ${testName}`);
      if (detail) console.error(`   Detail: ${detail}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  // 1. Setup Test Fixtures
  console.log("--- Setting up test fixtures ---");
  const timestamp = Date.now();

  // Create Finance User
  const [financeUser] = await db
    .insert(users)
    .values({
      username: `finance_test_${timestamp}`,
      password: "hashed_password",
      email: `finance_${timestamp}@e3.qa`,
      contact_number: "+97455551111",
      department: "Finance",
      role: "user",
    })
    .returning();

  // Create Regular Non-Finance User
  const [regularUser] = await db
    .insert(users)
    .values({
      username: `requester_test_${timestamp}`,
      password: "hashed_password",
      email: `requester_${timestamp}@e3.qa`,
      contact_number: "+97455552222",
      department: "Marketing",
      role: "user",
    })
    .returning();

  // Create Test Vendor
  const [testVendor] = await db
    .insert(vendors)
    .values({
      companyName: `PO Test Vendor ${timestamp} WLL`,
      contactPerson: "Ahmed Al-Kuwari",
      contactNumber: "+97444443333",
      email: `vendor_${timestamp}@example.com`,
      address: "Industrial Area St 12, Doha, Qatar",
      taxNumber: "1234567890",
      registrationNumber: "CR-987654",
      bankName: "Qatar National Bank",
      accountNumber: "001122334455",
      ibanNumber: "QA12QNBA0000001122334455",
    })
    .returning();

  // Create an Unapproved Purchase Request (pending)
  const [unapprovedPr] = await db
    .insert(purchaseRequests)
    .values({
      requestNumber: `PR-TEST-PENDING-${timestamp}`,
      requesterId: regularUser.id,
      vendorId: testVendor.id,
      title: "Pending Office IT Workstations",
      description: "Laptops and docks for team expansion",
      department: "Marketing",
      status: "pending",
      items: [
        { name: "Dell Precision Workstation", quantity: 3, estimatedCost: 4500, description: "Core i9, 32GB RAM" },
        { name: "Dell 27-inch 4K Monitor", quantity: 6, estimatedCost: 1200, description: "USB-C Hub" },
      ],
      currency: "QAR",
      totalEstimatedCost: 20700,
      freightAmount: 300,
      paymentStructure: "POST_PROJECT",
    })
    .returning();

  // Create an Approved Purchase Request
  const [approvedPr] = await db
    .insert(purchaseRequests)
    .values({
      requestNumber: `PR-TEST-APP-${timestamp}`,
      requesterId: regularUser.id,
      vendorId: testVendor.id,
      title: "Approved Server Infrastructure",
      description: "Data center server racks and switches",
      department: "IT",
      status: "approved",
      items: [
        { name: "Enterprise Rack Server 2U", quantity: 2, estimatedCost: 18000, description: "Dual Xeon, NVMe array" },
        { name: "10GbE Top-of-Rack Switch", quantity: 2, estimatedCost: 6500, description: "48-port Managed" },
      ],
      currency: "QAR",
      totalEstimatedCost: 49000,
      freightAmount: 1000,
      paymentStructure: "POST_PROJECT",
    })
    .returning();

  console.log("Fixtures created.\n");

  // -------------------------------------------------------------
  // TEST 1: Guard - Cannot create PO for unapproved request
  // -------------------------------------------------------------
  console.log("--- Test 1: Guard on Request Status ---");
  try {
    await PurchaseOrderService.createPurchaseOrder({
      requestId: unapprovedPr.id,
      userId: financeUser.id,
      userRole: financeUser.role,
      userDepartment: financeUser.department,
    });
    assert(false, "Should reject unapproved request");
  } catch (err: any) {
    assert(
      err.message.includes("Purchase Orders can only be generated for approved requests"),
      "Rejects PO generation when PR is in 'pending' status",
      err.message
    );
  }

  // -------------------------------------------------------------
  // TEST 2: RBAC - Non-Finance, Non-Admin blocked from PO creation
  // -------------------------------------------------------------
  console.log("\n--- Test 2: RBAC Authorization Gate ---");
  try {
    await PurchaseOrderService.createPurchaseOrder({
      requestId: approvedPr.id,
      userId: regularUser.id,
      userRole: regularUser.role,
      userDepartment: regularUser.department, // Marketing
    });
    assert(false, "Should reject non-Finance user");
  } catch (err: any) {
    assert(
      err.message.includes("Access denied: Only Finance officers or Administrators"),
      "Blocks Marketing user from generating PO",
      err.message
    );
  }

  // -------------------------------------------------------------
  // TEST 3: Success - Finance creates PO for Approved Request
  // -------------------------------------------------------------
  console.log("\n--- Test 3: Successful PO Generation & Snapshots ---");
  const createResult = await PurchaseOrderService.createPurchaseOrder({
    requestId: approvedPr.id,
    userId: financeUser.id,
    userRole: financeUser.role,
    userDepartment: financeUser.department,
    expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    deliveryAddress: "E3 Data Center Site A, Doha, Qatar",
    specialInstructions: "Deliver between 9 AM and 4 PM with delivery challan.",
    status: "issued",
  });

  const po = createResult.purchaseOrder;
  const rawToken = createResult.rawToken;

  assert(!!po && !!po.id, "Purchase Order record created with primary key ID");
  assert(po.poNumber.startsWith("PO-"), `Generated valid sequential PO number: ${po.poNumber}`);
  assert(po.status === "issued", "PO status is 'issued'");
  assert(Number(po.subtotalAmount) === 49000, `Correct subtotal: 49,000 QAR (got ${po.subtotalAmount})`);
  assert(Number(po.freightAmount) === 1000, `Correct freight: 1,000 QAR (got ${po.freightAmount})`);
  assert(Number(po.totalAmount) === 50000, `Correct grand total: 50,000 QAR (got ${po.totalAmount})`);
  assert(Array.isArray(po.itemsSnapshot) && po.itemsSnapshot.length === 2, "Frozen items snapshot stored accurately");
  assert(!!rawToken && rawToken.length === 64, "Raw cryptographic 256-bit token generated");
  assert(!!po.tokenHash, "Token hash stored securely in database");

  // -------------------------------------------------------------
  // TEST 4: Idempotency - Duplicate active PO creation blocked
  // -------------------------------------------------------------
  console.log("\n--- Test 4: Duplicate PO Prevention ---");
  try {
    await PurchaseOrderService.createPurchaseOrder({
      requestId: approvedPr.id,
      userId: financeUser.id,
      userRole: financeUser.role,
      userDepartment: financeUser.department,
    });
    assert(false, "Should reject duplicate active PO");
  } catch (err: any) {
    assert(
      err.message.includes("already exists for this request"),
      "Prevents duplicate PO generation for same PR",
      err.message
    );
  }

  // -------------------------------------------------------------
  // TEST 5: Public Vendor Portal Access via Token
  // -------------------------------------------------------------
  console.log("\n--- Test 5: Public Vendor Portal Token Resolution ---");
  const portalData = await PurchaseOrderService.getPurchaseOrderByToken(rawToken, "127.0.0.1", "TestBrowser/1.0");
  assert(portalData.po.poNumber === po.poNumber, "Vendor portal correctly resolves PO by raw token");
  assert(portalData.vendor.companyName === testVendor.companyName, "Vendor portal includes vendor details");

  // Verify view event was recorded
  const events = await db
    .select()
    .from(purchaseOrderEvents)
    .where(eq(purchaseOrderEvents.poId, po.id));
  assert(events.some((e) => e.eventType === "VIEWED"), "Logs 'VIEWED' event in purchaseOrderEvents");

  // -------------------------------------------------------------
  // TEST 6: PDF Generation Engine Output
  // -------------------------------------------------------------
  console.log("\n--- Test 6: PDF Generator Engine ---");
  const fullPoWithRel = {
    ...po,
    vendor: testVendor,
    request: approvedPr,
    createdBy: financeUser,
  };

  const pdfBytes = await generatePurchaseOrderPdf(fullPoWithRel);
  assert(pdfBytes instanceof Uint8Array, "generatePurchaseOrderPdf outputs Uint8Array");
  assert(pdfBytes.length > 2000, `Generated robust PDF binary size: ${pdfBytes.length} bytes`);

  // Check PDF magic bytes (%PDF-)
  const magic = String.fromCharCode(...pdfBytes.slice(0, 5));
  assert(magic === "%PDF-", `PDF begins with magic header %PDF- (got: ${magic})`);

  // -------------------------------------------------------------
  // TEST 7: Vendor Acknowledgment Flow
  // -------------------------------------------------------------
  console.log("\n--- Test 7: Vendor Acknowledgment Flow ---");
  const ackPo = await PurchaseOrderService.acknowledgePurchaseOrder(
    rawToken,
    {
      acknowledgedBy: "Ahmed Al-Kuwari (Operations Director)",
      acknowledgmentNotes: "Order accepted. Delivery planned for next Tuesday.",
    },
    "127.0.0.1"
  );

  assert(ackPo.status === "acknowledged", "PO status transitioned to 'acknowledged'");
  assert(!!ackPo.acknowledgedAt, "Stamps acknowledgment timestamp");
  assert(ackPo.acknowledgedBy === "Ahmed Al-Kuwari (Operations Director)", "Stores acknowledgedBy representative");

  // -------------------------------------------------------------
  // TEST 8: PO Cancellation with Reason
  // -------------------------------------------------------------
  console.log("\n--- Test 8: PO Cancellation Protocol ---");
  const cancelledPo = await PurchaseOrderService.cancelPurchaseOrder(
    po.id,
    financeUser.id,
    financeUser.role,
    financeUser.department,
    "Vendor informed out of stock; re-sourcing."
  );

  assert(cancelledPo.status === "cancelled", "Status transitioned to 'cancelled'");
  assert(cancelledPo.tokenStatus === "revoked", "Public sharing token revoked on cancellation");
  assert(
    cancelledPo.cancellationReason === "Vendor informed out of stock; re-sourcing.",
    "Stores cancellation audit reason"
  );

  // Attempting to view cancelled PO via portal should fail
  try {
    await PurchaseOrderService.getPurchaseOrderByToken(rawToken);
    assert(false, "Should not allow portal viewing revoked token");
  } catch (err: any) {
    assert(
      err.message.includes("invalid or has been revoked"),
      "Rejects portal access once PO is cancelled and token revoked"
    );
  }

  console.log("\n=================================================================");
  console.log(`ALL TESTS PASSED! (${passedTests}/${totalTests})`);
  console.log("=================================================================\n");
}

runPurchaseOrderTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL ERROR IN TEST SUITE:", err);
    process.exit(1);
  });
