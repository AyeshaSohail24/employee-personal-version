// One-time data repair, not a route: createEmployee() (server/db/employees.js) accepts
// contractEndDate/workMode/allowance, but the intern-sync and applicant-conversion flows that
// call it never actually passed them through until this fix — so every intern-linked employee
// created before that fix is missing its real end date, and silently has whatever hardcoded
// default createEmployee() falls back to for Mode ("On-site") and Salary ("Paid"), regardless of
// what's actually configured for them in the Interns DB (the source of truth for all three).
// This re-derives the correct values from there rather than fabricating them. Safe to re-run:
// it only ever writes a field that's actually different from the Interns DB's value, so it
// converges and becomes a no-op once everything matches.
import { pool } from "../db/pool.js";
import { updateEmployee } from "../db/employees.js";
import { internsClient } from "../clients/internsClient.js";
import { assertRequiredEnv } from "../config.js";

async function main() {
  assertRequiredEnv();

  // contract_end_date can be safely filtered on (NULL is a real "missing" sentinel for it), but
  // work_mode/allowance always hold a value (createEmployee()'s own default), so every
  // intern-linked employee has to be checked and reconciled against the Interns DB, not just
  // ones with an obviously-missing field.
  const [rows] = await pool.query(
    "SELECT id, employee_code, full_name, intern_external_id, contract_end_date, work_mode, allowance FROM employees WHERE intern_external_id IS NOT NULL",
  );

  console.log(`Found ${rows.length} intern-linked employee(s) to check against the Interns DB.`);

  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const intern = await internsClient.getIntern(row.intern_external_id);
      const changes = {};

      if (!row.contract_end_date && intern?.internship_end_date) {
        changes.contractEndDate = intern.internship_end_date;
      }
      if (intern?.mode && intern.mode !== row.work_mode) {
        changes.workMode = intern.mode;
      }
      if (intern?.allowance && intern.allowance !== row.allowance) {
        changes.allowance = intern.allowance;
      }

      if (Object.keys(changes).length === 0) {
        unchanged += 1;
        continue;
      }

      await updateEmployee(row.id, changes);
      console.log(`  FIXED ${row.employee_code} (${row.full_name}) -> ${JSON.stringify(changes)}`);
      updated += 1;
    } catch (error) {
      console.log(`  ERROR ${row.employee_code} (${row.full_name}) — ${error.message}`);
      failed += 1;
    }
  }

  console.log(`\nDone. Updated ${updated}, already correct ${unchanged}, failed ${failed}.`);
  await pool.end();
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
