// Interns DB (external, PostgreSQL/Supabase — real service id "intern-database",
// https://intern-database.vercel.app). This app pushes accepted, Intern-type
// employees here — see applicant_conversions in db/schema_employees.sql for
// the audit trail of every push attempt. Field names and the `data`/
// `pagination` envelope below are taken straight from that service's own
// /openapi.json — this client is the only place that shape is known.
import { EXTERNAL_CLIENTS } from "../config.js";
import { getServiceAccessToken } from "./gatewayClientCredentials.js";
import { getCorrelationId } from "../http/requestContext.js";

const cfg = EXTERNAL_CLIENTS.interns;

async function call(path, { method = "GET", body, scope = "intern:read" } = {}) {
  if (!cfg.baseUrl) throw new Error("INTERNS_API_BASE_URL is not configured.");
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
    throw new Error(`Interns API ${method} ${path} failed: ${response.status} ${detail}`);
  }
  return response.status === 204 ? null : response.json();
}

export const internsClient = {
  async listInterns({ limit, offset } = {}) {
    const params = new URLSearchParams();
    if (limit) params.set("limit", limit);
    if (offset) params.set("offset", offset);
    const { data, pagination } = await call(`/api/interns${params.toString() ? `?${params}` : ""}`);
    return { interns: data, pagination };
  },

  async getIntern(internId) {
    const { data } = await call(`/api/interns/${internId}`);
    return data;
  },

  // `data` fields: first_name, last_name, ic_passport_number,
  // internship_start_date, internship_end_date, email_address, phone_number,
  // home_address, department_id ("DEP-0001" style, resolved via the
  // Departments service), mode, allowance, photo_url, role_id, status
  // (Onboarding/Active/Offboarding/Former — see getStatusEnum() below).
  async createIntern(data) {
    const response = await call("/api/interns", { method: "POST", body: data, scope: "intern:write" });
    return response.data ?? response; // service returns { id, ref_number } at minimum
  },

  async updateIntern(internId, data) {
    const response = await call(`/api/interns/${internId}`, { method: "PATCH", body: data, scope: "intern:write" });
    return response.data ?? response;
  },

  deleteIntern: (internId) => call(`/api/interns/${internId}`, { method: "DELETE", scope: "intern:write" }),

  async listRoles() {
    const { data } = await call("/api/roles");
    return data;
  },

  // The Interns DB's own authoritative status vocabulary — read from its published OpenAPI
  // contract (components.schemas.Intern.properties.status.enum), the same self-describing
  // metadata every other client of this service is expected to use, rather than guessing at it
  // or re-deriving it from whichever statuses happen to be populated on interns right now (which
  // could easily be an incomplete subset — see server/routes/employees.js's /employees/statuses
  // for why this app's own Personnel status list still isn't a byte-for-byte copy of this one).
  // Public, unauthenticated endpoint — no service token needed, unlike every other call here.
  async getStatusEnum() {
    if (!cfg.baseUrl) throw new Error("INTERNS_API_BASE_URL is not configured.");
    const response = await fetch(`${cfg.baseUrl}/openapi.json`);
    if (!response.ok) throw new Error(`Interns API GET /openapi.json failed: ${response.status}`);
    const spec = await response.json();
    const statusEnum = spec?.components?.schemas?.Intern?.properties?.status?.enum;
    if (!Array.isArray(statusEnum)) throw new Error("Interns API's OpenAPI spec has no Intern.status enum at the expected path.");
    return statusEnum;
  },
};
