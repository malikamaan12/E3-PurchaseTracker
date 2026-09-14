import { db } from "../db";
import { users, vendors, purchaseRequests, purchaseOrders } from "../db/schema";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { JWT_SECRET, TOKEN_COOKIE_NAME } from "../src/lib/utils/config";

import { GET as getRequestPo, POST as postRequestPo } from "../src/app/api/requests/[id]/po/route";
import { GET as getPoById, PATCH as patchPoById } from "../src/app/api/po/[id]/route";
import { GET as getPoPdf } from "../src/app/api/po/[id]/pdf/route";
import { POST as postShareLink } from "../src/app/api/po/[id]/share-link/route";
import { GET as getPortalPo } from "../src/app/api/portal/po/[token]/route";
import { GET as getPortalPdf } from "../src/app/api/portal/po/[token]/pdf/route";
import { POST as postPortalAcknowledge } from "../src/app/api/portal/po/[token]/acknowledge/route";

async function createAuthRequest(
  url: string,
  user: { id: number; email: string; role: string; department: string },
  body?: any,
  method: string = "GET"
): Promise<NextRequest> {
  const secretKey = new TextEncoder().encode(JWT_SECRET);
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    role: user.role,
    department: user.department,
    assignedDepartments: [],
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("2h")
    .sign(secretKey);

  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: `${TOKEN_COOKIE_NAME}=${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function createPublicRequest(url: string, body?: any, method: string = "GET"): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function runApiE2eTests() {
  console.log("=================================================================");
  console.log("RUNNING SUITE: Purchase Order API Endpoints Integration Tests");
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

  const timestamp = Date.now();

  // 1. Create Finance User
  const [financeUser] = await db
    .insert(users)
    .values({
      username: `finance_api_${timestamp}`,
      password: "password_hash",
      email: `fin_api_${timestamp}@e3.qa`,
      contact_number: "+97455554444",
      department: "Finance",
      role: "user",
    })
    .returning();

  // 2. Create Vendor
  const [vendor] = await db
    .insert(vendors)
    .values({
      companyName: `Global Tech Supplies ${timestamp} WLL`,
      contactPerson: "Tariq Mansour",
      contactNumber: "+97444889900",
      email: `tariq_${timestamp}@globaltech.qa`,
      address: "Al Sadd Commercial Complex, Doha, Qatar",
      taxNumber: "9876543210",
      registrationNumber: "CR-112233",
    })
    .returning();

  // 3. Create Approved Purchase Request
  const [approvedPr] = await db
    .insert(purchaseRequests)
    .values({
      requestNumber: `PR-API-${timestamp}`,
      requesterId: financeUser.id,
      vendorId: vendor.id,
      title: "Enterprise Core Switch Upgrade",
      description: "Fiber optics and core distribution switches",
      department: "Finance",
      status: "approved",
      items: [
        { name: "Cisco Catalyst 9500 48-port", quantity: 2, estimatedCost: 24000, description: "Layer 3 Switch" },
        { name: "10G SFP+ Transceivers (10-pack)", quantity: 4, estimatedCost: 3500, description: "Single-mode LC" },
      ],
      currency: "QAR",
      totalEstimatedCost: 62000,
      freightAmount: 800,
      paymentStructure: "POST_PROJECT",
    })
    .returning();

  // -------------------------------------------------------------
  // TEST 1: GET /api/requests/[id]/po (Before creation: exists = false, canCreate = true)
  // -------------------------------------------------------------
  console.log("--- Test 1: GET /api/requests/[id]/po (pre-creation) ---");
  const req1 = await createAuthRequest(`/api/requests/${approvedPr.id}/po`, financeUser);
  const res1 = await getRequestPo(req1, { params: Promise.resolve({ id: String(approvedPr.id) }) });
  const json1 = await res1.json();

  assert(res1.status === 200, "HTTP 200 OK returned");
  assert(json1.exists === false, "exists === false before PO generation");
  assert(json1.canCreate === true, "canCreate === true for Finance user on approved PR");

  // -------------------------------------------------------------
  // TEST 2: POST /api/requests/[id]/po (Generate PO)
  // -------------------------------------------------------------
  console.log("\n--- Test 2: POST /api/requests/[id]/po (generate PO) ---");
  const poPayload = {
    expectedDeliveryDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    deliveryAddress: "E3 Core Network Site 1, Doha, Qatar",
    billingAddress: "E3 Management Solutions W.L.L, Doha, Qatar",
    specialInstructions: "Handle optical modules with ESD protection.",
    termsAndConditions: "Standard 30 days net following receipt inspection.",
    status: "issued",
  };

  const req2 = await createAuthRequest(`/api/requests/${approvedPr.id}/po`, financeUser, poPayload, "POST");
  const res2 = await postRequestPo(req2, { params: Promise.resolve({ id: String(approvedPr.id) }) });
  const json2 = await res2.json();

  assert(res2.status === 200, "HTTP 200 OK returned on PO creation");
  assert(json2.success === true, "PO created successfully");
  assert(json2.purchaseOrder.poNumber.startsWith("PO-"), `Assigned valid PO number: ${json2.purchaseOrder.poNumber}`);
  assert(Number(json2.purchaseOrder.totalAmount) === 62800, `Total matches PR total + freight (62,800 QAR)`);
  assert(!!json2.rawToken, "Returns raw token for client link sharing");

  const createdPo = json2.purchaseOrder;
  const rawToken = json2.rawToken;

  // -------------------------------------------------------------
  // TEST 3: GET /api/po/[id] (Fetch PO details)
  // -------------------------------------------------------------
  console.log("\n--- Test 3: GET /api/po/[id] ---");
  const req3 = await createAuthRequest(`/api/po/${createdPo.id}`, financeUser);
  const res3 = await getPoById(req3, { params: Promise.resolve({ id: String(createdPo.id) }) });
  const json3 = await res3.json();

  assert(res3.status === 200, "HTTP 200 OK returned");
  assert(json3.purchaseOrder.id === createdPo.id, "Correct PO retrieved");
  assert(json3.purchaseOrder.vendor.companyName === vendor.companyName, "Includes vendor relationship");

  // -------------------------------------------------------------
  // TEST 4: GET /api/po/[id]/pdf (Stream PDF binary)
  // -------------------------------------------------------------
  console.log("\n--- Test 4: GET /api/po/[id]/pdf ---");
  const req4 = await createAuthRequest(`/api/po/${createdPo.id}/pdf`, financeUser);
  const res4 = await getPoPdf(req4, { params: Promise.resolve({ id: String(createdPo.id) }) });

  assert(res4.status === 200, "HTTP 200 OK returned");
  assert(res4.headers.get("Content-Type") === "application/pdf", "Content-Type is application/pdf");
  const pdfArrayBuffer = await res4.arrayBuffer();
  const pdfBytes = new Uint8Array(pdfArrayBuffer);
  const magic = String.fromCharCode(...pdfBytes.slice(0, 5));
  assert(magic === "%PDF-", "PDF stream valid with %PDF- header");

  // -------------------------------------------------------------
  // TEST 5: POST /api/po/[id]/share-link (Regenerate token)
  // -------------------------------------------------------------
  console.log("\n--- Test 5: POST /api/po/[id]/share-link ---");
  const req5 = await createAuthRequest(`/api/po/${createdPo.id}/share-link`, financeUser, {}, "POST");
  const res5 = await postShareLink(req5, { params: Promise.resolve({ id: String(createdPo.id) }) });
  const json5 = await res5.json();

  assert(res5.status === 200, "HTTP 200 OK returned");
  assert(!!json5.rawToken && json5.rawToken.length === 64, "Generated fresh 64-char hex token");
  assert(json5.shareUrl.includes(`/portal/po/${json5.rawToken}`), "Share URL contains raw token");

  const freshRawToken = json5.rawToken;

  // -------------------------------------------------------------
  // TEST 6: GET /api/portal/po/[token] (Public Vendor Portal)
  // -------------------------------------------------------------
  console.log("\n--- Test 6: GET /api/portal/po/[token] (Public) ---");
  const req6 = createPublicRequest(`/api/portal/po/${freshRawToken}`);
  const res6 = await getPortalPo(req6, { params: Promise.resolve({ token: freshRawToken }) });
  const json6 = await res6.json();

  assert(res6.status === 200, "HTTP 200 OK returned without authentication cookie");
  assert(json6.success === true, "Vendor data retrieved successfully");
  assert(json6.data.poNumber === createdPo.poNumber, "Correct PO Number displayed");
  assert(json6.data.vendor.companyName === vendor.companyName, "Vendor details visible");
  assert(json6.data.itemsSnapshot.length === 2, "Items snapshot visible to vendor");

  // -------------------------------------------------------------
  // TEST 7: GET /api/portal/po/[token]/pdf (Public Vendor PDF download)
  // -------------------------------------------------------------
  console.log("\n--- Test 7: GET /api/portal/po/[token]/pdf (Public PDF) ---");
  const req7 = createPublicRequest(`/api/portal/po/${freshRawToken}/pdf`);
  const res7 = await getPortalPdf(req7, { params: Promise.resolve({ token: freshRawToken }) });

  assert(res7.status === 200, "HTTP 200 OK returned for vendor PDF download");
  assert(res7.headers.get("Content-Type") === "application/pdf", "Content-Type is application/pdf");
  const vendorPdfBuf = await res7.arrayBuffer();
  assert(vendorPdfBuf.byteLength > 2000, `Vendor PDF size is ${vendorPdfBuf.byteLength} bytes`);

  // -------------------------------------------------------------
  // TEST 8: POST /api/portal/po/[token]/acknowledge (Vendor Acknowledgment)
  // -------------------------------------------------------------
  console.log("\n--- Test 8: POST /api/portal/po/[token]/acknowledge ---");
  const ackPayload = {
    acknowledgedBy: "Tariq Mansour (Managing Director)",
    acknowledgmentNotes: "Order accepted. Shipment scheduled via Qatar Airways Cargo.",
  };

  const req8 = createPublicRequest(`/api/portal/po/${freshRawToken}/acknowledge`, ackPayload, "POST");
  const res8 = await postPortalAcknowledge(req8, { params: Promise.resolve({ token: freshRawToken }) });
  const json8 = await res8.json();

  assert(res8.status === 200, "HTTP 200 OK returned on vendor confirmation");
  assert(json8.status === "acknowledged", "PO status changed to 'acknowledged'");
  assert(json8.acknowledgedBy === ackPayload.acknowledgedBy, "Representative name stamped");
  assert(!!json8.acknowledgedAt, "Timestamp recorded");

  console.log("\n=================================================================");
  console.log(`ALL API E2E TESTS PASSED! (${passedTests}/${totalTests})`);
  console.log("=================================================================\n");
}

runApiE2eTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("API E2E TEST FAILURE:", err);
    process.exit(1);
  });
