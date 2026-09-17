import { listRows, getRow, insertRow, updateRow } from "./crud.js";
import { departmentsClient } from "../clients/departmentsClient.js";
import { internsClient } from "../clients/internsClient.js";

export const listPositions = (departmentId, { limit, offset } = {}) =>
  listRows("positions", { where: departmentId ? { department_id: departmentId } : {}, orderBy: "id", orderDir: "ASC", limit, offset });
export const getPosition = (id) => getRow("positions", id);
export const createPosition = (data) =>
  insertRow("positions", {
    name: data.name,
    department_id: data.departmentId,
    default_manager_id: data.defaultManagerId ?? null,
    default_schedule_id: data.defaultScheduleId ?? null,
    default_location_id: data.defaultLocationId ?? null,
  });
export function updatePosition(id, data) {
  const columns = {};
  if (data.name !== undefined) columns.name = data.name;
  if (data.defaultManagerId !== undefined) columns.default_manager_id = data.defaultManagerId;
  if (data.defaultScheduleId !== undefined) columns.default_schedule_id = data.defaultScheduleId;
  if (data.defaultLocationId !== undefined) columns.default_location_id = data.defaultLocationId;
  if (data.active !== undefined) columns.active = data.active;
  return updateRow("positions", id, columns);
}

export const listLocations = ({ limit, offset } = {}) => listRows("locations", { orderBy: "id", orderDir: "ASC", limit, offset });
export const createLocation = (data) =>
  insertRow("locations", { name: data.name, type: data.type ?? "Office", address: data.address ?? null });

export const listSchedules = ({ limit, offset } = {}) => listRows("schedules", { orderBy: "id", orderDir: "ASC", limit, offset });
export const createSchedule = (data) =>
  insertRow("schedules", {
    name: data.name,
    working_days: JSON.stringify(data.workingDays ?? []),
    start_time: data.startTime,
    end_time: data.endTime,
    weekly_hours: data.weeklyHours ?? 40,
  });

export const listEmployeeTypes = ({ limit, offset } = {}) => listRows("employee_types", { orderBy: "id", orderDir: "ASC", limit, offset });
export const getEmployeeTypeByCode = (code) => getRow("employee_types", code, "code");
export const listDocumentTypes = ({ limit, offset } = {}) => listRows("document_types", { orderBy: "id", orderDir: "ASC", limit, offset });
export const listActivityTypes = ({ limit, offset } = {}) => listRows("activity_types", { orderBy: "id", orderDir: "ASC", limit, offset });

// Read-through to the external Department directory / Interns role catalog —
// nothing is cached or duplicated locally, so a rename there is instantly
// correct here (SS-13: a soft-referenced department_id/role_id, never a copy).
export const listExternalDepartments = (search) => departmentsClient.listDepartments(search);
export const getExternalDepartment = (id) => departmentsClient.getDepartment(id);
export const listExternalRoles = () => internsClient.listRoles();
