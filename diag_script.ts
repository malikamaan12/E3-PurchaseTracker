import { db } from "./src/db";
import { users, subPurposes } from "./src/db/schema";
import fs from "fs";

async function diag() {
  const allUsers = await db.select({ username: users.username, role: users.role, department: users.department }).from(users);
  const allSubs = await db.select().from(subPurposes);
  
  const report = {
    users: allUsers,
    subPurposes: allSubs.length,
    subPurposesSample: allSubs.slice(0, 5)
  };
  
  fs.writeFileSync("diag_report.json", JSON.stringify(report, null, 2));
  console.log("Report generated at diag_report.json");
}

diag().catch(e => {
  fs.writeFileSync("diag_error.txt", e.stack || e.toString());
  console.error(e);
});
