// One-time data repair, not a route: createEmployee() (server/db/employees.js) and the
// intern-sync/applicant-conversion flows that call it never persisted contract_end_date
// until this fix — so every intern-linked employee created before that fix has
// contract_end_date = NULL locally, even though the Interns DB (the source of truth)
// already has their real internship_end_date. This re-derives the missing value from
// there rather than fabricating one. Safe to re-run: only ever touches rows that are
// still NULL, so it converges and becomes a no-op once everything is backfilled.
import { pool } from "../db/pool.js";
import { updateEmployee } from "../db/employees.js";
import { internsClient } from "../clients/internsClient.js";
import { assertRequiredEnv } from "../config.js";

async function main() {
  assertRequiredEnv();

  const [rows] = await pool.query(
    "SELECT id, employee_code, full_name, intern_external_id FROM employees WHERE intern_external_id IS NOT NULL AND contract_end_date IS NULL",
  );

  console.log(`Found ${rows.length} intern-linked employee(s) with a missing contract end date.`);

  let updated = 0;
  let noSourceDate = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const intern = await internsClient.getIntern(row.intern_external_id);
      if (!intern?.internship_end_date) {
        console.log(`  SKIP  ${row.employee_code} (${row.full_name}) — Interns DB has no internship_end_date either.`);
        noSourceDate += 1;
        continue;
      }
      await updateEmployee(row.id, { contractEndDate: intern.internship_end_date });
      console.log(`  FIXED ${row.employee_code} (${row.full_name}) -> ${intern.internship_end_date}`);
      updated += 1;
    } catch (error) {
      console.log(`  ERROR ${row.employee_code} (${row.full_name}) — ${error.message}`);
      failed += 1;
    }
  }

  console.log(`\nDone. Backfilled ${updated}, skipped ${noSourceDate} (no source date), failed ${failed}.`);
  await pool.end();
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
