// Department directory (external, API-only — real service id "department-api",
// https://department-zeta.vercel.app). Every `department_id` column in
// db/schema_employees.sql is a soft reference to an id from here (e.g.
// "DEP-0001"). Unlike the Interns API, this service returns its objects
// UNWRAPPED — no `data` envelope — confirmed against its own /openapi.json.
//
// This app's API client is granted `department:read`/`department:write` and
// `supervisor:read` — each department's `supervisorId` resolves to a person via
// GET /api/supervisors (id, firstName, lastName, email, status).
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
    signal: AbortSignal.timeout(8000), // MICROAPP_PERFORMANCE.md §9
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Departments API ${method} ${path} failed: ${response.status} ${detail}`);
  }
  return response.status === 204 ? null : response.json();
}

// MICROAPP_PERFORMANCE.md §8 — the whole department list is fetched on essentially every employee
// hydration (employeeHydration.js's loadLookups(), overlayInternFields(), the Upcoming roster —
// call sites that never pass a search term) and changes rarely; short-lived, non-personal, safe to
// share across every caller for a few seconds. A search-scoped call bypasses this entirely — a
// live lookup by name should stay live.
let departmentsCache = null; // { value, at }
const DEPARTMENTS_TTL_MS = 30_000;
let supervisorsCache = null; // { value, at } — same short, shared lifetime as departments

export const departmentsClient = {
  // Returns a plain array — this service does not paginate/wrap it.
  listDepartments(search) {
    if (search) return call(`/api/departments?search=${encodeURIComponent(search)}`);
    if (departmentsCache && Date.now() - departmentsCache.at < DEPARTMENTS_TTL_MS) {
      return Promise.resolve(departmentsCache.value);
    }
    return call("/api/departments").then((value) => {
      departmentsCache = { value, at: Date.now() };
      return value;
    });
  },
  getDepartment: (departmentId) => call(`/api/departments/${departmentId}`),

  // Every department supervisor (a department's `supervisorId` points at one of these). Needs the
  // `supervisor:read` grant. Plain array, cached like listDepartments().
  listSupervisors() {
    if (supervisorsCache && Date.now() - supervisorsCache.at < DEPARTMENTS_TTL_MS) {
      return Promise.resolve(supervisorsCache.value);
    }
    return call("/api/supervisors", { scope: "supervisor:read" }).then((value) => {
      const list = Array.isArray(value) ? value : value?.data ?? [];
      supervisorsCache = { value: list, at: Date.now() };
      return list;
    });
  },

  createDepartment: (data) => call("/api/departments", { method: "POST", body: data, scope: "department:write" }),

  // The service documents this as PUT, not PATCH — a full-record replace.
  updateDepartment: (departmentId, data) =>
    call(`/api/departments/${departmentId}`, { method: "PUT", body: data, scope: "department:write" }),

  deleteDepartment: (departmentId) =>
    call(`/api/departments/${departmentId}`, { method: "DELETE", scope: "department:write" }),
};
