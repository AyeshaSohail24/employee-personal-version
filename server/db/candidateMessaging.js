import { pool } from "./pool.js";
import { listRows, getRow, insertRow, updateRow, RowNotFoundError } from "./crud.js";
import { sendCandidateMessage } from "../messaging/index.js";

export function listMessages(applicantId, { limit, offset } = {}) {
  return listRows("candidate_messages", { where: { applicant_id: applicantId }, orderBy: "sent_at", orderDir: "ASC", limit, offset });
}

// Opening a candidate's thread marks their replies seen, same as opening a
// message in an inbox — mirrors the existing `is_seen` column's own schema
// comment ("relevant for direction = 'received' only"). Never touches a
// "sent" row; those have no unseen concept. A bulk UPDATE (not crud.js's
// single-row updateRow()) since this clears every unseen reply for the
// applicant in one statement.
export async function markRepliesSeen(applicantId) {
  await pool.query(
    "UPDATE candidate_messages SET is_seen = TRUE WHERE applicant_id = ? AND direction = 'received' AND is_seen = FALSE",
    [applicantId],
  );
}

export async function createMessage(applicantId, data) {
  const channel = data.channel ?? "email";
  const id = await insertRow("candidate_messages", {
    applicant_id: applicantId,
    direction: "sent",
    channel,
    to_email: data.toEmail ?? null,
    cc_email: data.ccEmail ?? null,
    to_phone: data.toPhone ?? null,
    subject: data.subject ?? "",
    body: data.body ?? null,
  });
  // No real provider is wired in yet (server/messaging/*) — this call
  // currently just logs what would have been sent.
  await sendCandidateMessage({ channel, toEmail: data.toEmail, ccEmail: data.ccEmail, toPhone: data.toPhone, subject: data.subject, body: data.body });
  return id;
}

export const getMessage = (id) => getRow("candidate_messages", id);

// ---------------------------------------------------------------------------
// Email drafts (email_templates) — the single source of truth for the Upcoming
// page's offer-email drafts (formerly browser localStorage). Offer emails are
// rendered from the draft matching the candidate's offer type, so every
// offer type in REQUIRED_OFFER_TYPES must always keep at least one draft:
// deleting (or re-typing) the last one is refused with
// LastRequiredTemplateError rather than silently breaking those sends.
// ---------------------------------------------------------------------------

export const REQUIRED_OFFER_TYPES = ["Paid", "Unpaid"];

export class LastRequiredTemplateError extends Error {}

function lastRequiredMessage(offerType) {
  return `This is the only ${offerType} email draft. ${offerType} offer emails are sent using it, so it can't be deleted or changed to another offer type. Create another ${offerType} draft first.`;
}

// API shape (camelCase) — matches what the Email Drafts UI and offer-email flow expect.
function toApiTemplate(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    offerType: row.offer_type,
    subject: row.subject,
    body: row.body ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Oldest first, so the defaults stay ahead of later custom drafts (the same order the old
// localStorage array had).
export async function listEmailTemplates({ limit, offset } = {}) {
  const [rows] = await pool.query(
    "SELECT * FROM email_templates ORDER BY created_at ASC, id ASC LIMIT ? OFFSET ?",
    [limit ?? 50, offset ?? 0],
  );
  return rows.map(toApiTemplate);
}

export const getEmailTemplate = async (id) => toApiTemplate(await getRow("email_templates", id));

export const createEmailTemplate = (data) =>
  insertRow("email_templates", {
    id: data.id ?? `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: data.name,
    offer_type: data.offerType ?? "Paid",
    subject: data.subject ?? "",
    body: data.body ?? "",
  });

// Runs `work(conn, currentRow)` in a transaction with the draft's row, and every other draft of
// the same offer type, locked — so two concurrent deletes can't both pass the "not the last one"
// check and leave an offer type with no draft at all.
async function withLockedTemplate(id, work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[current]] = await conn.query("SELECT * FROM email_templates WHERE id = ? FOR UPDATE", [id]);
    if (!current) throw new RowNotFoundError(`No row in "email_templates" with id = ${id}.`);
    const [[{ sameType }]] = await conn.query(
      "SELECT COUNT(*) AS sameType FROM email_templates WHERE offer_type = ? FOR UPDATE",
      [current.offer_type],
    );
    const isLastRequired = REQUIRED_OFFER_TYPES.includes(current.offer_type) && sameType <= 1;
    await work(conn, current, isLastRequired);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export function updateEmailTemplate(id, data) {
  const columns = {};
  if (data.name !== undefined) columns.name = data.name;
  if (data.offerType !== undefined) columns.offer_type = data.offerType;
  if (data.subject !== undefined) columns.subject = data.subject;
  if (data.body !== undefined) columns.body = data.body;
  if (Object.keys(columns).length === 0) return undefined;

  return withLockedTemplate(id, async (conn, current, isLastRequired) => {
    if (columns.offer_type !== undefined && columns.offer_type !== current.offer_type && isLastRequired) {
      throw new LastRequiredTemplateError(lastRequiredMessage(current.offer_type));
    }
    const names = Object.keys(columns);
    await conn.query(
      `UPDATE email_templates SET ${names.map((c) => `\`${c}\` = ?`).join(", ")} WHERE id = ?`,
      [...names.map((c) => columns[c]), id],
    );
  });
}

export function deleteEmailTemplate(id) {
  return withLockedTemplate(id, async (conn, current, isLastRequired) => {
    if (isLastRequired) throw new LastRequiredTemplateError(lastRequiredMessage(current.offer_type));
    await conn.query("DELETE FROM email_templates WHERE id = ?", [id]);
  });
}

// Inserts each default (server/db/defaultEmailTemplates.js) only when neither that default's id
// nor any draft of its offer type exists yet — so re-running never duplicates a default, never
// overwrites an edited one, and never brings back a default HR deleted in favour of their own
// draft of that type. Called only by server/scripts/seedEmailTemplates.js, never on startup.
export async function seedDefaultEmailTemplates(defaults) {
  const inserted = [];
  for (const tpl of defaults) {
    const [result] = await pool.query(
      `INSERT INTO email_templates (id, name, offer_type, subject, body)
       SELECT ?, ?, ?, ?, ? FROM DUAL
        WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE id = ? OR offer_type = ?)`,
      [tpl.id, tpl.name, tpl.offerType, tpl.subject, tpl.body, tpl.id, tpl.offerType],
    );
    if (result.affectedRows > 0) inserted.push(tpl.id);
  }
  return inserted;
}

// The file-gathering step of the Upcoming pipeline — see candidate_documents'
// comment in db/schema_employees.sql for why this is our own table rather
// than a field pushed back into the Applicants DB.
export function listDocuments(applicantId, { limit, offset } = {}) {
  return listRows("candidate_documents", { where: { applicant_id: applicantId }, orderBy: "requested_at", orderDir: "ASC", limit, offset });
}

export const getDocument = (id) => getRow("candidate_documents", id);

export const requestDocument = (applicantId, documentTypeId) =>
  insertRow("candidate_documents", { applicant_id: applicantId, document_type_id: documentTypeId, status: "requested" });

export function updateDocument(id, data) {
  const columns = {};
  if (data.status !== undefined) columns.status = data.status;
  if (data.fileUrl !== undefined) columns.file_url = data.fileUrl;
  if (data.status === "received") columns.received_at = new Date();
  if (data.status === "verified") {
    columns.verified_at = new Date();
    columns.verified_by = data.verifiedBy ?? null;
  }
  if (data.notes !== undefined) columns.notes = data.notes;
  return updateRow("candidate_documents", id, columns);
}
