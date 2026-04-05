import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../server/utils/config";

const testUser = {
  id: 1,
  username: "admin",
  email: "admin@example.com",
  department: "IT",
  role: "admin",
  contactNumber: "123-456-7890",
  isActive: true
};

const token = jwt.sign(testUser, JWT_SECRET);
console.log("Token:", token);
const decoded = jwt.verify(token, JWT_SECRET);
console.log("Decoded Token:", JSON.stringify(decoded, null, 2));
process.exit(0);
