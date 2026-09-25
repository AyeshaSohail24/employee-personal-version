// One-time setup, not a route: creates the email_placeholders table on an existing database
// (whichever .env points at) using the exact CREATE TABLE statement from db/schema_employees.sql,
// so the table is defined in one place. Uses CREATE TABLE IF NOT EXISTS — safe to re-run, and it
// never touches any other table.
import { readFile } from "node:fs/promises";
import { pool } from "../db/pool.js";
import { assertRequiredEnv } from "../config.js";

async function main() {
  assertRequiredEnv();

  const schema = await readFile(new URL("../../db/schema_employees.sql", import.meta.url), "utf8");
  const match = schema.match(/CREATE TABLE IF NOT EXISTS `email_placeholders` \([\s\S]*?\) ENGINE=[^;]+;/);
  if (!match) throw new Error("email_placeholders CREATE TABLE statement not found in db/schema_employees.sql.");

  const [[before]] = await pool.query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'email_placeholders'");
  await pool.query(match[0]);
  console.log(before.n ? "email_placeholders already existed — nothing changed." : "Created table email_placeholders.");

  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
