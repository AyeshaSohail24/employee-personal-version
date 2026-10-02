// Department mapping for Upcoming candidates. A Recruitment job's `department` is free text
// (e.g. "Engineering") rather than a link to the Departments service, so it only lines up with a
// real department when the names match. HR can map any other name to a real department here
// (department_aliases); both the direct match and the mapping ignore upper/lower case and extra
// spaces, so "engineering", " Engineering " and "ENGINEERING" all find the same entry.
//
// Two kinds of mapping share that table (and so are shared by every HR user):
//  - "department": a Recruitment department name -> a real department (stored key = the name);
//  - "job": a Recruitment job title -> a real department (stored key = "job:" + the title), for a
//    job filed under the wrong department in Recruitment. It takes priority over that job's
//    department text. Only the ERP's view changes — Recruitment data is never touched.
import { pool } from "./pool.js";
import { departmentsClient } from "../clients/departmentsClient.js";

export class DepartmentAliasError extends Error {}

const JOB_PREFIX = "job:";
export const MAPPING_KINDS = ["department", "job"];

/** "  Software   Engineering " -> "software engineering" */
export function normalizeDepartmentName(name) {
  return String(name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function mappingKey(kind, name) {
  const normalized = normalizeDepartmentName(name);
  return kind === "job" ? `${JOB_PREFIX}${normalized}` : normalized;
}

function checkKind(kind) {
  if (!MAPPING_KINDS.includes(kind)) throw new DepartmentAliasError(`kind must be one of: ${MAPPING_KINDS.join(", ")}.`);
}

/** Map of stored key ("name" or "job:title", normalized) -> department_id. */
export async function loadDepartmentAliasMap() {
  const [rows] = await pool.query("SELECT alias_key, department_id FROM department_aliases");
  return new Map(rows.map((r) => [r.alias_key, r.department_id]));
}

/**
 * The real department for a Recruitment job: HR's mapping for that job's title first, then a
 * direct name match on its department text, then HR's mapping for that department text.
 * Returns { id, name } of the real department, or null if none applies.
 */
export function resolveDepartment(jobDepartmentName, departments, aliasMap, jobTitle = null) {
  const findById = (id) => (id ? departments.find((d) => String(d.id) === String(id)) : null);
  const byJob = jobTitle && normalizeDepartmentName(jobTitle) ? findById(aliasMap.get(mappingKey("job", jobTitle))) : null;
  if (byJob) return { id: byJob.id, name: byJob.name };

  const key = normalizeDepartmentName(jobDepartmentName);
  if (!key) return null;
  const direct = departments.find((d) => normalizeDepartmentName(d.name) === key);
  if (direct) return { id: direct.id, name: direct.name };
  const mapped = findById(aliasMap.get(key));
  return mapped ? { id: mapped.id, name: mapped.name } : null;
}

export async function listDepartmentAliases() {
  const [rows] = await pool.query("SELECT alias, alias_key, department_id, updated_at FROM department_aliases ORDER BY alias ASC");
  const departments = await departmentsClient.listDepartments().catch(() => []);
  return rows.map((r) => ({
    kind: r.alias_key.startsWith(JOB_PREFIX) ? "job" : "department",
    alias: r.alias,
    departmentId: r.department_id,
    departmentName: departments.find((d) => String(d.id) === String(r.department_id))?.name ?? null,
    updatedAt: r.updated_at,
  }));
}

/**
 * Saves the mapping for `alias` (a Recruitment department name, or a job title when kind = "job"),
 * matched ignoring case/spacing. `createOnly`: refuse if that name is already mapped (Add Mapping)
 * instead of replacing it (changing an existing mapping).
 */
export async function saveDepartmentAlias({ alias, departmentId, kind = "department", createOnly = false }) {
  checkKind(kind);
  const what = kind === "job" ? "job title" : "department name";
  const display = String(alias ?? "").trim().replace(/\s+/g, " ");
  const key = mappingKey(kind, display);
  if (!normalizeDepartmentName(display)) throw new DepartmentAliasError(`Enter the ${what} used in the Recruitment system.`);
  if (display.length > 240) throw new DepartmentAliasError(`The ${what} must be 240 characters or fewer.`);
  if (kind === "department" && key.startsWith(JOB_PREFIX)) throw new DepartmentAliasError(`A department name can't start with "${JOB_PREFIX}".`);
  if (!departmentId) throw new DepartmentAliasError("Choose the department it should map to.");

  const departments = await departmentsClient.listDepartments();
  const target = departments.find((d) => String(d.id) === String(departmentId));
  if (!target) throw new DepartmentAliasError("That department doesn't exist in the Departments service.");
  if (kind === "department" && departments.some((d) => normalizeDepartmentName(d.name) === key)) {
    throw new DepartmentAliasError(`"${display}" already matches the department "${departments.find((d) => normalizeDepartmentName(d.name) === key).name}" by name, so it doesn't need a mapping.`);
  }

  if (createOnly) {
    const [result] = await pool.query(
      "INSERT IGNORE INTO department_aliases (alias_key, alias, department_id) VALUES (?, ?, ?)",
      [key, display, String(target.id)],
    );
    if (result.affectedRows === 0) {
      const [[existing]] = await pool.query("SELECT alias, department_id FROM department_aliases WHERE alias_key = ?", [key]);
      const current = departments.find((d) => String(d.id) === String(existing?.department_id))?.name;
      throw new DepartmentAliasError(`The ${what} "${existing?.alias ?? display}" is already mapped${current ? ` to ${current}` : ""}. Change it under Saved mappings instead.`);
    }
  } else {
    await pool.query(
      `INSERT INTO department_aliases (alias_key, alias, department_id) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE alias = VALUES(alias), department_id = VALUES(department_id)`,
      [key, display, String(target.id)],
    );
  }
  return { kind, alias: display, departmentId: String(target.id), departmentName: target.name };
}

export async function deleteDepartmentAlias(alias, kind = "department") {
  checkKind(kind);
  const [result] = await pool.query("DELETE FROM department_aliases WHERE alias_key = ?", [mappingKey(kind, alias)]);
  if (result.affectedRows === 0) throw new DepartmentAliasError(`No mapping for "${alias}".`);
}
