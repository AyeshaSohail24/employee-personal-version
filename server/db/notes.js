import { listRows, getRow, insertRow, updateRow, deleteRow } from "./crud.js";

export function listNotes({ ownerId, isPinned, limit, offset }) {
  const where = {};
  if (ownerId) where.owner_id = ownerId;
  if (isPinned !== undefined) where.is_pinned = isPinned;
  return listRows("notes", { where, limit, offset, orderBy: "updated_at" });
}

export const getNote = (id) => getRow("notes", id);

export const createNote = (data) =>
  insertRow("notes", {
    title: data.title,
    content: data.content ?? null,
    category: data.category ?? "General",
    tags: data.tags ? JSON.stringify(data.tags) : null,
    owner_id: data.ownerId ?? null,
    reminder_at: data.reminderAt ?? null,
  });

export function updateNote(id, data) {
  const columns = {};
  if (data.title !== undefined) columns.title = data.title;
  if (data.content !== undefined) columns.content = data.content;
  if (data.isPinned !== undefined) columns.is_pinned = data.isPinned;
  if (data.isArchived !== undefined) columns.is_archived = data.isArchived;
  if (data.reminderAt !== undefined) columns.reminder_at = data.reminderAt;
  return updateRow("notes", id, columns);
}

export const removeNote = (id) => deleteRow("notes", id);

export function listNotifications(isRead) {
  const where = {};
  if (isRead !== undefined) where.is_read = isRead;
  return listRows("notifications", { where, orderBy: "created_at" });
}

export const markNotificationRead = (id, isRead) => updateRow("notifications", id, { is_read: isRead });
export const getNotification = (id) => getRow("notifications", id);
