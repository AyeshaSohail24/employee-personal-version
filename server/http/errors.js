// RIZURF_API_TEMPLATE.md SS-5 — the error envelope, and the two error types
// that map onto it (a route handler throws one of these, index.js catches
// and renders 404/422; anything else falls through to 500).
export class NotFoundError extends Error {}
export class ValidationError extends Error {}

const CORRELATION_HEADER = "x-correlation-id";
const NO_STORE = {
  "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
  pragma: "no-cache",
  expires: "0",
};

export function sendJson(res, cid, status, body, extraHeaders = {}) {
  // SS-9/SS-10 — DELETE answers 204 with an empty body, never a JSON "null".
  if (status === 204) {
    res.writeHead(204, { [CORRELATION_HEADER]: cid, ...NO_STORE, ...extraHeaders });
    return res.end();
  }
  res.writeHead(status, {
    "content-type": "application/json",
    [CORRELATION_HEADER]: cid,
    ...NO_STORE,
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

export function sendError(res, cid, status, code, message, details = null) {
  sendJson(res, cid, status, { error: { code, message, correlation_id: cid, details } });
}

export { CORRELATION_HEADER, NO_STORE };
