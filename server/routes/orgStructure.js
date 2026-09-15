import * as db from "../db/orgStructure.js";
import { RowNotFoundError } from "../db/crud.js";
import { sendJson, NotFoundError } from "../http/errors.js";
import { readJsonBody } from "../http/util.js";

export const routes = {
  "/positions": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { positions: await db.listPositions(ctx.url.searchParams.get("department_id") ?? undefined) });
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
      sendJson(res, ctx.cid, 200, { locations: await db.listLocations() });
    },
    async post(req, res, ctx) {
      const body = await readJsonBody(req);
      const id = await db.createLocation(body);
      sendJson(res, ctx.cid, 201, { location: { id, ...body } });
    },
  },
  "/schedules": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { schedules: await db.listSchedules() });
    },
    async post(req, res, ctx) {
      const body = await readJsonBody(req);
      const id = await db.createSchedule(body);
      sendJson(res, ctx.cid, 201, { schedule: { id, ...body } });
    },
  },
  "/employee-types": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { employeeTypes: await db.listEmployeeTypes() });
    },
  },
  "/document-types": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { documentTypes: await db.listDocumentTypes() });
    },
  },
  "/departments": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { departments: await db.listExternalDepartments(ctx.url.searchParams.get("search") ?? undefined) });
    },
  },
  "/roles": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { roles: await db.listExternalRoles() });
    },
  },
};
