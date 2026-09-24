// One-time/on-demand setup, not a route: writes the default Paid/Unpaid offer-email drafts
// (server/db/defaultEmailTemplates.js) into the email_templates table of whichever database .env
// points at. Deliberately NOT run on server startup — see seedDefaultEmailTemplates()'s own
// comment in server/db/candidateMessaging.js for exactly when a default is (and isn't) inserted.
// Safe to re-run: it never duplicates, overwrites, or resurrects a draft.
import { pool } from "../db/pool.js";
import { seedDefaultEmailTemplates } from "../db/candidateMessaging.js";
import { DEFAULT_EMAIL_TEMPLATES } from "../db/defaultEmailTemplates.js";
import { assertRequiredEnv } from "../config.js";

async function main() {
  assertRequiredEnv();

  const inserted = await seedDefaultEmailTemplates(DEFAULT_EMAIL_TEMPLATES);
  const skipped = DEFAULT_EMAIL_TEMPLATES.map((t) => t.id).filter((id) => !inserted.includes(id));

  console.log(`Inserted: ${inserted.length ? inserted.join(", ") : "none"}`);
  console.log(`Skipped (a draft of that offer type already exists): ${skipped.length ? skipped.join(", ") : "none"}`);

  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
