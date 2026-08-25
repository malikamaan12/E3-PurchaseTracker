import { describe, it } from "node:test";
import assert from "node:assert";
import { canApproveInDepartment, canActInDepartment, canCreateInDepartment, type AuthenticatedUser } from "../src/lib/auth-shared";
import { getRequestApprovalContext } from "../src/lib/utils/approval-helpers";
import { NotificationService } from "../src/lib/services/NotificationService";
import { POST } from "../src/app/api/requests/[id]/approvals/route";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { JWT_SECRET, TOKEN_COOKIE_NAME } from "../src/lib/utils/config";
import { db } from "../db";
import { purchaseRequests, approvals, users } from "../db/schema";
import { eq } from "drizzle-orm";

async function createAuthRequest(
  url: string,
  user: { id: number; email: string; role: string; department: string; username: string },
  body: any
): Promise<NextRequest> {
  const secretKey = new TextEncoder().encode(JWT_SECRET);
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    department: user.department,
    assignedDepartments: [],
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("2h")
    .sign(secretKey);

  const req = new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${TOKEN_COOKIE_NAME}=${token}`,
    },
    body: JSON.stringify(body),
  });
  return req;
}

describe("Departmental Approval RBAC & Cross-Department Security Test Suite", () => {
  // Test User Profiles
  const superAdminUser: AuthenticatedUser = {
    id: 43,
    username: "superadmin",
    role: "super_admin",
    department: "Super Admin",
    assignedDepartments: [],
    departmentAssignments: [],
  };

  const financeAdminUser: AuthenticatedUser = {
    id: 27,
    username: "Abdullah",
    role: "admin",
    department: "Finance",
    assignedDepartments: [],
    departmentAssignments: [],
  };

  const marketingAdminWithAssignments: AuthenticatedUser = {
    id: 22,
    username: "Ahmad Faraz",
    role: "admin",
    department: "Marketing",
    assignedDepartments: [
      { department: "Branding", role: "both", status: "active" },
      { department: "Production", role: "both", status: "active" },
    ],
    departmentAssignments: [
      { department: "Branding", role: "both", status: "active" },
      { department: "Production", role: "both", status: "active" },
    ],
  };

  const logisticsApproverUser: AuthenticatedUser = {
    id: 36,
    username: "Quasain",
    role: "approver",
    department: "Logistics",
    assignedDepartments: [
      { department: "Production", role: "both", status: "active" },
    ],
    departmentAssignments: [
      { department: "Production", role: "both", status: "active" },
    ],
  };

  const regularUser: AuthenticatedUser = {
    id: 24,
    username: "Amal",
    role: "user",
    department: "Production",
    assignedDepartments: [],
    departmentAssignments: [],
  };

  const supervisorUser: AuthenticatedUser = {
    id: 48,
    username: "Waqar Bhatti",
    role: "supervisor",
    department: "Site Operations",
    assignedDepartments: [],
    departmentAssignments: [],
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. canApproveInDepartment Security Boundaries
  // ─────────────────────────────────────────────────────────────────────────────
  it("Super Admin has universal cross-department approval authority", () => {
    assert.strictEqual(canApproveInDepartment(superAdminUser, "Finance"), true);
    assert.strictEqual(canApproveInDepartment(superAdminUser, "Logistics"), true);
    assert.strictEqual(canApproveInDepartment(superAdminUser, "Production"), true);
    assert.strictEqual(canApproveInDepartment(superAdminUser, "Management"), true);
    assert.strictEqual(canApproveInDepartment(superAdminUser, "CEO Office"), true);
  });

  it("Department Admin can ONLY approve for their primary department", () => {
    // Abdullah (Finance Admin)
    assert.strictEqual(canApproveInDepartment(financeAdminUser, "Finance"), true, "Finance Admin can approve Finance");
    assert.strictEqual(canApproveInDepartment(financeAdminUser, "finance"), true, "Case-insensitive match works");
    assert.strictEqual(canApproveInDepartment(financeAdminUser, "Logistics"), false, "Finance Admin CANNOT approve Logistics");
    assert.strictEqual(canApproveInDepartment(financeAdminUser, "Management"), false, "Finance Admin CANNOT approve Management");
    assert.strictEqual(canApproveInDepartment(financeAdminUser, "Production"), false, "Finance Admin CANNOT approve Production");
    assert.strictEqual(canApproveInDepartment(financeAdminUser, "CEO Office"), false, "Finance Admin CANNOT approve CEO Office");
  });

  it("Department Admin with active assigned departments can approve assigned departments but NOT unassigned ones", () => {
    // Ahmad Faraz (Marketing Admin with Branding & Production assignments)
    assert.strictEqual(canApproveInDepartment(marketingAdminWithAssignments, "Marketing"), true, "Primary dept approval allowed");
    assert.strictEqual(canApproveInDepartment(marketingAdminWithAssignments, "Branding"), true, "Assigned dept approval allowed");
    assert.strictEqual(canApproveInDepartment(marketingAdminWithAssignments, "Production"), true, "Assigned dept approval allowed");
    assert.strictEqual(canApproveInDepartment(marketingAdminWithAssignments, "Finance"), false, "Unassigned dept approval blocked");
    assert.strictEqual(canApproveInDepartment(marketingAdminWithAssignments, "Logistics"), false, "Unassigned dept approval blocked");
  });

  it("Department Approver can ONLY approve primary and assigned departments", () => {
    // Quasain (Logistics Approver with Production assignment)
    assert.strictEqual(canApproveInDepartment(logisticsApproverUser, "Logistics"), true, "Primary dept approval allowed");
    assert.strictEqual(canApproveInDepartment(logisticsApproverUser, "Production"), true, "Assigned dept approval allowed");
    assert.strictEqual(canApproveInDepartment(logisticsApproverUser, "Finance"), false, "Unassigned dept approval blocked");
    assert.strictEqual(canApproveInDepartment(logisticsApproverUser, "Management"), false, "Unassigned dept approval blocked");
  });

  it("Regular users and supervisors NEVER have approval power in any department", () => {
    assert.strictEqual(canApproveInDepartment(regularUser, "Production"), false);
    assert.strictEqual(canApproveInDepartment(regularUser, "Finance"), false);
    assert.strictEqual(canApproveInDepartment(supervisorUser, "Site Operations"), false);
    assert.strictEqual(canApproveInDepartment(supervisorUser, "Logistics"), false);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Notification Eligibility Scoping
  // ─────────────────────────────────────────────────────────────────────────────
  it("Notification eligibility restricts approval notifications strictly to authorized department approvers", () => {
    const notifService = NotificationService.getInstance();

    const logisticsApprovalNotif = {
      type: "approval_required",
      actionData: {
        departmentRestrictions: ["Logistics"],
        roleRestrictions: ["approver", "admin", "super_admin"]
      }
    };

    assert.strictEqual(
      notifService.isUserEligibleForNotification(logisticsApprovalNotif, superAdminUser),
      true,
      "Super admin is eligible for any department notification"
    );

    assert.strictEqual(
      notifService.isUserEligibleForNotification(logisticsApprovalNotif, logisticsApproverUser),
      true,
      "Logistics approver is eligible for Logistics approval notification"
    );

    assert.strictEqual(
      notifService.isUserEligibleForNotification(logisticsApprovalNotif, financeAdminUser),
      false,
      "Finance admin is NOT eligible for Logistics approval notification"
    );

    assert.strictEqual(
      notifService.isUserEligibleForNotification(logisticsApprovalNotif, regularUser),
      false,
      "Regular user is NOT eligible for approval notification"
    );

    assert.strictEqual(
      notifService.isUserEligibleForNotification(logisticsApprovalNotif, supervisorUser),
      false,
      "Supervisor is NOT eligible for approval notification"
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. API Endpoint Department Boundary Enforcement (POST /api/requests/[id]/approvals)
  // ─────────────────────────────────────────────────────────────────────────────
  it("API blocks Finance admin from approving Logistics slot", async () => {
    // Look up an existing PR with a pending Logistics or Management approval slot
    const [testPr] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.status, "pending")).limit(1);
    if (!testPr) {
      console.log("No pending PR in DB to test API call; skipping API integration test.");
      return;
    }

    const testApprovals = await db.select().from(approvals).where(eq(approvals.requestId, testPr.id));
    const nonFinanceSlot = testApprovals.find(a => a.department.toLowerCase() !== "finance");

    if (nonFinanceSlot) {
      const financeUserDb = await db.query.users.findFirst({ where: eq(users.username, "Abdullah") });
      if (financeUserDb) {
        const req = await createAuthRequest(
          `http://localhost:3000/api/requests/${testPr.id}/approvals`,
          financeUserDb,
          { status: "approved", approvalId: nonFinanceSlot.id }
        );
        const res = await POST(req, { params: Promise.resolve({ id: String(testPr.id) }) });
        assert.strictEqual(res.status, 403, "Finance admin must receive HTTP 403 when attempting to approve non-Finance slot");
        const body = await res.json();
        assert.ok(body.error.includes("No approval slot exists for your authorized department"), "Error message explains department mismatch");
      }
    }
  });

  it("Multi-department approver can select and approve assigned department slot", async () => {
    const ahmadFarazDb = await db.query.users.findFirst({ where: eq(users.username, "Ahmad Faraz") });
    if (!ahmadFarazDb) return;

    // Ahmad Faraz has primary: Marketing, assigned: Branding, Production
    assert.strictEqual(canApproveInDepartment(ahmadFarazDb as any, "Marketing"), true);
    assert.strictEqual(canApproveInDepartment(ahmadFarazDb as any, "Branding"), true);
    assert.strictEqual(canApproveInDepartment(ahmadFarazDb as any, "Production"), true);
    assert.strictEqual(canApproveInDepartment(ahmadFarazDb as any, "Finance"), false);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Request Approval Context Clarity Helper
  // ─────────────────────────────────────────────────────────────────────────────
  it("getRequestApprovalContext accurately differentiates my pending vs other pending vs signed off", () => {
    const sampleRequest = {
      id: 999,
      status: "pending",
      approvals: [
        { id: 1, department: "Finance", status: "pending" },
        { id: 2, department: "Management", status: "pending" }
      ]
    };

    // 1. Finance Admin perspective
    const financeCtx = getRequestApprovalContext(
      sampleRequest,
      financeAdminUser,
      false,
      (dept: string) => canApproveInDepartment(financeAdminUser, dept)
    );
    assert.strictEqual(financeCtx.isAwaitingMyAction, true);
    assert.deepStrictEqual(financeCtx.myPendingDepartments, ["Finance"]);
    assert.deepStrictEqual(financeCtx.otherPendingDepartments, ["Management"]);

    // 2. Marketing Admin perspective (unrelated department)
    const marketingCtx = getRequestApprovalContext(
      sampleRequest,
      marketingAdminWithAssignments,
      false,
      (dept: string) => canApproveInDepartment(marketingAdminWithAssignments, dept)
    );
    assert.strictEqual(marketingCtx.isAwaitingMyAction, false);
    assert.deepStrictEqual(marketingCtx.myPendingDepartments, []);
    assert.deepStrictEqual(marketingCtx.otherPendingDepartments, ["Finance", "Management"]);

    // 3. Super Admin perspective
    const superAdminCtx = getRequestApprovalContext(
      sampleRequest,
      superAdminUser,
      true,
      (dept: string) => canApproveInDepartment(superAdminUser, dept)
    );
    assert.strictEqual(superAdminCtx.isAwaitingMyAction, true);
    assert.deepStrictEqual(superAdminCtx.myPendingDepartments, ["Finance", "Management"]);
    assert.deepStrictEqual(superAdminCtx.otherPendingDepartments, []);

    // 4. Partially signed off request (Finance signed off, Management pending)
    const partiallySignedRequest = {
      id: 999,
      status: "partially_approved",
      approvals: [
        { id: 1, department: "Finance", status: "approved" },
        { id: 2, department: "Management", status: "pending" }
      ]
    };
    const financeSignedCtx = getRequestApprovalContext(
      partiallySignedRequest,
      financeAdminUser,
      false,
      (dept: string) => canApproveInDepartment(financeAdminUser, dept)
    );
    assert.strictEqual(financeSignedCtx.isAwaitingMyAction, false);
    assert.deepStrictEqual(financeSignedCtx.myApprovedDepartments, ["Finance"]);
    assert.deepStrictEqual(financeSignedCtx.otherPendingDepartments, ["Management"]);
  });
});
