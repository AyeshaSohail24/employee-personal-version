// One-time setup, not a route: creates ONE table on an existing database (whichever .env points
// at) using its exact CREATE TABLE statement from db/schema_employees.sql, so each table is defined
// in one place. Usage: node --env-file=.env server/scripts/createTableFromSchema.js [table]
// (defaults to email_placeholders). Only tables listed below can be created this way. Uses
// CREATE TABLE IF NOT EXISTS — safe to re-run, and it never touches any other table.
import { readFile } from "node:fs/promises";
import { pool } from "../db/pool.js";
import { assertRequiredEnv } from "../config.js";

const ALLOWED_TABLES = ["email_placeholders", "upcoming_candidates_seen", "department_aliases"];

async function main() {
  assertRequiredEnv();

  const table = process.argv[2] ?? "email_placeholders";
  if (!ALLOWED_TABLES.includes(table)) throw new Error(`Only these tables can be created here: ${ALLOWED_TABLES.join(", ")}.`);

  const schema = await readFile(new URL("../../db/schema_employees.sql", import.meta.url), "utf8");
  const match = schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS \`${table}\` \\([\\s\\S]*?\\) ENGINE=[^;]+;`));
  if (!match) throw new Error(`${table} CREATE TABLE statement not found in db/schema_employees.sql.`);

  const [[before]] = await pool.query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?", [table]);
  await pool.query(match[0]);
  console.log(before.n ? `${table} already existed — nothing changed.` : `Created table ${table}.`);

  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
