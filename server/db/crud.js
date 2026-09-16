// The data access layer (SS-15). Imports nothing web-framework-specific, so it
// is equally usable from a worker or a CLI. Every query is parameterised.
// Reads return an ordinary answer (null / empty list) for a missing row —
// missing is not an error here. Writes that affect zero rows raise, since the
// caller always names a row it believes exists.
import { pool } from "./pool.js";

export class RowNotFoundError extends Error {}

export async function listRows(table, { where = {}, limit = 50, offset = 0, orderBy = "id", orderDir = "DESC" } = {}) {
  const columns = Object.keys(where);
  const clause = columns.length ? `WHERE ${columns.map((c) => `\`${c}\` = ?`).join(" AND ")}` : "";
  const values = columns.map((c) => where[c]);
  const [rows] = await pool.query(
    `SELECT * FROM \`${table}\` ${clause} ORDER BY \`${orderBy}\` ${orderDir} LIMIT ? OFFSET ?`,
    [...values, limit, offset],
  );
  return rows;
}

export async function getRow(table, id, idColumn = "id") {
  const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE \`${idColumn}\` = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function insertRow(table, data) {
  const columns = Object.keys(data);
  const [result] = await pool.query(
    `INSERT INTO \`${table}\` (${columns.map((c) => `\`${c}\``).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    columns.map((c) => data[c]),
  );
  return result.insertId || data.id;
}

export async function updateRow(table, id, data, idColumn = "id") {
  const columns = Object.keys(data);
  if (columns.length === 0) return;
  const [result] = await pool.query(
    `UPDATE \`${table}\` SET ${columns.map((c) => `\`${c}\` = ?`).join(", ")} WHERE \`${idColumn}\` = ?`,
    [...columns.map((c) => data[c]), id],
  );
  if (result.affectedRows === 0) throw new RowNotFoundError(`No row in "${table}" with ${idColumn} = ${id}.`);
}

export async function deleteRow(table, id, idColumn = "id") {
  const [result] = await pool.query(`DELETE FROM \`${table}\` WHERE \`${idColumn}\` = ?`, [id]);
  if (result.affectedRows === 0) throw new RowNotFoundError(`No row in "${table}" with ${idColumn} = ${id}.`);
}
