import { defineConfig } from "drizzle-kit";
import fs from "fs";
import path from "path";

if (!process.env.DATABASE_URL) {
  for (const file of [".env.local", ".env"]) {
    const p = path.resolve(process.cwd(), file);
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("DATABASE_URL=")) {
          let val = trimmed.slice("DATABASE_URL=".length).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          process.env.DATABASE_URL = val;
          break;
        }
      }
    }
    if (process.env.DATABASE_URL) break;
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
