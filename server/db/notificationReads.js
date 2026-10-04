// Which notifications each HR account has read (notification_reads), so read/unread follows the
// signed-in account across browsers, devices and sessions instead of living in one browser — and
// stays independent between accounts. Keyed by the account (the gateway user id, `sub`) and the
// notification's stable key (an ERP reminder's key from server/db/reminders.js, or
// "note:<noteId>:<reminderAt>" for a note reminder). Only "read" is stored: no row = unread.
import { pool } from "./pool.js";
import { ConfigurationError } from "../http/errors.js";

export class NotificationReadError extends Error {}

// Rows older than this are dropped: every reminder it could refer to is long resolved by then.
const KEEP_DAYS = 180;
const MAX_KEYS_PER_REQUEST = 500;
const TABLE_MISSING_MESSAGE = "Shared read state isn't set up on this database yet (run npm run create-notification-reads-table).";

/** The account a request belongs to — the gateway user id for a signed-in session. */
export function accountKeyFor(principal) {
  if (principal?.sub) return `${principal.type === "access" ? "service" : "user"}:${principal.sub}`;
  if (principal?.email) return `email:${String(principal.email).trim().toLowerCase()}`;
  throw new NotificationReadError("This request isn't linked to an account.");
}

/** Keys this account has read. `available: false` until the table exists (nothing is shared yet). */
export async function listReadKeys(accountKey) {
  try {
    const [rows] = await pool.query(
      `SELECT notification_key FROM notification_reads WHERE account_key = ? AND read_at > NOW() - INTERVAL ${KEEP_DAYS} DAY`,
      [accountKey],
    );
    return { available: true, keys: rows.map((r) => r.notification_key) };
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return { available: false, keys: [] };
    throw error;
  }
}

/** Marks these keys read for this account (already-read keys are fine). */
export async function markKeysRead(accountKey, keys) {
  if (!Array.isArray(keys) || keys.length === 0) throw new NotificationReadError("keys must be a non-empty list.");
  if (keys.length > MAX_KEYS_PER_REQUEST) throw new NotificationReadError(`At most ${MAX_KEYS_PER_REQUEST} keys at a time.`);
  const clean = [...new Set(keys.map((k) => String(k ?? "").trim()))];
  if (clean.some((k) => !k || k.length > 255)) throw new NotificationReadError("Each key must be 1–255 characters.");
  try {
    await pool.query(
      "INSERT IGNORE INTO notification_reads (account_key, notification_key) VALUES ?",
      [clean.map((k) => [accountKey, k])],
    );
    await pool.query(`DELETE FROM notification_reads WHERE account_key = ? AND read_at < NOW() - INTERVAL ${KEEP_DAYS} DAY`, [accountKey]);
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") throw new ConfigurationError(TABLE_MISSING_MESSAGE);
    throw error;
  }
  return clean.length;
}
