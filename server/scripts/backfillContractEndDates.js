// One-time/on-demand data repair, not a route (the "Sync Personnel" button now does this same
// thing live via POST /employees/sync — server/db/internSync.js's syncAllInternsToEmployees()).
// This script exists for running that same reconciliation from a terminal, e.g. directly against
// production once after deploying the fields-not-persisted fix (see that function's own doc
// comment for the full history). Safe to re-run: it only ever writes a field that's actually
// different from the Interns DB's value, so it converges and becomes a no-op once everything
// matches.
import { pool } from "../db/pool.js";
import { syncAllInternsToEmployees } from "../db/internSync.js";
import { assertRequiredEnv } from "../config.js";

async function main() {
  assertRequiredEnv();

  const summary = await syncAllInternsToEmployees({
    onItem: ({ intern, action, changes, error }) => {
      const name = `${intern.first_name} ${intern.last_name}`.trim();
      if (action === "created") console.log(`  CREATED ${name} (new local employee record)`);
      else if (action === "updated") console.log(`  FIXED   ${name} -> ${JSON.stringify(changes)}`);
      else if (action === "failed") console.log(`  ERROR   ${name} — ${error.message}`);
    },
  });

  console.log(
    `\nDone. Created ${summary.created}, updated ${summary.updated}, already correct ${summary.unchanged}, failed ${summary.failed} (of ${summary.total} interns checked).`,
  );

  await pool.end();
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
