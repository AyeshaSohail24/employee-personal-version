import * as db from "../db/employees.js";
import { hydrateEmployees, hydrateEmployee } from "../db/employeeHydration.js";
import { overlayInternFields, applyInternOverlay, fetchInternsForOverlay, getInternPersonalDetails, getLinkedInternForDetails, listInternsWithoutLocalRecord, internToReadOnlyEntry, INTERN_ONLY_ID_PREFIX } from "../db/internSync.js";
import { internsClient } from "../clients/internsClient.js";
import { departmentsClient } from "../clients/departmentsClient.js";
import { RowNotFoundError } from "../db/crud.js";
import { sendJson, NotFoundError, ValidationError } from "../http/errors.js";
import { parseListQuery, readJsonBody } from "../http/util.js";

// Shared by GET /employees and GET /employees/sync — see overlayInternFields()'s own doc comment
// for exactly what it does and doesn't do (read-only; no writes to either database). Interns the
// Interns DB has that no local record is linked to yet (e.g. just added there) are appended as
// read-only entries built in memory from their live record (listInternsWithoutLocalRecord()) —
// nothing is created — so the list always shows who the Interns DB has right now.
//
// MICROAPP_PERFORMANCE.md §2 — the interns-list fetch doesn't depend on the local DB rows/
// hydration at all, so it starts immediately and runs alongside that work instead of only
// starting once hydration finishes.
async function listEmployeesLive(query, { internsPromise = fetchInternsForOverlay() } = {}) {
  // Awaited together (not the interns fetch after the local work), so a failing Interns DB fetch is
  // always handled — a rejection left pending while local work runs is an unhandled rejection.
  const [hydrated, interns] = await Promise.all([
    db.listEmployees(query).then((rows) => hydrateEmployees(rows)),
    internsPromise,
  ]);
  const [overlaid, internOnly] = await Promise.all([
    overlayInternFields(hydrated, interns),
    listInternsWithoutLocalRecord(interns, query),
  ]);
  return [...overlaid, ...internOnly];
}

export const routes = {
  // The "Sync Personnel" button: re-reads Personnel live from the Interns DB right now — a fresh
  // fetch of every intern, overlaid onto the existing records, anyone removed there left out, and
  // anyone added there shown from their live record. A GET that only reads: nothing is created or
  // overwritten in either database, so it never needs write permission. Unlike a plain page load,
  // an unreachable Interns DB fails this request (with the reason) instead of quietly showing the
  // local copy as if it had been refreshed.
  "/employees/sync": {
    async get(req, res, ctx) {
      const internsPromise = internsClient.listAllInterns().then(({ interns }) => interns ?? []);
      sendJson(res, ctx.cid, 200, { employees: await listEmployeesLive({ limit: 200, offset: 0 }, { internsPromise }) });
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
    // Fetches this one intern's live Interns DB record once (getLinkedInternForDetails() — a
    // single call that also answers "was it deleted upstream", replacing what used to be two
    // separate internsClient.getIntern() calls for the same person) and reuses it for two things:
    // the same Personnel ID/Status/Mode/Allowance/Start Date/Contract End Date/photo overlay GET
    // /employees already applies in bulk (applyInternOverlay() — the shared transform
    // overlayInternFields() also uses, so the two read paths can't drift apart on which fields are
    // live), plus the per-employee fields only this page shows (icPassportNumber/homeAddress, via
    // getInternPersonalDetails()). Previously this page never called the overlay at all, so an
    // intern-linked employee could show a stale local Status/Mode/etc. here even when Personnel's
    // list/Dashboard correctly showed the live value from the same Interns DB record. Runs
    // alongside hydrateEmployee() (MICROAPP_PERFORMANCE.md §2) rather than only starting once local
    // hydration finishes — neither depends on the other's result.
    async get(req, res, ctx) {
      // A person listed straight from the Interns DB (no local record — see listEmployeesLive()):
      // their details are read live from there, read-only; nothing is created.
      if (String(ctx.params.id).startsWith(INTERN_ONLY_ID_PREFIX)) {
        const internId = String(ctx.params.id).slice(INTERN_ONLY_ID_PREFIX.length);
        let intern;
        try {
          intern = await internsClient.getIntern(internId);
        } catch (error) {
          if (error?.status === 404) throw new NotFoundError(`No intern with id ${internId} in the Interns database.`);
          throw error;
        }
        if (!intern) throw new NotFoundError(`No intern with id ${internId} in the Interns database.`);
        const [departments, supervisors] = await Promise.all([
          departmentsClient.listDepartments().catch(() => []),
          departmentsClient.listSupervisors().catch(() => []),
        ]);
        const entry = internToReadOnlyEntry(
          intern,
          new Map(departments.map((d) => [String(d.id), d])),
          new Map(supervisors.map((s) => [String(s.id), s])),
        );
        sendJson(res, ctx.cid, 200, { employee: { ...entry, ...getInternPersonalDetails(intern) } });
        return;
      }
      const employee = await db.getEmployee(ctx.params.id);
      if (!employee) throw new NotFoundError(`No employee with id ${ctx.params.id}.`);

      const [hydrated, { intern, deleted }] = await Promise.all([
        hydrateEmployee(employee),
        getLinkedInternForDetails(employee),
      ]);
      if (deleted) throw new NotFoundError(`No employee with id ${ctx.params.id}.`);

      const overlaid = intern ? applyInternOverlay(hydrated, intern) : hydrated;
      const internPersonalDetails = getInternPersonalDetails(intern);
      sendJson(res, ctx.cid, 200, { employee: { ...overlaid, ...internPersonalDetails } });
    },
    async patch(req, res, ctx) {
      if (String(ctx.params.id).startsWith(INTERN_ONLY_ID_PREFIX)) {
        throw new ValidationError("This person is shown straight from the Interns database and has no record in this app, so it can't be edited here.");
      }
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
      // Someone shown straight from the Interns DB has no local employment history.
      if (String(ctx.params.id).startsWith(INTERN_ONLY_ID_PREFIX)) {
        sendJson(res, ctx.cid, 200, { employmentRecords: [] });
        return;
      }
      sendJson(res, ctx.cid, 200, { employmentRecords: await db.listEmploymentRecords(ctx.params.id) });
    },
    async post(req, res, ctx) {
      if (String(ctx.params.id).startsWith(INTERN_ONLY_ID_PREFIX)) {
        throw new ValidationError("This person is shown straight from the Interns database and has no record in this app, so their employment history can't be changed here.");
      }
      const body = await readJsonBody(req);
      const id = await db.createEmploymentRecord(ctx.params.id, body);
      sendJson(res, ctx.cid, 201, { employmentRecord: { id, ...body } });
    },
  },
};
