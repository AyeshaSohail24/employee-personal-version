// Interns DB (external, PostgreSQL/Supabase — real service id "intern-database",
// https://intern-database.vercel.app). This app pushes accepted, Intern-type
// employees here — see applicant_conversions in db/schema_employees.sql for
// the audit trail of every push attempt. Field names and the `data`/
// `pagination` envelope below are taken straight from that service's own
// /openapi.json — this client is the only place that shape is known.
import { EXTERNAL_CLIENTS } from "../config.js";
import { getServiceAccessToken } from "./gatewayClientCredentials.js";

const cfg = EXTERNAL_CLIENTS.interns;

async function call(path, { method = "GET", body, scope = "intern:read" } = {}) {
  if (!cfg.baseUrl) throw new Error("INTERNS_API_BASE_URL is not configured.");
  const token = await getServiceAccessToken({ ...cfg, scope });
  const response = await fetch(`${cfg.baseUrl}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
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
  // Departments service), mode, allowance, photo_url, role_id.
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
};
