import * as db from "../db/employees.js";
import { hydrateEmployees, hydrateEmployee } from "../db/employeeHydration.js";
import { syncAllInternsToEmployees } from "../db/internSync.js";
import { internsClient } from "../clients/internsClient.js";
import { RowNotFoundError } from "../db/crud.js";
import { sendJson, NotFoundError } from "../http/errors.js";
import { parseListQuery, readJsonBody } from "../http/util.js";

// The Interns DB's own status vocabulary (Onboarding/Active/Offboarding/Former) doesn't line up
// 1:1 with this app's own Personnel lifecycle model: "Offboarding" there is "Departing" here (a
// naming difference, same concept), and it has no equivalent of "Upcoming" at all — an intern
// only gets added to that service once they're actually onboarding, not while still a pre-hire
// candidate. "Upcoming" also applies to non-intern Employees, which that service never covers.
// So this maps the source's real terms in rather than replacing them outright with an unrelated
// hardcoded list — an actual rename on their end (say, "Offboarding" -> something else) still
// surfaces correctly here, it just won't silently invent states that service doesn't have.
const INTERN_STATUS_TO_PERSONNEL_STATUS = {
  Onboarding: "Onboarding",
  Active: "Active",
  Offboarding: "Departing",
  Former: "Former",
};
const PERSONNEL_STATUS_ORDER = ["Active", "Onboarding", "Upcoming", "Departing", "Former"];

export const routes = {
  "/employees/sync": {
    async post(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { summary: await syncAllInternsToEmployees() });
    },
  },
  "/employees/statuses": {
    async get(req, res, ctx) {
      const internStatuses = await internsClient.getStatusEnum();
      const mapped = new Set(internStatuses.map((s) => INTERN_STATUS_TO_PERSONNEL_STATUS[s] ?? s));
      mapped.add("Upcoming"); // always present — a stage the Interns DB itself has no concept of
      const statuses = PERSONNEL_STATUS_ORDER.filter((s) => mapped.has(s))
        .concat([...mapped].filter((s) => !PERSONNEL_STATUS_ORDER.includes(s))); // any genuinely new term, appended rather than dropped
      sendJson(res, ctx.cid, 200, { statuses });
    },
  },
  "/employees": {
    async get(req, res, ctx) {
      const { limit, offset } = parseListQuery(ctx.url);
      const rows = await db.listEmployees({
        status: ctx.url.searchParams.get("status") ?? undefined,
        departmentId: ctx.url.searchParams.get("department_id") ?? undefined,
        limit,
        offset,
      });
      // Pre-joined with department/position/location/schedule/manager, camelCase —
      // matches what src/domain/employmentDomain.js's resolveHydratedEmployee()
      // used to produce client-side from local mock arrays (see employeeHydration.js).
      sendJson(res, ctx.cid, 200, { employees: await hydrateEmployees(rows) });
    },
    async post(req, res, ctx) {
      const body = await readJsonBody(req);
      const id = await db.createEmployee(body);
      sendJson(res, ctx.cid, 201, { employee: await hydrateEmployee(await db.getEmployee(id)) });
    },
  },
  "/employees/{id}": {
    async get(req, res, ctx) {
      const employee = await db.getEmployee(ctx.params.id);
      if (!employee) throw new NotFoundError(`No employee with id ${ctx.params.id}.`);
      sendJson(res, ctx.cid, 200, { employee: await hydrateEmployee(employee) });
    },
    async patch(req, res, ctx) {
      const body = await readJsonBody(req);
      try {
        await db.updateEmployee(ctx.params.id, body);
      } catch (error) {
        if (error instanceof RowNotFoundError) throw new NotFoundError(error.message);
        throw error;
      }
      sendJson(res, ctx.cid, 200, { employee: await hydrateEmployee(await db.getEmployee(ctx.params.id)) });
    },
  },
  "/employees/{id}/employment-records": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { employmentRecords: await db.listEmploymentRecords(ctx.params.id) });
    },
    async post(req, res, ctx) {
      const body = await readJsonBody(req);
      const id = await db.createEmploymentRecord(ctx.params.id, body);
      sendJson(res, ctx.cid, 201, { employmentRecord: { id, ...body } });
    },
  },
};
