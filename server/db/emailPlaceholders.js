// User-created email placeholders (email_placeholders) — shared, HR-managed
// {{Tokens}} for the Upcoming page's offer-email drafts, alongside the three
// built-in ones. A placeholder never holds free-form meaning: it always names
// one `source` from a fixed catalog of values the app can actually resolve
// for a candidate when an email is prepared (src/domain/emailPlaceholders.js
// holds the matching resolvers; PLACEHOLDER_SOURCE_KEYS below must stay in
// step with it), so nothing can appear in the editor that can never get a
// real value.
//
// Drafts are protected both ways: a draft can't be saved with an unknown
// {{Token}} (assertDraftTokensKnown), and a placeholder can't be deleted or
// renamed while any draft still uses it (both refused with the draft names).
import { pool } from "./pool.js";
import { RowNotFoundError } from "./crud.js";

// Mirrors BUILT_IN_PLACEHOLDERS in src/domain/emailPlaceholders.js.
export const BUILT_IN_PLACEHOLDER_TOKENS = ["ApplicantName", "PositionName", "HiringEmployeeName"];

// Mirrors PLACEHOLDER_SOURCES in src/domain/emailPlaceholders.js.
export const PLACEHOLDER_SOURCE_KEYS = [
  "applicantFirstName",
  "applicantLastName",
  "applicantEmail",
  "applicantPhone",
  "departmentName",
  "offerType",
  "proposedStartDate",
  "todayDate",
  "fixedText",
];

export const FIXED_TEXT_SOURCE = "fixedText";
const TOKEN_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,39}$/;
// Same pattern the renderer uses (src/domain/candidateDomain.js's PLACEHOLDER_PATTERN).
const PLACEHOLDER_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

export class PlaceholderValidationError extends Error {}

function toApiPlaceholder(row) {
  if (!row) return null;
  return {
    id: row.id,
    token: row.token,
    label: row.label,
    description: row.description ?? "",
    source: row.source,
    fixedValue: row.fixed_value ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function extractTokens(...texts) {
  const tokens = new Set();
  for (const text of texts) {
    for (const match of String(text ?? "").matchAll(PLACEHOLDER_PATTERN)) tokens.add(match[1]);
  }
  return [...tokens];
}

export async function listPlaceholders() {
  const [rows] = await pool.query("SELECT * FROM email_placeholders ORDER BY label ASC, id ASC");
  return rows.map(toApiPlaceholder);
}

export async function getPlaceholder(id) {
  const [rows] = await pool.query("SELECT * FROM email_placeholders WHERE id = ? LIMIT 1", [id]);
  return toApiPlaceholder(rows[0]);
}

// Names of every draft whose subject or body uses {{token}}.
async function draftsUsingToken(conn, token) {
  const [drafts] = await conn.query("SELECT name, subject, body FROM email_templates ORDER BY name ASC");
  return drafts.filter((d) => extractTokens(d.subject, d.body).includes(token)).map((d) => d.name);
}

function inUseMessage(token, draftNames, action) {
  const list = draftNames.map((n) => `"${n}"`).join(", ");
  return `{{${token}}} is used in ${draftNames.length === 1 ? "the draft" : "these drafts"} ${list}, so it can't be ${action}. Remove it from ${draftNames.length === 1 ? "that draft" : "those drafts"} first.`;
}

// Validates and normalises a create/update payload. `existing` is the current row on update.
function buildColumns(data, existing = null) {
  const columns = {};

  if (data.label !== undefined || !existing) {
    const label = typeof data.label === "string" ? data.label.trim() : "";
    if (!label) throw new PlaceholderValidationError("Name is required.");
    if (label.length > 100) throw new PlaceholderValidationError("Name must be 100 characters or fewer.");
    columns.label = label;
  }

  if (data.token !== undefined || !existing) {
    const token = typeof data.token === "string" ? data.token.trim() : "";
    if (!TOKEN_PATTERN.test(token)) {
      throw new PlaceholderValidationError("The placeholder must start with a letter and use only letters and numbers (no spaces), up to 40 characters — e.g. StartDate.");
    }
    if (BUILT_IN_PLACEHOLDER_TOKENS.some((b) => b.toLowerCase() === token.toLowerCase())) {
      throw new PlaceholderValidationError(`{{${token}}} is a built-in placeholder and already exists.`);
    }
    columns.token = token;
  }

  if (data.description !== undefined) {
    const description = typeof data.description === "string" ? data.description.trim() : "";
    if (description.length > 255) throw new PlaceholderValidationError("Description must be 255 characters or fewer.");
    columns.description = description || null;
  }

  const source = data.source !== undefined ? data.source : existing?.source;
  if (data.source !== undefined || !existing) {
    if (!PLACEHOLDER_SOURCE_KEYS.includes(source)) throw new PlaceholderValidationError("Choose where the value comes from.");
    columns.source = source;
  }

  // Fixed text needs its value; every other source is resolved from the candidate, so any
  // leftover fixed value is cleared rather than kept around unused.
  if (source === FIXED_TEXT_SOURCE) {
    const fixedValue = data.fixedValue !== undefined ? String(data.fixedValue ?? "").trim() : existing?.fixed_value ?? "";
    if (!fixedValue) throw new PlaceholderValidationError("Enter the text this placeholder should insert.");
    if (fixedValue.length > 500) throw new PlaceholderValidationError("The text must be 500 characters or fewer.");
    columns.fixed_value = fixedValue;
  } else if (data.source !== undefined || data.fixedValue !== undefined) {
    columns.fixed_value = null;
  }

  return columns;
}

function rethrowDuplicate(error, token) {
  if (error?.code === "ER_DUP_ENTRY") throw new PlaceholderValidationError(`A placeholder called {{${token}}} already exists.`);
  throw error;
}

export async function createPlaceholder(data) {
  const columns = buildColumns(data);
  const names = Object.keys(columns);
  try {
    const [result] = await pool.query(
      `INSERT INTO email_placeholders (${names.map((c) => `\`${c}\``).join(", ")}) VALUES (${names.map(() => "?").join(", ")})`,
      names.map((c) => columns[c]),
    );
    return result.insertId;
  } catch (error) {
    return rethrowDuplicate(error, columns.token);
  }
}

// Runs `work(conn, row)` in a transaction with the placeholder row locked.
async function withLockedPlaceholder(id, work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[row]] = await conn.query("SELECT * FROM email_placeholders WHERE id = ? FOR UPDATE", [id]);
    if (!row) throw new RowNotFoundError(`No placeholder with id ${id}.`);
    await work(conn, row);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export function updatePlaceholder(id, data) {
  return withLockedPlaceholder(id, async (conn, row) => {
    const columns = buildColumns(data, row);
    // Renaming the token would leave every draft that uses the old one unresolvable.
    if (columns.token !== undefined && columns.token !== row.token) {
      const using = await draftsUsingToken(conn, row.token);
      if (using.length > 0) throw new PlaceholderValidationError(inUseMessage(row.token, using, "renamed"));
    }
    const names = Object.keys(columns);
    if (names.length === 0) return;
    try {
      await conn.query(
        `UPDATE email_placeholders SET ${names.map((c) => `\`${c}\` = ?`).join(", ")} WHERE id = ?`,
        [...names.map((c) => columns[c]), id],
      );
    } catch (error) {
      rethrowDuplicate(error, columns.token);
    }
  });
}

export function deletePlaceholder(id) {
  return withLockedPlaceholder(id, async (conn, row) => {
    const using = await draftsUsingToken(conn, row.token);
    if (using.length > 0) throw new PlaceholderValidationError(inUseMessage(row.token, using, "deleted"));
    await conn.query("DELETE FROM email_placeholders WHERE id = ?", [id]);
  });
}

// Refuses a draft subject/body that uses a {{Token}} that isn't built-in or user-created — it
// could never be filled in, so every email sent from that draft would be blocked.
export async function assertDraftTokensKnown(...texts) {
  const used = extractTokens(...texts);
  if (used.length === 0) return;
  const [rows] = await pool.query("SELECT token FROM email_placeholders");
  const known = new Set([...BUILT_IN_PLACEHOLDER_TOKENS, ...rows.map((r) => r.token)]);
  const unknown = used.filter((t) => !known.has(t));
  if (unknown.length > 0) {
    throw new PlaceholderValidationError(
      `Unknown placeholder${unknown.length === 1 ? "" : "s"} ${unknown.map((t) => `{{${t}}}`).join(", ")}. Create ${unknown.length === 1 ? "it" : "them"} under Placeholders, or remove ${unknown.length === 1 ? "it" : "them"} from the draft.`,
    );
  }
}
