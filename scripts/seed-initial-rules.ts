import { db } from "../db/index";
import { vendorRuleDefinitions, vendorRulesetVersions } from "../db/schema";
import { eq } from "drizzle-orm";
import { VendorRuleEngineService } from "../src/lib/services/VendorRuleEngineService";

async function seedInitialRules() {
  console.log("Seeding initial vendor rules and Version 1 published ruleset...");

  // 1. Check if any rules exist
  const existingRules = await db.select().from(vendorRuleDefinitions);
  if (existingRules.length === 0) {
    console.log("No rules found. Creating default ruleset and publishing Version 1...");
    const ruleset = await VendorRuleEngineService.getActiveRuleset();
    console.log("✓ Created and published default ruleset:", ruleset.versionNumber);
  } else {
    console.log(`Found ${existingRules.length} existing rules.`);
  }

  const activeRuleset = await VendorRuleEngineService.getActiveRuleset();
  console.log("✓ Current active ruleset:", activeRuleset.versionNumber, "status:", activeRuleset.status);
}

seedInitialRules()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  });
