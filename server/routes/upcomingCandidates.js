import { listConfirmationCandidates } from "../db/upcomingCandidates.js";
import { sendJson, NotFoundError, ValidationError } from "../http/errors.js";
import { readJsonBody } from "../http/util.js";
import * as aliases from "../db/departmentAliases.js";
import * as rejections from "../db/upcomingRejections.js";

function mapRejectionError(error) {
  if (error instanceof rejections.UpcomingApplicantNotFoundError) return new NotFoundError(error.message);
  if (error instanceof rejections.UpcomingRejectionError) return new ValidationError(error.message);
  return error;
}

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
  // Upcoming's Rejected tab, shared by every HR user: PUT rejects, DELETE restores. The candidate
  // in the Recruitment system is never changed.
  "/candidates/{applicantId}/rejection": {
    async put(req, res, ctx) {
      try {
        await rejections.rejectApplicant(ctx.params.applicantId, ctx.principal?.email ?? ctx.principal?.sub ?? null);
      } catch (error) {
        throw mapRejectionError(error);
      }
      sendJson(res, ctx.cid, 204, null);
    },
    async delete(req, res, ctx) {
      await rejections.restoreApplicant(ctx.params.applicantId);
      sendJson(res, ctx.cid, 204, null);
    },
  },
};
