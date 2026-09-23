import "dotenv/config";
import fs from "fs";
import path from "path";
import { pool } from "./database";

async function migrate() {
  const input = process.argv[2] || "../database/nouri_schema.sql";
  const migrationPath = path.resolve(process.cwd(), input);
  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    await pool.query(sql);
    console.log(`Applied database schema: ${path.basename(migrationPath)}`);
  } finally {
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error("Database migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
