import { db } from "../db";
import { users } from "../db/schema";

async function listUsers() {
  try {
    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      role: users.role,
      department: users.department
    }).from(users);
    console.log("All Users:", JSON.stringify(allUsers, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("Error connecting to DB:", err);
    process.exit(1);
  }
}

listUsers();
