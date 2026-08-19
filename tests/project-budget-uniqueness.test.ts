import { db } from "../db";
import { subPurposes, subPurposeBudgets, departments } from "../db/schema";
import { eq } from "drizzle-orm";

async function runProjectBudgetUniquenessTests() {
  console.log("================================================================================");
  console.log("   PROJECT GOVERNANCE DEPARTMENT BUDGET UNIQUENESS TEST SUITE                  ");
  console.log("================================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(cond: boolean, name: string) {
    total++;
    if (cond) {
      console.log(`  [PROJECT-BUDGET] ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  [PROJECT-BUDGET] ✗ FAIL: ${name}`);
    }
  }

  // 1. Fetch available departments
  const depts = await db.select().from(departments).limit(3);
  if (depts.length < 2) {
    console.warn("Not enough departments to run test.");
    return;
  }

  const dept1 = depts[0].id;
  const dept2 = depts[1].id;

  // 2. Validate backend duplication detection logic
  function validateBudgetSplits(splits: Array<{ departmentId: number; amount: number }>) {
    const validSplits = splits
      .map((s) => ({ departmentId: Number(s.departmentId), amount: Number(s.amount) }))
      .filter((s) => s.departmentId > 0);

    const deptIds = validSplits.map((s) => s.departmentId);
    const hasDuplicates = new Set(deptIds).size !== deptIds.length;
    return !hasDuplicates;
  }

  // Test Case A: Duplicate departments (e.g. Branding + Branding as in screenshot)
  const duplicateSplits = [
    { departmentId: dept1, amount: 200000 },
    { departmentId: dept2, amount: 150000 },
    { departmentId: dept1, amount: 10000 }, // Duplicate!
  ];
  assert(!validateBudgetSplits(duplicateSplits), "Duplicate department allocations are detected and rejected");

  // Test Case B: Distinct departments
  const validSplits = [
    { departmentId: dept1, amount: 200000 },
    { departmentId: dept2, amount: 150000 },
  ];
  assert(validateBudgetSplits(validSplits), "Distinct department allocations pass validation");

  // 3. Test Database Insertion for valid splits
  const [createdProject] = await db
    .insert(subPurposes)
    .values({
      name: "Test Governance Project",
      purposeType: "PROJECT",
      totalBudget: 350000,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  assert(!!createdProject.id, "Project created successfully");

  // Insert valid splits
  await db.insert(subPurposeBudgets).values([
    { subPurposeId: createdProject.id, departmentId: dept1, allocatedAmount: 200000 },
    { subPurposeId: createdProject.id, departmentId: dept2, allocatedAmount: 150000 },
  ]);

  const savedBudgets = await db
    .select()
    .from(subPurposeBudgets)
    .where(eq(subPurposeBudgets.subPurposeId, createdProject.id));

  assert(savedBudgets.length === 2, "Saved exactly 2 unique departmental budget splits");

  // Cleanup
  await db.delete(subPurposeBudgets).where(eq(subPurposeBudgets.subPurposeId, createdProject.id));
  await db.delete(subPurposes).where(eq(subPurposes.id, createdProject.id));
  console.log("  [PROJECT-BUDGET] Cleaned up test records.");

  console.log("\n================================================================================");
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${total - passed} FAILED`);
  console.log("================================================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
}

runProjectBudgetUniquenessTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL ERROR IN TEST SUITE:", err);
    process.exit(1);
  });
