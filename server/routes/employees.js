import * as db from "../db/employees.js";
import { hydrateEmployees, hydrateEmployee } from "../db/employeeHydration.js";
import { RowNotFoundError } from "../db/crud.js";
import { sendJson, NotFoundError } from "../http/errors.js";
import { parseListQuery, readJsonBody } from "../http/util.js";

export const routes = {
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
