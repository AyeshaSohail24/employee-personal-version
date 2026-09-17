// Department directory (external, API-only — real service id "department-api",
// https://department-zeta.vercel.app). Every `department_id` column in
// db/schema_employees.sql is a soft reference to an id from here (e.g.
// "DEP-0001"). Unlike the Interns API, this service returns its objects
// UNWRAPPED — no `data` envelope — confirmed against its own /openapi.json.
//
// This client's API client is also granted `department:read`/`department:write`
// only — NOT `supervisor:*` — so the /api/supervisors endpoints aren't called
// here yet; add them once that grant exists.
import { EXTERNAL_CLIENTS } from "../config.js";
import { getServiceAccessToken } from "./gatewayClientCredentials.js";
import { getCorrelationId } from "../http/requestContext.js";

const cfg = EXTERNAL_CLIENTS.departments;

async function call(path, { method = "GET", body, scope = "department:read" } = {}) {
  if (!cfg.baseUrl) throw new Error("DEPARTMENTS_API_BASE_URL is not configured.");
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
    throw new Error(`Departments API ${method} ${path} failed: ${response.status} ${detail}`);
  }
  return response.status === 204 ? null : response.json();
}

export const departmentsClient = {
  // Returns a plain array — this service does not paginate/wrap it.
  listDepartments: (search) => call(`/api/departments${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  getDepartment: (departmentId) => call(`/api/departments/${departmentId}`),

  createDepartment: (data) => call("/api/departments", { method: "POST", body: data, scope: "department:write" }),

  // The service documents this as PUT, not PATCH — a full-record replace.
  updateDepartment: (departmentId, data) =>
    call(`/api/departments/${departmentId}`, { method: "PUT", body: data, scope: "department:write" }),

  deleteDepartment: (departmentId) =>
    call(`/api/departments/${departmentId}`, { method: "DELETE", scope: "department:write" }),
};
