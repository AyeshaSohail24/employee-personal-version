import * as db from "../db/candidateMessaging.js";
import { RowNotFoundError } from "../db/crud.js";
import { sendJson, NotFoundError } from "../http/errors.js";
import { readJsonBody } from "../http/util.js";
import { convertApplicant } from "../db/applicantConversion.js";

export const routes = {
  "/candidates/{applicantId}/messages": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { messages: await db.listMessages(ctx.params.applicantId) });
    },
    async post(req, res, ctx) {
      const body = await readJsonBody(req);
      const id = await db.createMessage(ctx.params.applicantId, body);
      sendJson(res, ctx.cid, 201, { message: await db.getMessage(id) });
    },
  },
  "/email-templates": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { templates: await db.listEmailTemplates() });
    },
    async post(req, res, ctx) {
      const body = await readJsonBody(req);
      const id = await db.createEmailTemplate(body);
      sendJson(res, ctx.cid, 201, { template: await db.getEmailTemplate(id) });
    },
  },
  "/email-templates/{id}": {
    async patch(req, res, ctx) {
      const body = await readJsonBody(req);
      try {
        await db.updateEmailTemplate(ctx.params.id, body);
      } catch (error) {
        if (error instanceof RowNotFoundError) throw new NotFoundError(error.message);
        throw error;
      }
      sendJson(res, ctx.cid, 200, { template: await db.getEmailTemplate(ctx.params.id) });
    },
  },
  "/applicants/{applicantId}/convert": {
    async post(req, res, ctx) {
      const body = await readJsonBody(req);
      const result = await convertApplicant(ctx.params.applicantId, body);
      sendJson(res, ctx.cid, 201, result);
    },
  },
};
