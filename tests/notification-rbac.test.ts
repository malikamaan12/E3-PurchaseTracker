import { NotificationService } from "../src/lib/services/NotificationService";
import type { AuthenticatedUser } from "../src/lib/auth-shared";

async function runNotificationRbacTests() {
  console.log("================================================================================");
  console.log("   NOTIFICATION ROLE-BASED ACCESS CONTROL (RBAC) TEST SUITE                    ");
  console.log("================================================================================\n");

  const service = NotificationService.getInstance();
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, testName: string) {
    totalCount++;
    if (condition) {
      console.log(`  [RBAC] ✓ PASS: ${testName}`);
      passedCount++;
    } else {
      console.error(`  [RBAC] ✗ FAIL: ${testName}`);
    }
  }

  // --- Test Set 1: isUserEligibleForNotification (Query-Time Policy Gate) ---

  const superAdminUser: AuthenticatedUser = {
    id: 1,
    username: "superadmin",
    role: "super_admin",
    department: "Executive",
  };

  const adminUser: AuthenticatedUser = {
    id: 2,
    username: "admin_user",
    role: "admin",
    department: "Operations",
  };

  const itApprover: AuthenticatedUser = {
    id: 3,
    username: "it_head",
    role: "approver",
    department: "IT",
  };

  const marketingApprover: AuthenticatedUser = {
    id: 4,
    username: "mkt_head",
    role: "approver",
    department: "Marketing",
  };

  const multiDeptApprover: AuthenticatedUser = {
    id: 5,
    username: "multi_approver",
    role: "approver",
    department: "Finance",
    assignedDepartments: [
      { department: "Logistics", role: "approver", status: "active" },
      { department: "HR", role: "user", status: "active" }, // user only in HR!
      { department: "Procurement", role: "approver", status: "frozen" }, // frozen!
    ],
  };

  const regularUser: AuthenticatedUser = {
    id: 6,
    username: "regular_emp",
    role: "user",
    department: "IT",
  };

  const supervisorUser: AuthenticatedUser = {
    id: 7,
    username: "supervisor_emp",
    role: "supervisor",
    department: "Marketing",
  };

  // Notification 1: IT Approval Required
  const itApprovalNotif = {
    id: 201,
    userId: 3,
    requestId: 100,
    type: "approval_required",
    title: "Action Required: PR IT-2026-001",
    message: "IT Purchase request requires approval",
    isRead: false,
    actionData: {
      roleRestrictions: ["approver", "admin", "super_admin"],
      departmentRestrictions: ["IT"],
    },
  };

  // Notification 2: Marketing Approval Required
  const mktApprovalNotif = {
    id: 202,
    userId: 4,
    requestId: 101,
    type: "approval_required",
    title: "Action Required: PR MKT-2026-001",
    message: "Marketing Purchase request requires approval",
    isRead: false,
    actionData: {
      roleRestrictions: ["approver", "admin", "super_admin"],
      departmentRestrictions: ["Marketing"],
    },
  };

  // Notification 3: Logistics Approval Required
  const logisticsApprovalNotif = {
    id: 203,
    userId: 5,
    requestId: 102,
    type: "approval_required",
    title: "Action Required: PR LOG-2026-001",
    message: "Logistics Purchase request requires approval",
    isRead: false,
    actionData: {
      roleRestrictions: ["approver", "admin", "super_admin"],
      departmentRestrictions: ["Logistics"],
    },
  };

  // Notification 4: HR Approval Required
  const hrApprovalNotif = {
    id: 204,
    userId: 5,
    requestId: 103,
    type: "approval_required",
    title: "Action Required: PR HR-2026-001",
    message: "HR Purchase request requires approval",
    isRead: false,
    actionData: {
      roleRestrictions: ["approver", "admin", "super_admin"],
      departmentRestrictions: ["HR"],
    },
  };

  // Notification 5: Procurement Approval Required (Frozen assignment)
  const procApprovalNotif = {
    id: 205,
    userId: 5,
    requestId: 104,
    type: "approval_required",
    title: "Action Required: PR PROC-2026-001",
    message: "Procurement Purchase request requires approval",
    isRead: false,
    actionData: {
      roleRestrictions: ["approver", "admin", "super_admin"],
      departmentRestrictions: ["Procurement"],
    },
  };

  // Notification 6: Requester Status Update
  const requesterStatusNotif = {
    id: 206,
    userId: 6,
    requestId: 100,
    type: "purchase_request_approved",
    title: "Request Approved",
    message: "Your request was approved",
    isRead: false,
    actionData: {},
  };

  // Tests for isUserEligibleForNotification
  assert(service.isUserEligibleForNotification(itApprovalNotif, superAdminUser), "Super Admin is eligible for IT approval notifications");
  assert(service.isUserEligibleForNotification(itApprovalNotif, adminUser), "Admin is eligible for IT approval notifications");
  assert(service.isUserEligibleForNotification(itApprovalNotif, itApprover), "IT Approver is eligible for IT approval notifications");
  assert(!service.isUserEligibleForNotification(itApprovalNotif, marketingApprover), "Marketing Approver is BLOCKED from IT approval notifications");
  assert(!service.isUserEligibleForNotification(itApprovalNotif, regularUser), "Regular employee is BLOCKED from IT approval notifications");
  assert(!service.isUserEligibleForNotification(itApprovalNotif, supervisorUser), "Supervisor is BLOCKED from IT approval notifications");

  assert(service.isUserEligibleForNotification(mktApprovalNotif, marketingApprover), "Marketing Approver is eligible for Marketing approval notifications");
  assert(!service.isUserEligibleForNotification(mktApprovalNotif, itApprover), "IT Approver is BLOCKED from Marketing approval notifications");

  // Multi-department tests
  assert(service.isUserEligibleForNotification(logisticsApprovalNotif, multiDeptApprover), "Multi-department approver with active approver role is eligible for Logistics");
  assert(!service.isUserEligibleForNotification(hrApprovalNotif, multiDeptApprover), "Multi-department approver with user-only role in HR is BLOCKED from HR approval");
  assert(!service.isUserEligibleForNotification(procApprovalNotif, multiDeptApprover), "Multi-department approver with frozen status in Procurement is BLOCKED from Procurement approval");

  // Requester status update tests
  assert(service.isUserEligibleForNotification(requesterStatusNotif, regularUser), "Regular user can receive status update for their own request");

  // --- Test Set 2: getAuthorizedApproverUserIds Database RBAC Resolver ---
  console.log("\n  --- Live Database RBAC Approver Resolution Tests ---");

  const itApproverIds = await service.getAuthorizedApproverUserIds({
    targetDepartments: ["IT"],
  });
  console.log(`  Resolved IT Approver IDs: [${itApproverIds.join(", ")}]`);
  assert(Array.isArray(itApproverIds), "getAuthorizedApproverUserIds returns array of IDs for IT");

  const mandatoryApproverIds = await service.getAuthorizedApproverUserIds({
    targetDepartments: ["Management", "Finance", "CEO Office"],
  });
  console.log(`  Resolved Mandatory Approver IDs: [${mandatoryApproverIds.join(", ")}]`);
  assert(mandatoryApproverIds.length > 0, "getAuthorizedApproverUserIds returns authorized approvers for mandatory departments");

  // Exclude user test
  if (mandatoryApproverIds.length > 0) {
    const excludeTestId = mandatoryApproverIds[0];
    const filteredIds = await service.getAuthorizedApproverUserIds({
      targetDepartments: ["Management", "Finance", "CEO Office"],
      excludeUserId: excludeTestId,
    });
    assert(!filteredIds.includes(excludeTestId), "getAuthorizedApproverUserIds excludes the acting/requester user ID");
  }

  console.log("\n================================================================================");
  console.log(`TEST SUITE RESULTS: ${passedCount} PASSED, ${totalCount - passedCount} FAILED`);
  console.log("================================================================================\n");

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runNotificationRbacTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
