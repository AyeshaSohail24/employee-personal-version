import * as db from "../db/employees.js";
import { hydrateEmployees, hydrateEmployee } from "../db/employeeHydration.js";
import { overlayInternFields, applyInternOverlay, getInternPersonalDetails, getLinkedIntern, isLinkedInternDeleted } from "../db/internSync.js";
import { internsClient } from "../clients/internsClient.js";
import { RowNotFoundError } from "../db/crud.js";
import { sendJson, NotFoundError } from "../http/errors.js";
import { parseListQuery, readJsonBody } from "../http/util.js";

// Shared by GET /employees and GET /employees/sync — see overlayInternFields()'s own doc comment
// for exactly what it does and doesn't do (read-only; no writes to either database).
async function listEmployeesLive(query) {
  const rows = await db.listEmployees(query);
  return overlayInternFields(await hydrateEmployees(rows));
}

export const routes = {
  // An explicit, on-demand re-fetch of the exact same live-overlaid data GET /employees already
  // returns — kept as its own endpoint so the "Sync Personnel" button has a clear, named action to
  // call, distinct from the page's own initial/background load. A GET, not a POST: this reads and
  // displays only, so it must never require write permission the way an actual persist would.
  "/employees/sync": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { employees: await listEmployeesLive({ limit: 200, offset: 0 }) });
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
      // Pre-joined with department/position/location/schedule/manager, camelCase — matches what
      // src/domain/employmentDomain.js's resolveHydratedEmployee() used to produce client-side
      // from local mock arrays (see employeeHydration.js) — then live-overlaid with each
      // intern-linked employee's current Interns DB fields (see overlayInternFields()), so a
      // plain page load/refresh shows the same fresh data the Sync Personnel button does.
      const employees = await listEmployeesLive({
        status: ctx.url.searchParams.get("status") ?? undefined,
        departmentId: ctx.url.searchParams.get("department_id") ?? undefined,
        limit,
        offset,
      });
      sendJson(res, ctx.cid, 200, { employees });
    },
    async post(req, res, ctx) {
      const body = await readJsonBody(req);
      const id = await db.createEmployee(body);
      sendJson(res, ctx.cid, 201, { employee: await hydrateEmployee(await db.getEmployee(id)) });
    },
  },
  "/employees/{id}": {
    // Fetches this one intern's live Interns DB record once and reuses it for two things: the
    // same Personnel ID/Status/Mode/Allowance/Start Date/Contract End Date/photo overlay GET
    // /employees already applies in bulk (applyInternOverlay() — the shared transform
    // overlayInternFields() also uses, so the two read paths can't drift apart on which fields are
    // live), plus the per-employee fields only this page shows (icPassportNumber/homeAddress, via
    // getInternPersonalDetails()). Previously this page never called the overlay at all, so an
    // intern-linked employee could show a stale local Status/Mode/etc. here even when Personnel's
    // list/Dashboard correctly showed the live value from the same Interns DB record.
    async get(req, res, ctx) {
      const employee = await db.getEmployee(ctx.params.id);
      if (!employee) throw new NotFoundError(`No employee with id ${ctx.params.id}.`);
      if (await isLinkedInternDeleted(employee)) throw new NotFoundError(`No employee with id ${ctx.params.id}.`);
      const hydrated = await hydrateEmployee(employee);
      const intern = await getLinkedIntern(employee);
      const overlaid = intern ? applyInternOverlay(hydrated, intern) : hydrated;
      const internPersonalDetails = getInternPersonalDetails(intern);
      sendJson(res, ctx.cid, 200, { employee: { ...overlaid, ...internPersonalDetails } });
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
