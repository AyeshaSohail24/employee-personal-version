// The ERP's bell in the gateway (MICROAPP_BADGES.md + RIZURF_NOTIFICATION_STANDARD.md §6c): for
// every HR account that uses the bell, the gateway gets
//  - a badge: the number of unread ERP reminders, shown on the ERP's icon in Your apps — sent only
//    when it changes (up or down, to 0 when cleared), never on every page load;
//  - notifications: each reminder the first time it appears in the feed — the gateway shows its
//    banner and sound, lists it in its bell and sends the system pop-ups. Each one is sent once.
// Both go in one POST /api/badges (API client with the `gateway:badges` grant for this app).
//
// Counts come from the same reminders feed as the bell (server/db/reminders.js) and the same
// per-account read state (notification_reads). Note reminders live in the browser, so they stay
// in-app only. Nothing is sent unless GATEWAY_NOTIFY_ENABLED=1, and nothing here can ever fail or
// slow down the request that triggered it beyond the gateway call's own timeout.
import { pool } from "./pool.js";
import { GATEWAY_URL, PUBLIC_URL, SERVICE_ID, GATEWAY_NOTIFY } from "../config.js";

const MAX_BADGES_PER_REQUEST = 500;
const MAX_NOTIFICATIONS_PER_REQUEST = 200;
const SEND_TIMEOUT_MS = 5000;

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
 * Remembers an HR account that uses the bell, so its badge is kept up to date. Only signed-in
 * people (not service clients), and only while this is switched on. Never throws.
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

/**
 * Brings the gateway in line with a freshly built reminders feed: badges for every account whose
 * unread count changed, and a notification for each item never seen before. Returns what was (or,
 * when disabled, would have been) sent. Never throws.
 */
export async function publishFeedToGateway(feed, { now = new Date() } = {}) {
  try {
    if (!GATEWAY_NOTIFY.enabled) return { sent: false, reason: "disabled" };
    if (!feed?.items) return { sent: false, reason: "no feed" };
    // A part of the feed that failed to load would look as if everything in it had been dealt with.
    if (Object.values(feed.sources ?? {}).some((s) => s !== "ok")) return { sent: false, reason: "partial feed" };

    const keys = [...new Set(feed.items.map((i) => i.key))];
    const newKeys = await recordFirstSeen(keys, now);

    const [accounts] = await pool.query("SELECT account_key, sub, email, last_count FROM gateway_badge_accounts");
    if (accounts.length === 0) return { sent: false, reason: "no accounts" };

    const readBy = new Map(accounts.map((a) => [a.account_key, new Set()]));
    if (keys.length > 0) {
      const [reads] = await pool.query(
        "SELECT account_key, notification_key FROM notification_reads WHERE notification_key IN (?) AND account_key IN (?)",
        [keys, accounts.map((a) => a.account_key)],
      );
      for (const r of reads) readBy.get(r.account_key)?.add(r.notification_key);
    }

    const badges = [];
    const changedCounts = [];
    const notifications = [];
    const newItems = feed.items.filter((i) => newKeys.has(i.key));
    for (const account of accounts) {
      const who = gatewayIdentity(account);
      if (!who) continue;
      const read = readBy.get(account.account_key);
      const count = keys.filter((k) => !read.has(k)).length;
      if (account.last_count === null || Number(account.last_count) !== count) {
        badges.push({ ...who, count });
        changedCounts.push([account.account_key, count]);
      }
      for (const item of newItems) {
        if (read.has(item.key)) continue;
        notifications.push({
          id: item.key,
          ...who,
          title: String(item.title ?? "").slice(0, 200),
          subtitle: reminderLabel(item),
          body: item.message ? String(item.message).slice(0, 500) : undefined,
          url: PUBLIC_URL && item.link ? `${PUBLIC_URL}${item.link}` : undefined,
          at: now.toISOString(),
        });
      }
    }
    if (badges.length === 0 && notifications.length === 0) return { sent: false, reason: "nothing changed" };

    const ok = await send(badges, notifications);
    if (ok) {
      for (const [accountKey, count] of changedCounts) {
        await pool.query("UPDATE gateway_badge_accounts SET last_count = ? WHERE account_key = ?", [count, accountKey]);
      }
    } else if (newKeys.size > 0) {
      // Not delivered: forget them again, so the next feed read announces them (counts are re-sent
      // anyway, since last_count wasn't updated).
      await pool.query("DELETE FROM reminder_first_seen WHERE notification_key IN (?)", [[...newKeys]]);
    }
    return { sent: ok, badges, notifications };
  } catch (error) {
    if (!tableMissing(error)) console.error("[gateway] could not publish badges/notifications:", error.message);
    return { sent: false, reason: "error" };
  }
}

// Records when each key was first seen and returns the ones seen now for the first time. The very
// first run only records what's already there — those are a backlog, not news — so switching this
// on never floods anyone's gateway with old reminders.
async function recordFirstSeen(keys, now) {
  if (keys.length === 0) return new Set();
  const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM reminder_first_seen");
  const [known] = await pool.query("SELECT notification_key FROM reminder_first_seen WHERE notification_key IN (?)", [keys]);
  const knownKeys = new Set(known.map((r) => r.notification_key));
  const fresh = keys.filter((k) => !knownKeys.has(k));
  if (fresh.length === 0) return new Set();
  await pool.query("INSERT IGNORE INTO reminder_first_seen (notification_key, first_seen_at) VALUES ?", [fresh.map((k) => [k, now])]);
  return Number(n) === 0 ? new Set() : new Set(fresh);
}

// One POST /api/badges per 500 badges / 200 notifications. True if every part was accepted.
async function send(badges, notifications) {
  if (!GATEWAY_URL || !GATEWAY_NOTIFY.clientId || !GATEWAY_NOTIFY.clientSecret) {
    console.error("[gateway] GATEWAY_URL or the API client credentials are not configured — nothing sent.");
    return false;
  }
  const auth = `Basic ${Buffer.from(`${GATEWAY_NOTIFY.clientId}:${GATEWAY_NOTIFY.clientSecret}`).toString("base64")}`;
  let ok = true;
  const parts = Math.max(Math.ceil(badges.length / MAX_BADGES_PER_REQUEST), Math.ceil(notifications.length / MAX_NOTIFICATIONS_PER_REQUEST), 1);
  for (let i = 0; i < parts; i++) {
    const body = { service: SERVICE_ID };
    const b = badges.slice(i * MAX_BADGES_PER_REQUEST, (i + 1) * MAX_BADGES_PER_REQUEST);
    const n = notifications.slice(i * MAX_NOTIFICATIONS_PER_REQUEST, (i + 1) * MAX_NOTIFICATIONS_PER_REQUEST);
    if (b.length) body.badges = b;
    if (n.length) body.notifications = n;
    try {
      const response = await fetch(`${GATEWAY_URL}/api/badges`, {
        method: "POST",
        headers: { authorization: auth, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      if (!response.ok) {
        ok = false;
        console.error("[gateway] /api/badges answered", response.status, (await response.text().catch(() => "")).slice(0, 300));
      }
    } catch (error) {
      ok = false;
      console.error("[gateway] could not reach the gateway:", error.message);
    }
  }
  return ok;
}
