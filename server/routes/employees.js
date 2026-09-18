import * as db from "../db/employees.js";
import { hydrateEmployees, hydrateEmployee } from "../db/employeeHydration.js";
import { syncAllInternsToEmployees, getInternPersonalDetails } from "../db/internSync.js";
import { internsClient } from "../clients/internsClient.js";
import { RowNotFoundError } from "../db/crud.js";
import { sendJson, NotFoundError } from "../http/errors.js";
import { parseListQuery, readJsonBody } from "../http/util.js";

export const routes = {
  "/employees/sync": {
    async post(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { summary: await syncAllInternsToEmployees() });
    },
  },
  // Verbatim pass-through of the Interns DB's own status vocabulary — no local rename/mapping
  // applied (by direct instruction: this list must read exactly as that service defines it, the
  // same way GET /departments passes real department names through unchanged). "Upcoming" is the
  // one addition, appended rather than interleaved into the source's own order — the Interns DB
  // has no equivalent stage at all (an intern is only added there once actually onboarding, and
  // "Upcoming" also covers non-intern Employees, which that service never tracks), so there is
  // nothing there to preserve verbatim for it.
  "/employees/statuses": {
    async get(req, res, ctx) {
      const internStatuses = await internsClient.getStatusEnum();
      const statuses = [...internStatuses, "Upcoming"];
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
    // Only this single-employee read fetches the live Interns DB record (icPassportNumber/
    // homeAddress, for the Personnel Details page's Personal Information section) — never the
    // bulk GET /employees list, which would mean one extra external call per row on every
    // Personnel page load for data that page doesn't even display.
    async get(req, res, ctx) {
      const employee = await db.getEmployee(ctx.params.id);
      if (!employee) throw new NotFoundError(`No employee with id ${ctx.params.id}.`);
      const hydrated = await hydrateEmployee(employee);
      const internPersonalDetails = await getInternPersonalDetails(employee);
      sendJson(res, ctx.cid, 200, { employee: { ...hydrated, ...internPersonalDetails } });
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
