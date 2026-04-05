import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

async function checkAdmin() {
  try {
    const adminUser = await db.select().from(users).where(eq(users.username, "admin")).limit(1);
    console.log("Admin user in DB:", JSON.stringify(adminUser, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("Error connecting to DB:", err);
    process.exit(1);
  }
}

checkAdmin();
