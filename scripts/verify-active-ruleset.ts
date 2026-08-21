import { db } from "../db/index";
import { sql } from "drizzle-orm";
import { activeVendorRuleset, vendorRulesetVersions } from "../db/schema";
import { eq } from "drizzle-orm";

async function verifyActiveRuleset() {
  const [activePointer] = await db.select().from(activeVendorRuleset).limit(1);
  console.log("active_vendor_ruleset pointer:", activePointer);

  if (activePointer) {
    const [version] = await db
      .select()
      .from(vendorRulesetVersions)
      .where(eq(vendorRulesetVersions.id, activePointer.rulesetVersionId));
    console.log("Active Ruleset Version Details:", version);
  }
}

verifyActiveRuleset()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
