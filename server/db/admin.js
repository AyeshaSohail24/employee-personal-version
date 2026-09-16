import { listRows } from "./crud.js";

export const listUserAccounts = () => listRows("user_accounts", { orderBy: "id", orderDir: "ASC" });

export function listAuditLogs({ entity, entityId, limit, offset }) {
  const where = {};
  if (entity) where.entity = entity;
  if (entityId) where.entity_id = entityId;
  return listRows("audit_logs", { where, limit, offset, orderBy: "created_at" });
}
