import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
if (!url) throw new Error("TURSO_DATABASE_URL is required.");
if (!url.startsWith("file:") && !authToken) throw new Error("TURSO_AUTH_TOKEN is required for a remote database.");

const client = createClient({ url, authToken: authToken || undefined });
const directory = join(process.cwd(), "prisma", "turso");
const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();

await client.execute(`CREATE TABLE IF NOT EXISTS "DemoMigration" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "checksum" TEXT NOT NULL,
  "appliedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);

for (const file of files) {
  const sql = await readFile(join(directory, file), "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  const existing = await client.execute({ sql: `SELECT checksum FROM "DemoMigration" WHERE id = ?`, args: [file] });
  if (existing.rows.length > 0) {
    if (existing.rows[0].checksum !== checksum) throw new Error(`Migration checksum changed: ${file}`);
    console.log(`Already applied: ${file}`);
    continue;
  }
  const safeFile = file.replaceAll("'", "''");
  await client.executeMultiple(`BEGIN;\n${sql}\nINSERT INTO "DemoMigration" (id, checksum) VALUES ('${safeFile}', '${checksum}');\nCOMMIT;`);
  console.log(`Applied: ${file}`);
}

client.close();
