import * as db from "../db/notes.js";
import { RowNotFoundError } from "../db/crud.js";
import { sendJson, NotFoundError } from "../http/errors.js";
import { parseListQuery, readJsonBody } from "../http/util.js";

function parseBoolParam(value) {
  if (value === null) return undefined;
  return value === "true";
}

export const routes = {
  "/notes": {
    async get(req, res, ctx) {
      const { limit, offset } = parseListQuery(ctx.url);
      const notes = await db.listNotes({
        ownerId: ctx.url.searchParams.get("owner_id") ?? undefined,
        isPinned: parseBoolParam(ctx.url.searchParams.get("is_pinned")),
        limit,
        offset,
      });
      sendJson(res, ctx.cid, 200, { notes });
    },
    async post(req, res, ctx) {
      const body = await readJsonBody(req);
      const id = await db.createNote(body);
      sendJson(res, ctx.cid, 201, { note: await db.getNote(id) });
    },
  },
  "/notes/{id}": {
    async patch(req, res, ctx) {
      const body = await readJsonBody(req);
      try {
        await db.updateNote(ctx.params.id, body);
      } catch (error) {
        if (error instanceof RowNotFoundError) throw new NotFoundError(error.message);
        throw error;
      }
      sendJson(res, ctx.cid, 200, { note: await db.getNote(ctx.params.id) });
    },
    async delete(req, res, ctx) {
      try {
        await db.removeNote(ctx.params.id);
      } catch (error) {
        if (error instanceof RowNotFoundError) throw new NotFoundError(error.message);
        throw error;
      }
      sendJson(res, ctx.cid, 204, null);
    },
  },
  "/notifications": {
    async get(req, res, ctx) {
      const notifications = await db.listNotifications(parseBoolParam(ctx.url.searchParams.get("is_read")), parseListQuery(ctx.url));
      sendJson(res, ctx.cid, 200, { notifications });
    },
  },
  "/notifications/{id}": {
    async patch(req, res, ctx) {
      const body = await readJsonBody(req);
      try {
        await db.markNotificationRead(ctx.params.id, Boolean(body.isRead));
      } catch (error) {
        if (error instanceof RowNotFoundError) throw new NotFoundError(error.message);
        throw error;
      }
      sendJson(res, ctx.cid, 200, { notification: await db.getNotification(ctx.params.id) });
    },
  },
};
