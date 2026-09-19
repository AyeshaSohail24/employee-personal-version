// Applicants DB (external — Rizurf Recruitment API, real service id
// "recruitment-api", https://hr-recruitment-demo.vercel.app). Paths, scopes
// and response shapes below are confirmed against a real authenticated call
// (2026-09-18). Every endpoint tested so far (applicants list/get, jobs
// list) wraps its result in `{ status: "success", data }` — unwrap `.data`
// everywhere. An applicant record carries first_name/last_name/fullName
// (and much more — nationality, university, position, resume as a base64
// data URI, etc.), even though the service's own /openapi.json only
// documents a single `name` field as a create-time input — its docs and
// its real response shape disagree; trust the response shape here. A job
// record's `department` is a plain display string (e.g. "Engineering"),
// not an id — it does not line up with this app's own Departments API ids.
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
    return response.data ?? response;
  },

  async getApplicant(applicantId) {
    const response = await call(`/api/applicants/${applicantId}`);
    return response.data ?? response;
  },

  // Used to resolve an applicant's job_id into a department/title for
  // display, since an applicant record itself has no department field.
  async listJobs() {
    const response = await call("/api/jobs", { scope: "jobs:read" });
    return response.data ?? response;
  },

  // phase must be one of "recruitment" | "confirmation" | "completed" (the
  // service's own enum). Called once an applicant accepted from Upcoming has
  // been converted to a local employee/intern — moves them from
  // `confirmation` to `completed` in the Recruitment DB itself. Write calls
  // (this one, the two emails below) haven't been exercised live yet — only
  // the GETs above have — so `.applicant` here is a defensive fallback
  // alongside the confirmed `.data` envelope, not itself confirmed.
  async moveApplicantPhase(applicantId, phase) {
    const response = await call(`/api/applicants/${applicantId}/phase`, { method: "PATCH", body: { phase }, scope: "applicants:write" });
    return response.data ?? response.applicant ?? response;
  },

  sendConfirmationEmail: (applicantId, context) =>
    call(`/api/applicants/${applicantId}/send-confirmation-email`, { method: "POST", body: { context }, scope: "applicants:write" }),

  sendRejectionEmail: (applicantId, context) =>
    call(`/api/applicants/${applicantId}/send-rejection-email`, { method: "POST", body: { context }, scope: "applicants:write" }),
};
