// Reads real candidate replies from the same mailbox sendEmail() sends
// through (emailProvider.js) — this app had NO inbox-reading capability at
// all before this: a candidate's real reply landed only in the mailbox
// itself, invisible to the app. Matches an incoming message's From address
// against a real applicant's email, and records it into `candidate_messages`
// (direction: "received") — the same table listMessages() already reads for
// a candidate's thread, and the same `is_seen` column its own schema comment
// already reserved for exactly this ("relevant for direction = 'received'
// only"). Every unseen message gets flagged \Seen after being read here,
// matched or not, since this mailbox exists only for this correspondence.
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { MAIL } from "../config.js";
import { applicantsClient } from "../clients/applicantsClient.js";
import { insertRow } from "../db/crud.js";

// Module-level rate limit — a real IMAP connect+auth round-trip is too slow
// to redo on every single page load in a warm serverless instance. Not a
// correctness requirement (a cold start just means one extra check; already-
// processed messages stay skipped by their own \Seen flag on the mailbox
// itself, not by anything remembered here), only an optimization.
let checking = false;
let lastCheckedAt = 0;
const MIN_INTERVAL_MS = 60 * 1000;

export async function checkForReplies() {
  if (!MAIL.imapHost || !MAIL.username || !MAIL.password) return;
  if (checking || Date.now() - lastCheckedAt < MIN_INTERVAL_MS) return;
  checking = true;
  lastCheckedAt = Date.now();

  const client = new ImapFlow({
    host: MAIL.imapHost,
    port: MAIL.imapPort,
    secure: true,
    auth: { user: MAIL.username, pass: MAIL.password },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await client.search({ seen: false }, { uid: true });
      if (!uids || uids.length === 0) return;

      // One list call, matched in memory against every unseen message — the
      // same batching reasoning as internSync.js's own roster joins (this
      // mailbox handles a handful of messages at a time, not a firehose).
      const applicants = await applicantsClient.listApplicants({}).catch(() => []);
      const applicantByEmail = new Map(
        applicants.map((a) => [String(a.email ?? "").trim().toLowerCase(), a]),
      );

      for (const uid of uids) {
        const message = await client.fetchOne(String(uid), { envelope: true, source: true }, { uid: true });
        if (message) {
          const fromAddress = (message.envelope?.from?.[0]?.address ?? "").trim().toLowerCase();
          const applicant = applicantByEmail.get(fromAddress);

          if (applicant) {
            let body = "";
            try {
              const parsed = await simpleParser(message.source);
              body = parsed.text || parsed.html || "";
            } catch {
              body = "";
            }
            await insertRow("candidate_messages", {
              applicant_id: applicant.id,
              direction: "received",
              channel: "email",
              subject: message.envelope?.subject ?? "",
              body,
              is_seen: false,
            });
          }
        }

        await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }
  } catch (error) {
    // Never breaks the page load this is triggered from — same resilience
    // pattern as overlayInternFields()'s own "external system unreachable"
    // catch.
    console.error("IMAP reply check failed:", error.message ?? error);
  } finally {
    checking = false;
    await client.logout().catch(() => {});
  }
}
