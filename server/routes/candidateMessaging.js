import * as db from "../db/candidateMessaging.js";
import { RowNotFoundError } from "../db/crud.js";
import { sendJson, NotFoundError, ValidationError } from "../http/errors.js";
import { parseListQuery, readJsonBody } from "../http/util.js";
import { convertApplicant } from "../db/applicantConversion.js";
import { CHANNELS } from "../messaging/index.js";

export const routes = {
  "/candidates/{applicantId}/messages": {
    async get(req, res, ctx) {
      const messages = await db.listMessages(ctx.params.applicantId, parseListQuery(ctx.url));
      sendJson(res, ctx.cid, 200, { messages });
    },
    async post(req, res, ctx) {
      const body = await readJsonBody(req);
      if (body.channel !== undefined && !CHANNELS.includes(body.channel)) {
        throw new ValidationError(`channel must be one of: ${CHANNELS.join(", ")}.`);
      }
      const id = await db.createMessage(ctx.params.applicantId, body);
      sendJson(res, ctx.cid, 201, { message: await db.getMessage(id) });
    },
  },
  "/email-templates": {
    async get(req, res, ctx) {
      sendJson(res, ctx.cid, 200, { templates: await db.listEmailTemplates(parseListQuery(ctx.url)) });
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
  "/candidates/{applicantId}/documents": {
    async get(req, res, ctx) {
      const documents = await db.listDocuments(ctx.params.applicantId, parseListQuery(ctx.url));
      sendJson(res, ctx.cid, 200, { documents });
    },
    async post(req, res, ctx) {
      const body = await readJsonBody(req);
      const id = await db.requestDocument(ctx.params.applicantId, body.documentTypeId);
      sendJson(res, ctx.cid, 201, { document: await db.getDocument(id) });
    },
  },
  "/candidate-documents/{id}": {
    async patch(req, res, ctx) {
      const body = await readJsonBody(req);
      try {
        await db.updateDocument(ctx.params.id, body);
      } catch (error) {
        if (error instanceof RowNotFoundError) throw new NotFoundError(error.message);
        throw error;
      }
      sendJson(res, ctx.cid, 200, { document: await db.getDocument(ctx.params.id) });
    },
  },
};
