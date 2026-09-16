// Applicants DB (external, MySQL — "TalentPulse", see schema_applicants.sql).
// Never queried directly (SS-13) — only through its API, with a scoped
// access token this app requests for itself (SS-26).
import { EXTERNAL_CLIENTS } from "../config.js";
import { getServiceAccessToken } from "./gatewayClientCredentials.js";

const cfg = EXTERNAL_CLIENTS.applicants;

async function call(path, { method = "GET", body, scope = "applicants:read" } = {}) {
  const token = await getServiceAccessToken({ ...cfg, scope });
  const response = await fetch(`${cfg.baseUrl}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`Applicants API ${method} ${path} failed: ${response.status}`);
  return response.status === 204 ? null : response.json();
}

export const applicantsClient = {
  getApplicant: (applicantId) => call(`/applicants/${applicantId}`),
  // Called once an applicant has been accepted from Upcoming and converted to
  // a local employee — moves their stage/status in the Applicants DB itself.
  markApplicantHired: (applicantId) =>
    call(`/applicants/${applicantId}`, { method: "PATCH", body: { status: "hired" }, scope: "applicants:write" }),
};
