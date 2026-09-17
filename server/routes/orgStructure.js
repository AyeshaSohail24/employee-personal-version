import * as db from "../db/orgStructure.js";
import { RowNotFoundError } from "../db/crud.js";
import { sendJson, NotFoundError } from "../http/errors.js";
import { parseListQuery, readJsonBody } from "../http/util.js";

export const routes = {
  "/positions": {
    async get(req, res, ctx) {
      const positions = await db.listPositions(ctx.url.searchParams.get("department_id") ?? undefined, parseListQuery(ctx.url));
      sendJson(res, ctx.cid, 200, { positions });
    },
    async post(req, res, ctx) {
      const body = await readJsonBody(req);
      const id = await db.createPosition(body);
      sendJson(res, ctx.cid, 201, { position: await db.getPosition(id) });
    },
  },
  "/positions/{id}": {
    async get(req, res, ctx) {
      const position = await db.getPosition(ctx.params.id);
      if (!position) throw new NotFoundError(`No position with id ${ctx.params.id}.`);
      sendJson(res, ctx.cid, 200, { position });
    },
    async patch(req, res, ctx) {
      const body = await readJsonBody(req);
      try {
        await db.updatePosition(ctx.params.id, body);
      } catch (error) {
        if (error instanceof RowNotFoundError) throw new NotFoundError(error.message);
        throw error;
      }
      sendJson(res, ctx.cid, 200, { position: await db.getPosition(ctx.params.id) });
    },
  },
  "/locations": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { locations: await db.listLocations(parseListQuery(ctx.url)) });
    },
    async post(req, res, ctx) {
      const body = await readJsonBody(req);
      const id = await db.createLocation(body);
      sendJson(res, ctx.cid, 201, { location: { id, ...body } });
    },
  },
  "/schedules": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { schedules: await db.listSchedules(parseListQuery(ctx.url)) });
    },
    async post(req, res, ctx) {
      const body = await readJsonBody(req);
      const id = await db.createSchedule(body);
      sendJson(res, ctx.cid, 201, { schedule: { id, ...body } });
    },
  },
  "/employee-types": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { employeeTypes: await db.listEmployeeTypes(parseListQuery(ctx.url)) });
    },
  },
  "/document-types": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { documentTypes: await db.listDocumentTypes(parseListQuery(ctx.url)) });
    },
  },
  // Departments/Roles are read-through proxies to external services whose
  // own APIs don't support limit/offset (Departments takes `search`/`status`
  // only; Roles has no paging params at all) — SS-12 pagination doesn't
  // apply to something the upstream service itself doesn't paginate.
  "/departments": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { departments: await db.listExternalDepartments(ctx.url.searchParams.get("search") ?? undefined) });
    },
  },
  "/departments/{id}": {
    async get(req, res, ctx) {
      let department;
      try {
        department = await db.getExternalDepartment(ctx.params.id);
      } catch {
        throw new NotFoundError(`No department with id ${ctx.params.id}.`);
      }
      sendJson(res, ctx.cid, 200, { department });
    },
  },
  "/roles": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { roles: await db.listExternalRoles() });
    },
  },
};
