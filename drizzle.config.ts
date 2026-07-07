import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "drizzle-kit";

/**
 * Purpose: Load a dotenv file for Drizzle CLI commands without adding another package.
 * Inputs: Absolute dotenv file path.
 * Output: None.
 * Side effects: Sets process.env keys that are not already present.
 * Failure behavior: Missing files are ignored so CI/Vercel env injection still works.
 */
function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/**
 * Purpose: Load project-local env files before Drizzle reads database credentials.
 * Inputs: Current working directory.
 * Output: None.
 * Side effects: Reads `.env.local` and `.env`.
 */
function loadLocalEnv(): void {
  const cwd = process.cwd();
  loadEnvFile(path.join(cwd, ".env.local"));
  loadEnvFile(path.join(cwd, ".env"));
}

loadLocalEnv();

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
