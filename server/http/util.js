import { ValidationError } from "./errors.js";

// SS-12 — an oversized limit is clamped, never rejected; limit=0 or a
// negative offset are 422s, since those aren't paging requests at all.
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

export function parseListQuery(url) {
  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");
  const limit = limitParam === null ? DEFAULT_LIMIT : Number(limitParam);
  const offset = offsetParam === null ? 0 : Number(offsetParam);

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new ValidationError("`limit` must be a positive integer.");
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ValidationError("`offset` must be zero or a positive integer.");
  }
  return { limit: Math.min(limit, MAX_LIMIT), offset };
}

export async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ValidationError("Request body must be valid JSON.");
  }
}
