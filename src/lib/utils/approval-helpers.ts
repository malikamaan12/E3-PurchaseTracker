/**
 * Department Approval Context Helper
 * Calculates whether a request is awaiting the current user's department sign-off,
 * which stages the user has already approved, and which stages are pending other departments.
 */

export interface RequestApprovalContext {
  isAwaitingMyAction: boolean;
  myPendingDepartments: string[];
  myApprovedDepartments: string[];
  otherPendingDepartments: string[];
  allPendingDepartments: string[];
  isFullyApproved: boolean;
  userRoleSummary: string;
}

export function getRequestApprovalContext(
  request: any,
  user: any,
  isSuperAdmin: boolean,
  canApproveInDepartment: (dept: string) => boolean
): RequestApprovalContext {
  if (!request) {
    return {
      isAwaitingMyAction: false,
      myPendingDepartments: [],
      myApprovedDepartments: [],
      otherPendingDepartments: [],
      allPendingDepartments: [],
      isFullyApproved: false,
      userRoleSummary: "",
    };
  }

  const rawStatus = (request.status || "").toLowerCase().trim();
  const isSupervisorGate = rawStatus === "pending_dept_head";
  const approvalsList: any[] = Array.isArray(request.approvals) ? request.approvals : [];

  const isFullyApproved =
    ["approved", "fully_paid"].includes(rawStatus) ||
    (approvalsList.length > 0 && approvalsList.every((a: any) => a.status === "approved"));

  // Check if request is actionable in the approval workflow
  const isActionable = ["pending", "partially_approved", "pending_dept_head", "variation_pending", "changes_requested"].includes(rawStatus);

  const myPendingDepartments: string[] = [];
  const myApprovedDepartments: string[] = [];
  const otherPendingDepartments: string[] = [];
  const allPendingDepartments: string[] = [];

  // Track approved departments for informational badges
  for (const app of approvalsList) {
    const deptName = app.department || "Department";
    const isMine = isSuperAdmin || canApproveInDepartment(deptName);
    if (app.status === "approved" && isMine && !myApprovedDepartments.includes(deptName)) {
      myApprovedDepartments.push(deptName);
    }
  }

  // If request is rejected, cancelled, draft, approved, or fully_paid,
  // it is NEVER awaiting any sign-off!
  if (!isActionable) {
    return {
      isAwaitingMyAction: false,
      myPendingDepartments: [],
      myApprovedDepartments,
      otherPendingDepartments: [],
      allPendingDepartments: [],
      isFullyApproved,
      userRoleSummary: isSuperAdmin ? "Super Admin" : user?.department || "",
    };
  }

  // 1. If in Stage 1 Supervisor Gate (pending_dept_head)
  if (isSupervisorGate) {
    const reqDept = request.department || "Submitting Department";
    allPendingDepartments.push(reqDept);
    if (isSuperAdmin || canApproveInDepartment(reqDept)) {
      myPendingDepartments.push(reqDept);
    } else {
      otherPendingDepartments.push(reqDept);
    }
  } else {
    // 2. Regular approvals evaluation
    for (const app of approvalsList) {
      const deptName = app.department || "Department";
      const isMine = isSuperAdmin || canApproveInDepartment(deptName);

      if (app.status === "pending" || app.status === "changes_requested") {
        allPendingDepartments.push(deptName);
        if (isMine) {
          if (!myPendingDepartments.includes(deptName)) {
            myPendingDepartments.push(deptName);
          }
        } else {
          if (!otherPendingDepartments.includes(deptName)) {
            otherPendingDepartments.push(deptName);
          }
        }
      }
    }
  }

  const isAwaitingMyAction = !isFullyApproved && myPendingDepartments.length > 0;

  return {
    isAwaitingMyAction,
    myPendingDepartments,
    myApprovedDepartments,
    otherPendingDepartments,
    allPendingDepartments,
    isFullyApproved,
    userRoleSummary: isSuperAdmin ? "Super Admin" : user?.department || "",
  };
}
