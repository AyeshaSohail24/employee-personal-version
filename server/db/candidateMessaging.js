import { listRows, getRow, insertRow, updateRow } from "./crud.js";
import { sendCandidateMessage } from "../messaging/index.js";

export function listMessages(applicantId, { limit, offset } = {}) {
  return listRows("candidate_messages", { where: { applicant_id: applicantId }, orderBy: "sent_at", orderDir: "ASC", limit, offset });
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

export const listEmailTemplates = ({ limit, offset } = {}) => listRows("email_templates", { orderBy: "name", orderDir: "ASC", limit, offset });
export const getEmailTemplate = (id) => getRow("email_templates", id);

export const createEmailTemplate = (data) =>
  insertRow("email_templates", {
    id: data.id ?? `draft-${Date.now()}`,
    name: data.name,
    offer_type: data.offerType ?? "Paid",
    subject: data.subject ?? "",
    body: data.body ?? "",
  });

export function updateEmailTemplate(id, data) {
  const columns = {};
  if (data.name !== undefined) columns.name = data.name;
  if (data.offerType !== undefined) columns.offer_type = data.offerType;
  if (data.subject !== undefined) columns.subject = data.subject;
  if (data.body !== undefined) columns.body = data.body;
  return updateRow("email_templates", id, columns, "id");
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
