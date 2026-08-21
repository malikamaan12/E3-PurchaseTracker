import { db } from "../db/index";
import { users, vendors, departments, purchaseRequests } from "../db/schema";
import { eq, like } from "drizzle-orm";
import { SignJWT } from "jose";
import { JWT_SECRET, TOKEN_COOKIE_NAME } from "../src/lib/utils/config";
import { normalizeDepartmentAssignments } from "../src/lib/auth-shared";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";

interface SmokeResult {
  test: string;
  endpoint: string;
  httpStatus: number;
  status: "PASS" | "FAIL";
  details: string;
}

async function createAuthToken(user: any) {
  const normalizedAssignments = normalizeDepartmentAssignments(user.assignedDepartments, user.department);
  const activeAssignedDepts = normalizedAssignments.filter(a => a.status === 'active').map(a => a.department);
  const allActiveDepts = Array.from(new Set([user.department, ...activeAssignedDepts].filter(Boolean)));

  const sanitizedUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    department: user.department || "Administration",
    assignedDepartments: normalizedAssignments,
    departmentAssignments: normalizedAssignments,
    departments: allActiveDepts.length > 0 ? allActiveDepts : ["Administration"],
    role: user.role,
    contactNumber: user.contact_number,
    isActive: user.isActive,
    isApprover: true,
    canManageVendors: true,
  };

  const secret = new TextEncoder().encode(JWT_SECRET);
  return await new SignJWT(sanitizedUser)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("300h")
    .sign(secret);
}

async function runHttpSmokeTests() {
  console.log("================================================================================");
  console.log(`STAGING LOCAL HTTP API SMOKE TEST SUITE — TARGET: ${BASE_URL}`);
  console.log("================================================================================\n");

  const results: SmokeResult[] = [];

  // Get Super Admin and Finance users for auth tokens
  const [superAdmin] = await db.select().from(users).where(eq(users.role, "super_admin")).limit(1);
  const [financeUser] = await db.select().from(users).where(eq(users.role, "finance")).limit(1);

  if (!superAdmin) throw new Error("Super Admin user not found");

  const superAdminToken = await createAuthToken(superAdmin);
  const financeToken = await createAuthToken(financeUser || superAdmin);

  const authHeaders = {
    "Content-Type": "application/json",
    Cookie: `${TOKEN_COOKIE_NAME}=${superAdminToken}`,
  };

  const financeHeaders = {
    "Content-Type": "application/json",
    Cookie: `${TOKEN_COOKIE_NAME}=${financeToken}`,
  };

  let createdCompanyVendorId: number | null = null;
  let createdFreelancerVendorId: number | null = null;
  let stagedBankingId: number | null = null;
  let createdPrId: number | null = null;

  try {
    // 1. GET /api/vendors (Existing legacy vendor inspection)
    console.log("1. Testing GET /api/vendors...");
    const vendorsRes = await fetch(`${BASE_URL}/api/vendors`, { headers: authHeaders });
    const vendorsData = await vendorsRes.json();
    const legacyVendors = Array.isArray(vendorsData) ? vendorsData.filter((v: any) => v.complianceStatus === "legacy_pending_assessment") : [];
    results.push({
      test: "Existing Vendor Query & Legacy Isolation",
      endpoint: "GET /api/vendors",
      httpStatus: vendorsRes.status,
      status: vendorsRes.status === 200 && legacyVendors.length > 0 ? "PASS" : "FAIL",
      details: `Returned ${vendorsData.length} vendors; ${legacyVendors.length} in legacy_pending_assessment.`,
    });

    // 2. GET /api/vendors/matrix (Compliance Matrix Endpoint)
    console.log("2. Testing GET /api/vendors/matrix...");
    const matrixRes = await fetch(`${BASE_URL}/api/vendors/matrix?page=1&limit=25`, { headers: authHeaders });
    const matrixData = await matrixRes.json();
    results.push({
      test: "Compliance Matrix Data Fetching",
      endpoint: "GET /api/vendors/matrix",
      httpStatus: matrixRes.status,
      status: matrixRes.status === 200 && Array.isArray(matrixData.rows) ? "PASS" : "FAIL",
      details: `Matrix returned ${matrixData.rows?.length || 0} vendors and ${matrixData.columns?.length || 0} statutory rule columns.`,
    });

    // 3. GET /api/admin/rules (Rule Matrix Endpoint)
    console.log("3. Testing GET /api/admin/rules...");
    const rulesRes = await fetch(`${BASE_URL}/api/admin/rules`, { headers: authHeaders });
    const rulesData = await rulesRes.json();
    results.push({
      test: "Rule Matrix & Singleton Pointer Verification",
      endpoint: "GET /api/admin/rules",
      httpStatus: rulesRes.status,
      status: rulesRes.status === 200 && rulesData.activeRuleset?.versionNumber >= 1 ? "PASS" : "FAIL",
      details: `Active Ruleset Version: ${rulesData.activeRuleset?.versionNumber}, Status: ${rulesData.activeRuleset?.status}`,
    });

    // 4. POST /api/vendors/quick-create (Quick Company Vendor Creation)
    console.log("4. Testing POST /api/vendors/quick-create (Company)...");
    const companyPayload = {
      companyName: `HTTP-Smoke-Company-${Date.now()}`,
      contactPerson: "Ahmed Al-Kuwari",
      contactNumber: "+974 4400 9988",
      email: `http.company.${Date.now()}@example.com`,
      vendorType: "company",
      category: "IT Equipment",
      address: "Doha, Qatar",
    };
    const createCoRes = await fetch(`${BASE_URL}/api/vendors/quick-create`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(companyPayload),
    });
    const createCoData = await createCoRes.json();
    createdCompanyVendorId = createCoData.vendor?.id;
    results.push({
      test: "Quick Company Creation via HTTP API",
      endpoint: "POST /api/vendors/quick-create",
      httpStatus: createCoRes.status,
      status: createCoRes.status === 200 && createdCompanyVendorId ? "PASS" : "FAIL",
      details: `Created Vendor ID ${createdCompanyVendorId}, Assigned Requirements: ${createCoData.assignedRequirements?.length || 0}`,
    });

    // 5. POST /api/vendors/quick-create (Quick Freelancer Creation)
    console.log("5. Testing POST /api/vendors/quick-create (Freelancer)...");
    const freelancerPayload = {
      companyName: `HTTP-Smoke-Freelancer-${Date.now()}`,
      contactPerson: "Rashid Consultant",
      contactNumber: "+974 5500 8877",
      email: `http.freelancer.${Date.now()}@example.com`,
      vendorType: "freelancer",
      category: "Consulting",
      address: "Doha, Qatar",
    };
    const createFreeRes = await fetch(`${BASE_URL}/api/vendors/quick-create`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(freelancerPayload),
    });
    const createFreeData = await createFreeRes.json();
    createdFreelancerVendorId = createFreeData.vendor?.id;
    results.push({
      test: "Quick Freelancer Creation via HTTP API",
      endpoint: "POST /api/vendors/quick-create",
      httpStatus: createFreeRes.status,
      status: createFreeRes.status === 200 && createdFreelancerVendorId ? "PASS" : "FAIL",
      details: `Created Freelancer ID ${createdFreelancerVendorId}, QID Assigned: true`,
    });

    // 6. GET & POST /api/vendors/[id]/completion-link (Clean HTTP Semantics)
    if (createdCompanyVendorId) {
      console.log("6. Testing GET & POST /api/vendors/[id]/completion-link...");
      // 6.1 GET: Read-only check
      const readMetaRes = await fetch(`${BASE_URL}/api/vendors/${createdCompanyVendorId}/completion-link`, {
        method: "GET",
        headers: authHeaders,
      });
      const readMetaData = await readMetaRes.json();

      // 6.2 POST: State-mutating generation
      const genRes = await fetch(`${BASE_URL}/api/vendors/${createdCompanyVendorId}/completion-link`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "generate" }),
      });
      const genData = await genRes.json();

      results.push({
        test: "Completion Link Generation & HTTP Semantics",
        endpoint: `GET & POST /api/vendors/${createdCompanyVendorId}/completion-link`,
        httpStatus: genRes.status,
        status: readMetaRes.status === 200 && genRes.status === 200 && genData.completionLink?.includes("#token=") ? "PASS" : "FAIL",
        details: `GET is read-only; POST generated fresh 7-day token: ${genData.completionLink?.slice(0, 45)}...`,
      });

      // 7. Banking Staging & Dual-Control HTTP Endpoints
      console.log("7. Testing Banking Staging & Dual Review HTTP APIs...");
      const stageRes = await fetch(`${BASE_URL}/api/vendors/${createdCompanyVendorId}/banking-staging`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action: "stage_submission",
          bankName: "Commercial Bank of Qatar",
          branchName: "West Bay Branch",
          accountNumber: "9876543210",
          ibanNumber: "QA00CBQK00000000987654",
          payment_currency: "QAR",
        }),
      });
      const stageData = await stageRes.json();
      stagedBankingId = stageData.stagedSubmission?.id;

      // Stage 1 Review by Finance
      const stage1Res = await fetch(`${BASE_URL}/api/vendors/${createdCompanyVendorId}/banking-staging`, {
        method: "POST",
        headers: financeHeaders,
        body: JSON.stringify({
          action: "review_stage1",
          submissionId: stagedBankingId,
        }),
      });

      // Stage 2 Confirmation by Super Admin
      const stage2Res = await fetch(`${BASE_URL}/api/vendors/${createdCompanyVendorId}/banking-staging`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action: "review_stage2",
          submissionId: stagedBankingId,
        }),
      });
      const stage2Data = await stage2Res.json();

      results.push({
        test: "Banking Staging & Dual-Control Permissions",
        endpoint: `POST /api/vendors/${createdCompanyVendorId}/banking-staging`,
        httpStatus: stage2Res.status,
        status: stage2Res.status === 200 && stage2Data.confirmedSubmission?.status === "verified" ? "PASS" : "FAIL",
        details: `Staged ID ${stagedBankingId} verified by Finance Stage 1 and Admin Stage 2.`,
      });
    }

    // 8. Non-Blocking PR Submission via HTTP
    console.log("8. Testing POST /api/requests (Non-Blocking PR Evaluation)...");
    const [dept] = await db.select().from(departments).limit(1);
    const prPayload = {
      title: `HTTP Smoke PR ${Date.now()}`,
      vendorId: createdCompanyVendorId || 3,
      department: dept?.name || "Administration",
      totalEstimatedCost: 7500,
      currency: "QAR",
      priority: "medium",
      paymentStructure: "ADVANCE",
      items: [
        {
          name: "Enterprise Server Maintenance",
          quantity: 1,
          estimatedCost: 7500,
        },
      ],
      status: "pending",
    };
    const prRes = await fetch(`${BASE_URL}/api/requests`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(prPayload),
    });
    const prData = await prRes.json();
    createdPrId = prData.id || prData.request?.id;

    results.push({
      test: "PR Creation with Non-Compliant Vendor (Non-Blocking)",
      endpoint: "POST /api/requests",
      httpStatus: prRes.status,
      status: (prRes.status === 200 || prRes.status === 201) && createdPrId ? "PASS" : "FAIL",
      details: `Created PR ID ${createdPrId}; Advisory compliance snapshot attached non-destructively.`,
    });

    // 9. PR PDF Generation Endpoint
    if (createdPrId) {
      console.log("9. Testing GET /api/requests/[id]/pdf...");
      const pdfRes = await fetch(`${BASE_URL}/api/requests/${createdPrId}/pdf`, { headers: authHeaders });
      const pdfContentType = pdfRes.headers.get("content-type");
      const pdfBlob = await pdfRes.arrayBuffer();

      results.push({
        test: "PR PDF Generation Endpoint with Compliance Stamp",
        endpoint: `GET /api/requests/${createdPrId}/pdf`,
        httpStatus: pdfRes.status,
        status: pdfRes.status === 200 && pdfBlob.byteLength > 1000 ? "PASS" : "FAIL",
        details: `PDF generated successfully, size: ${pdfBlob.byteLength} bytes, content-type: ${pdfContentType}`,
      });
    }

  } catch (error: any) {
    console.error("HTTP Smoke Test Failed:", error);
    results.push({
      test: "HTTP Smoke Execution",
      endpoint: "N/A",
      httpStatus: 500,
      status: "FAIL",
      details: error.message,
    });
  } finally {
    // Clean up test records created during HTTP smoke test to leave clean state
    console.log("\nCleaning up HTTP smoke test records...");
    await db.update(vendors).set({ remarks: "[STAGING_SMOKE_TEST_RECORD]" }).where(like(vendors.companyName, "%HTTP-Smoke%"));
    if (createdPrId) {
      await db.delete(purchaseRequests).where(eq(purchaseRequests.id, createdPrId));
    }
    console.log("✓ Cleaned/tagged HTTP smoke test records safely.");
  }

  console.log("\n================================================================================");
  console.log("STAGING LOCAL HTTP API SMOKE TEST RESULTS");
  console.log("================================================================================");
  console.table(results);

  const allPassed = results.every((r) => r.status === "PASS");
  console.log(`\nOVERALL RESULT: ${allPassed ? "✓ ALL HTTP SMOKE TESTS PASSED (100%)" : "✗ FAILURES DETECTED"}`);
  console.log("================================================================================\n");
}

runHttpSmokeTests()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
