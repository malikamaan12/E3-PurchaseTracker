import { db } from "@db";
import { departments } from "@db/schema";
import { sql } from "drizzle-orm";

const initialDepartments = [
  { name: "IT", isApprover: false },
  { name: "HR", isApprover: false },
  { name: "BRANDING", isApprover: false },
  { name: "MARKETING", isApprover: false },
  { name: "BUSINESS DEVELOPMENT", isApprover: false },
  { name: "CEO OFFICE", isApprover: true },
  { name: "GM", isApprover: true },
  { name: "ADMIN", isApprover: true },
  { name: "OPERATION", isApprover: false },
  { name: "LOGISTICS", isApprover: false }
];

export async function seedDepartments() {
  try {
    const existing = await db.select({ count: sql<number>`count(*)` }).from(departments);
    if (Number(existing[0].count) === 0) {
      console.log("[Seed] Seeding initial departments...");
      await db.insert(departments).values(initialDepartments);
      console.log("[Seed] Successfully seeded departments.");
    }
  } catch (error) {
    console.error("[Seed] Failed to seed departments:", error);
  }
}
