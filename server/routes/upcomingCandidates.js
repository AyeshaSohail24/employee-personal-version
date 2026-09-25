import { listConfirmationCandidates } from "../db/upcomingCandidates.js";
import { sendJson, NotFoundError, ValidationError } from "../http/errors.js";
import { readJsonBody } from "../http/util.js";
import * as aliases from "../db/departmentAliases.js";

export const routes = {
  // HR's mappings from a Recruitment job's department text to a real department.
  "/department-aliases": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { aliases: await aliases.listDepartmentAliases() });
    },
    async put(req, res, ctx) {
      const body = await readJsonBody(req);
      try {
        sendJson(res, ctx.cid, 200, { alias: await aliases.saveDepartmentAlias(body) });
      } catch (error) {
        if (error instanceof aliases.DepartmentAliasError) throw new ValidationError(error.message);
        throw error;
      }
    },
  },
  "/department-aliases/{alias}": {
    async delete(req, res, ctx) {
      try {
        await aliases.deleteDepartmentAlias(ctx.params.alias);
      } catch (error) {
        if (error instanceof aliases.DepartmentAliasError) throw new NotFoundError(error.message);
        throw error;
      }
      sendJson(res, ctx.cid, 204, null);
    },
  },
  "/candidates": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { candidates: await listConfirmationCandidates() });
    },
  },
};
