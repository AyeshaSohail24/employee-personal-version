// Department mapping for Upcoming candidates. A Recruitment job's `department` is free text
// (e.g. "Engineering") rather than a link to the Departments service, so it only lines up with a
// real department when the names match. HR can map any other name to a real department here
// (department_aliases); both the direct match and the mapping ignore upper/lower case and extra
// spaces, so "engineering", " Engineering " and "ENGINEERING" all find the same entry.
import { pool } from "./pool.js";
import { departmentsClient } from "../clients/departmentsClient.js";

export class DepartmentAliasError extends Error {}

/** "  Software   Engineering " -> "software engineering" */
export function normalizeDepartmentName(name) {
  return String(name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Map of normalized alias -> department_id. */
export async function loadDepartmentAliasMap() {
  const [rows] = await pool.query("SELECT alias_key, department_id FROM department_aliases");
  return new Map(rows.map((r) => [r.alias_key, r.department_id]));
}

/**
 * The real department for a job's free-text department: a direct name match first, then HR's
 * mapping. Returns { id, name } of the real department, or null if neither matches.
 */
export function resolveDepartment(jobDepartmentName, departments, aliasMap) {
  const key = normalizeDepartmentName(jobDepartmentName);
  if (!key) return null;
  const direct = departments.find((d) => normalizeDepartmentName(d.name) === key);
  if (direct) return { id: direct.id, name: direct.name };
  const mappedId = aliasMap.get(key);
  const mapped = mappedId ? departments.find((d) => String(d.id) === String(mappedId)) : null;
  return mapped ? { id: mapped.id, name: mapped.name } : null;
}

export async function listDepartmentAliases() {
  const [rows] = await pool.query("SELECT alias, alias_key, department_id, updated_at FROM department_aliases ORDER BY alias ASC");
  const departments = await departmentsClient.listDepartments().catch(() => []);
  return rows.map((r) => ({
    alias: r.alias,
    departmentId: r.department_id,
    departmentName: departments.find((d) => String(d.id) === String(r.department_id))?.name ?? null,
    updatedAt: r.updated_at,
  }));
}

/** Creates or replaces the mapping for `alias` (matched ignoring case/spacing). */
export async function saveDepartmentAlias({ alias, departmentId }) {
  const display = String(alias ?? "").trim().replace(/\s+/g, " ");
  const key = normalizeDepartmentName(display);
  if (!key) throw new DepartmentAliasError("Enter the department name used in the Recruitment system.");
  if (display.length > 255) throw new DepartmentAliasError("The department name must be 255 characters or fewer.");
  if (!departmentId) throw new DepartmentAliasError("Choose the department it should map to.");

  const departments = await departmentsClient.listDepartments();
  const target = departments.find((d) => String(d.id) === String(departmentId));
  if (!target) throw new DepartmentAliasError("That department doesn't exist in the Departments service.");
  if (departments.some((d) => normalizeDepartmentName(d.name) === key)) {
    throw new DepartmentAliasError(`"${display}" already matches the department "${departments.find((d) => normalizeDepartmentName(d.name) === key).name}" by name, so it doesn't need a mapping.`);
  }

  await pool.query(
    `INSERT INTO department_aliases (alias_key, alias, department_id) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE alias = VALUES(alias), department_id = VALUES(department_id)`,
    [key, display, String(target.id)],
  );
  return { alias: display, departmentId: String(target.id), departmentName: target.name };
}

export async function deleteDepartmentAlias(alias) {
  const [result] = await pool.query("DELETE FROM department_aliases WHERE alias_key = ?", [normalizeDepartmentName(alias)]);
  if (result.affectedRows === 0) throw new DepartmentAliasError(`No mapping for "${alias}".`);
}
