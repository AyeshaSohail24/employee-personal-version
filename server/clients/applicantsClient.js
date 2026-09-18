// Applicants DB (external — Rizurf Recruitment API, real service id
// "recruitment-api", https://hr-recruitment-demo.vercel.app). Paths, scopes
// and documented input/output field NAMES below are confirmed against that
// service's own live /health and /openapi.json (2026-09-18) — but its
// openapi.json defines no component schemas, only a documented field-name
// list per operation, so the exact response envelope (e.g. whether a list
// comes back as `{ data, pagination }` like interns/departmentsClient, or
// something else) and the applicant object's full field set are NOT yet
// confirmed against a real authenticated response. Re-verify the first live
// call against real credentials before trusting this shape further — see
// listApplicants()'s own note.
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
  // GET /api/applicants — no `phase` filter exists server-side (only jobId/
  // stageId/search/status), so filtering to the `confirmation` phase for
  // Upcoming happens on the results here, not via a query param.
  async listApplicants({ jobId, stageId, search, status } = {}) {
    const params = new URLSearchParams();
    if (jobId) params.set("jobId", jobId);
    if (stageId) params.set("stageId", stageId);
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    const response = await call(`/api/applicants${params.toString() ? `?${params}` : ""}`);
    // Envelope shape unverified — see file header. Falls back to the raw
    // response if it isn't `{ data: [...] }`.
    return response.data ?? response.applicants ?? response;
  },

  async getApplicant(applicantId) {
    const response = await call(`/api/applicants/${applicantId}`);
    return response.data ?? response.applicant ?? response;
  },

  // phase must be one of "recruitment" | "confirmation" | "completed" (the
  // service's own enum). Called once an applicant accepted from Upcoming has
  // been converted to a local employee/intern — moves them from
  // `confirmation` to `completed` in the Recruitment DB itself.
  async moveApplicantPhase(applicantId, phase) {
    const response = await call(`/api/applicants/${applicantId}/phase`, { method: "PATCH", body: { phase }, scope: "applicants:write" });
    return response.data ?? response.applicant ?? response;
  },

  sendConfirmationEmail: (applicantId, context) =>
    call(`/api/applicants/${applicantId}/send-confirmation-email`, { method: "POST", body: { context }, scope: "applicants:write" }),

  sendRejectionEmail: (applicantId, context) =>
    call(`/api/applicants/${applicantId}/send-rejection-email`, { method: "POST", body: { context }, scope: "applicants:write" }),
};
