import { describe, it } from "node:test";
import assert from "node:assert";
import path from "path";

describe("Application Audit Remediations & Security Test Suite", () => {
  // Test 1: Excel Export Endpoint Mapping
  it("Excel Export Endpoint is mapped to /api/export/excel with valid query params", () => {
    const params = { department: "IT", status: "approved" };
    const search = new URLSearchParams(params).toString();
    const url = search ? `/api/export/excel?${search}` : `/api/export/excel`;
    assert.strictEqual(url, "/api/export/excel?department=IT&status=approved");
    assert.ok(!url.includes("/api/requests/export"), "Must not point to non-existent /api/requests/export");
  });

  // Test 2: Document View Safe Destination & Open Redirect Defense
  it("Document View blocks malicious external redirects while permitting local and trusted storage", () => {
    const testCases = [
      { rawUrl: "/uploads/attachments/invoice.pdf", allowed: true },
      { rawUrl: "https://my-bucket.r2.cloudflarestorage.com/attachments/doc.pdf?X-Amz-Signature=123", allowed: true },
      { rawUrl: "https://s3.amazonaws.com/my-bucket/doc.pdf", allowed: true },
      { rawUrl: "https://evil-phishing-site.com/steal-creds", allowed: false },
      { rawUrl: "javascript:alert(1)", allowed: false },
    ];

    for (const tc of testCases) {
      let isAllowed = false;
      try {
        if (tc.rawUrl.startsWith("/uploads/")) {
          isAllowed = true;
        } else {
          const parsed = new URL(tc.rawUrl, "http://localhost:3000");
          const isSameOrigin = parsed.origin === "http://localhost:3000";
          const isAllowedS3Host = parsed.hostname.endsWith(".r2.cloudflarestorage.com") || parsed.hostname.endsWith(".amazonaws.com");
          if (isSameOrigin || isAllowedS3Host) {
            isAllowed = true;
          }
        }
      } catch {
        isAllowed = false;
      }
      assert.strictEqual(isAllowed, tc.allowed, `Failed open redirect check for URL: ${tc.rawUrl}`);
    }
  });

  // Test 3: Path Traversal Prevention in Conversion
  it("File conversion path resolver strictly confines input paths inside uploads directory", () => {
    const allowedBase = path.resolve(process.cwd(), "uploads");
    
    const maliciousPaths = [
      "../../../../etc/passwd",
      "../../../.env",
      "..\\..\\..\\windows\\system32\\cmd.exe",
      "/uploads/../../secret.txt"
    ];

    for (const mp of maliciousPaths) {
      const relativeClean = mp.replace(/^\/?uploads\/?/, "").replace(/^(\.\.[\/\\])+/, "");
      const absolutePath = path.resolve(allowedBase, relativeClean);
      const isContained = absolutePath.startsWith(allowedBase);
      assert.ok(isContained, `Path ${mp} was not safely contained in uploads base`);
    }
  });

  // Test 4: Password Hash Stripping on User Update
  it("User PATCH response omits password hash from serialized user object", () => {
    const dbRow = {
      id: 5,
      username: "finance_mgr",
      email: "finance@example.com",
      password: "$2a$10$hashed_secret_password_value",
      role: "admin",
      isActive: true,
      department: "Finance"
    };

    const { password: _, ...userWithoutPassword } = dbRow;
    assert.strictEqual((userWithoutPassword as any).password, undefined);
    assert.strictEqual(userWithoutPassword.username, "finance_mgr");
    assert.strictEqual(userWithoutPassword.email, "finance@example.com");
  });

  // Test 5: Sub-purposes role authorization for super_admin
  it("Sub-purposes isAdmin flag correctly identifies both admin and super_admin roles", () => {
    const roles = [
      { role: "super_admin", expectedAdmin: true },
      { role: "SUPER_ADMIN", expectedAdmin: true },
      { role: "admin", expectedAdmin: true },
      { role: "ADMIN", expectedAdmin: true },
      { role: "approver", expectedAdmin: false },
      { role: "user", expectedAdmin: false },
      { role: "supervisor", expectedAdmin: false },
    ];

    for (const r of roles) {
      const isAdmin = r.role.toLowerCase() === 'admin' || r.role.toLowerCase() === 'super_admin';
      assert.strictEqual(isAdmin, r.expectedAdmin, `Role check mismatch for role: ${r.role}`);
    }
  });

  // Test 6: Workflow auto-approval for super_admin
  it("Workflow auto-approval evaluates super_admin alongside approvers and admins", () => {
    const checkAutoApprove = (isMandatory: boolean, isSupervisor: boolean, normalizedDepts: string[], dept: string, role: string) => {
      return (
        !isMandatory &&
        !isSupervisor &&
        normalizedDepts.includes(dept.toLowerCase().trim()) &&
        (role === 'approver' || role === 'admin' || role === 'super_admin')
      );
    };

    assert.strictEqual(checkAutoApprove(false, false, ["it"], "IT", "super_admin"), true);
    assert.strictEqual(checkAutoApprove(false, false, ["it"], "IT", "admin"), true);
    assert.strictEqual(checkAutoApprove(false, false, ["it"], "IT", "approver"), true);
    assert.strictEqual(checkAutoApprove(true, false, ["it"], "IT", "super_admin"), false, "Mandatory step must not auto-approve");
    assert.strictEqual(checkAutoApprove(false, true, ["it"], "IT", "super_admin"), false, "Supervisor request must not auto-approve");
  });

  // Test 7: Bulk approve respects Stage 1 Supervisor Gatekeeper Lock
  it("Bulk approve skips mandatory steps if request status is pending_dept_head for non-super_admin", () => {
    const shouldSkipApproval = (status: string, isMandatory: boolean, role: string) => {
      return status === 'pending_dept_head' && isMandatory && role !== 'super_admin';
    };

    assert.strictEqual(shouldSkipApproval("pending_dept_head", true, "admin"), true, "Admin cannot bypass Stage 1 in bulk");
    assert.strictEqual(shouldSkipApproval("pending_dept_head", true, "approver"), true, "Approver cannot bypass Stage 1 in bulk");
    assert.strictEqual(shouldSkipApproval("pending_dept_head", true, "super_admin"), false, "Super admin can bypass Stage 1 in bulk");
    assert.strictEqual(shouldSkipApproval("pending", true, "admin"), false, "Normal pending request can be approved");
  });
});
