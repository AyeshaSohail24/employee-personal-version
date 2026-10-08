// The ERP's bell in the gateway (MICROAPP_BADGES.md + RIZURF_NOTIFICATION_STANDARD.md §6): the
// gateway reads GET /gateway/badges (server/routes/gateway.js) about once a minute and gets
//  - badges: each HR account's number of unread ERP reminders, shown on the ERP's icon in Your apps
//    (anyone not listed has 0);
//  - notifications: the reminders that appeared recently — the gateway shows its banner and sound,
//    lists them in its bell and sends the system pop-ups, each id once per person.
// After anything that changes those (a new reminder appears, someone reads one) the ERP nudges the
// gateway so it reads again within about a second.
//
// Counts come from the same reminders feed as the bell (server/db/reminders.js) and the same
// per-account read state (notification_reads). Note reminders live in the browser, so they stay
// in-app only. All of this is off unless GATEWAY_NOTIFY_ENABLED=1.
import { pool } from "./pool.js";
import { GATEWAY_URL, PUBLIC_URL, SERVICE_ID, GATEWAY_NOTIFY } from "../config.js";

// §6a: list the last 10 minutes or the newest 50, whichever is more — at most 200 per answer.
const RECENT_MS = 10 * 60 * 1000;
const RECENT_AT_LEAST = 50;
const MAX_NOTIFICATIONS = 200;
const MAX_BADGES = 5000;
const NUDGE_TIMEOUT_MS = 3000;
const DAY_MS = 24 * 60 * 60 * 1000;

const tableMissing = (error) => error?.code === "ER_NO_SUCH_TABLE";

/** Who an account is to the gateway: its user id (`sub`), or its email. */
function gatewayIdentity(account) {
  if (account.sub) return { sub: account.sub };
  if (account.email) return { email: account.email };
  return null;
}

// Same wording as the bell's label (src/services/reminderService.js's reminderLabel()).
export function reminderLabel(item) {
  switch (item.kind) {
    case "task": return `${item.module === "offboarding" ? "Offboarding" : "Onboarding"} Task${item.state === "overdue" ? " · Overdue" : item.state === "today" ? " · Due Today" : ""}`;
    case "starting": return "Starting Soon";
    case "ending": return item.status === "Offboarding" ? "Final Working Day" : "Ending Soon";
    case "reply": return "Candidate Reply";
    default: return "Reminder";
  }
}

/**
 * Remembers an HR account that uses the bell, so it gets a badge. Only signed-in people (not
 * service clients), and only while this is switched on. Never throws.
 */
export async function rememberAccount(accountKey, principal) {
  if (!GATEWAY_NOTIFY.enabled || !accountKey?.startsWith("user:") || !principal?.sub) return;
  try {
    await pool.query(
      `INSERT INTO gateway_badge_accounts (account_key, sub, email) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE sub = VALUES(sub), email = VALUES(email)`,
      [accountKey, String(principal.sub), principal.email ? String(principal.email).toLowerCase() : null],
    );
  } catch (error) {
    if (!tableMissing(error)) console.error("[gateway] could not record the account:", error.message);
  }
}

// A part of the feed that failed to load would look as if everything in it had been dealt with.
const completeFeed = (feed) => Boolean(feed?.items) && !Object.values(feed.sources ?? {}).some((s) => s !== "ok");

/**
 * Brings the stored state in line with a freshly built reminders feed: records when each reminder
 * was first seen, works out every account's unread count, and keeps the counts. Returns the counts
 * and whether anything changed (a new reminder, or a count that went up or down). Never throws.
 */
export async function syncFeed(feed, { now = new Date() } = {}) {
  const none = { changed: false, accounts: [], readBy: new Map(), firstSeen: new Map() };
  if (!GATEWAY_NOTIFY.enabled || !completeFeed(feed)) return none;
  try {
    const keys = [...new Set(feed.items.map((i) => i.key))];
    const { firstSeen, newKeys } = await recordFirstSeen(keys, now);
    const [accounts] = await pool.query("SELECT account_key, sub, email, last_count FROM gateway_badge_accounts");
    const readBy = new Map(accounts.map((a) => [a.account_key, new Set()]));
    if (keys.length > 0 && accounts.length > 0) {
      const [reads] = await pool.query(
        "SELECT account_key, notification_key FROM notification_reads WHERE notification_key IN (?) AND account_key IN (?)",
        [keys, accounts.map((a) => a.account_key)],
      );
      for (const r of reads) readBy.get(r.account_key)?.add(r.notification_key);
    }
    let countsChanged = false;
    for (const account of accounts) {
      const count = keys.filter((k) => !readBy.get(account.account_key).has(k)).length;
      if (account.last_count === null || Number(account.last_count) !== count) {
        countsChanged = true;
        await pool.query("UPDATE gateway_badge_accounts SET last_count = ? WHERE account_key = ?", [count, account.account_key]);
      }
      account.count = count;
    }
    return { changed: newKeys.size > 0 || countsChanged, accounts, readBy, firstSeen };
  } catch (error) {
    if (!tableMissing(error)) console.error("[gateway] could not update the gateway state:", error.message);
    return none;
  }
}

/**
 * The answer to GET /gateway/badges for a freshly built feed: `badges` (everyone with something)
 * and `notifications` (recent reminders each person hasn't read). `null` when the feed is
 * incomplete — the caller then answers from nothing rather than from a wrong picture.
 */
export async function gatewayBadgesAnswer(feed, { now = new Date() } = {}) {
  if (!completeFeed(feed)) return null;
  const { accounts, readBy, firstSeen } = await syncFeed(feed, { now });
  const badges = [];
  const notifications = [];
  const byNewest = feed.items
    .filter((i) => firstSeen.has(i.key))
    .sort((a, b) => firstSeen.get(b.key) - firstSeen.get(a.key));
  for (const account of accounts) {
    const who = gatewayIdentity(account);
    if (!who) continue;
    if (account.count > 0 && badges.length < MAX_BADGES) badges.push({ ...who, count: account.count });
    const unread = byNewest.filter((i) => !readBy.get(account.account_key).has(i.key));
    const recent = unread.filter((i, n) => now - firstSeen.get(i.key) <= RECENT_MS || n < RECENT_AT_LEAST);
    for (const item of recent) {
      notifications.push({
        id: item.key,
        ...who,
        title: String(item.title ?? "").slice(0, 200),
        subtitle: reminderLabel(item),
        body: item.message ? String(item.message).slice(0, 500) : undefined,
        url: PUBLIC_URL && item.link ? `${PUBLIC_URL}${item.link}` : undefined,
        at: firstSeen.get(item.key).toISOString(),
      });
    }
  }
  notifications.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return { badges, notifications: notifications.slice(0, MAX_NOTIFICATIONS) };
}

// Records when each key was first seen; returns every key's first-seen time and the keys seen now
// for the first time. The very first run dates what's already there a day back — those are a
// backlog, not news, and the gateway never announces anything over an hour old — so switching this
// on never floods anyone's gateway with old reminders.
async function recordFirstSeen(keys, now) {
  if (keys.length === 0) return { firstSeen: new Map(), newKeys: new Set() };
  const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM reminder_first_seen");
  const [known] = await pool.query("SELECT notification_key, first_seen_at FROM reminder_first_seen WHERE notification_key IN (?)", [keys]);
  const firstSeen = new Map(known.map((r) => [r.notification_key, new Date(r.first_seen_at)]));
  const fresh = keys.filter((k) => !firstSeen.has(k));
  if (fresh.length === 0) return { firstSeen, newKeys: new Set() };
  const at = Number(n) === 0 ? new Date(now.getTime() - DAY_MS) : now;
  // Seconds only, as the column stores them (so the time listed now equals the one read back later).
  const stamp = new Date(Math.floor(at.getTime() / 1000) * 1000);
  await pool.query("INSERT IGNORE INTO reminder_first_seen (notification_key, first_seen_at) VALUES ?", [fresh.map((k) => [k, stamp])]);
  const [rows] = await pool.query("SELECT notification_key, first_seen_at FROM reminder_first_seen WHERE notification_key IN (?)", [fresh]);
  for (const r of rows) firstSeen.set(r.notification_key, new Date(r.first_seen_at));
  return { firstSeen, newKeys: Number(n) === 0 ? new Set() : new Set(fresh) };
}

/**
 * §6b: tells the gateway to read GET /gateway/badges now (it answers 202 straight away). No key —
 * all a nudge can do is make the gateway read us. Awaited by callers (on a serverless host nothing
 * may run after the response), with a short timeout; never throws.
 */
export async function nudgeGateway() {
  if (!GATEWAY_NOTIFY.enabled || !GATEWAY_URL) return false;
  try {
    const response = await fetch(`${GATEWAY_URL}/api/notifications/nudge`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ service: SERVICE_ID }),
      signal: AbortSignal.timeout(NUDGE_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}
