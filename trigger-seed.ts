import { seedDepartments } from "./server/seed/departments.js";

async function runSeed() {
  try {
    await seedDepartments();
    console.log("Seed process completed.");
  } catch (error) {
    console.error("Seed failed:", error);
  } finally {
    process.exit(0);
  }
}

runSeed();
