// Applicants DB (external, MySQL — "TalentPulse", see schema_applicants.sql).
// Never queried directly (SS-13) — only through its API, with a scoped
// access token this app requests for itself (SS-26).
//
// NOT LIVE YET — no base URL, credentials, or real /openapi.json to confirm
// paths/fields against (unlike interns/departmentsClient.js, which were
// verified against the real services). The shape below is a best guess from
// schema_applicants.sql and MUST be re-checked once that service exists.
import { EXTERNAL_CLIENTS } from "../config.js";
import { getServiceAccessToken } from "./gatewayClientCredentials.js";
import { getCorrelationId } from "../http/requestContext.js";

const cfg = EXTERNAL_CLIENTS.applicants;

async function call(path, { method = "GET", body, scope = "applicants:read" } = {}) {
  if (!cfg.baseUrl) throw new Error("APPLICANTS_API_BASE_URL is not configured — that service isn't live yet.");
  const token = await getServiceAccessToken({ ...cfg, scope });
  const cid = getCorrelationId();
  const response = await fetch(`${cfg.baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(cid ? { "x-correlation-id": cid } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Applicants API ${method} ${path} failed: ${response.status} ${detail}`);
  }
  return response.status === 204 ? null : response.json();
}

export const applicantsClient = {
  getApplicant: (applicantId) => call(`/applicants/${applicantId}`),
  // Called once an applicant has been accepted from Upcoming and converted to
  // a local employee — moves their stage/status in the Applicants DB itself.
  markApplicantHired: (applicantId) =>
    call(`/applicants/${applicantId}`, { method: "PATCH", body: { status: "hired" }, scope: "applicants:write" }),
};
