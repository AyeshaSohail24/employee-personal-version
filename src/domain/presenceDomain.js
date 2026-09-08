import { resolveCurrentRecord } from './employmentDomain.js';

export const PRESENCE_STATES = {
  PRESENT: 'Present',
  REMOTE: 'Remote',
  ON_LEAVE: 'On Leave',
  ABSENT: 'Absent',
  NOT_SCHEDULED: 'Not Scheduled',
  UNKNOWN: 'Unknown',
};

export const PRESENCE_SOURCES = {
  MANUAL_OVERRIDE: 'Manual Override',
  APPROVED_LEAVE: 'Approved Leave',
  REMOTE_REQUEST: 'Remote Work Request',
  WORK_SCHEDULE: 'Work Schedule',
  SYSTEM: 'System Fallback',
};

/**
 * Resolves the operational Presence State for an employee on a given reference date.
 * Strictly adheres to the truthful presence resolution hierarchy:
 * 1. Active Manual HR Override -> Explicit overrideState
 * 2. Approved Leave -> On Leave
 * 3. Approved Remote Work Request -> Remote
 * 4. Work Schedule (non-working day -> Not Scheduled)
 * 5. System Fallback -> Unknown ("No current presence signal")
 *
 * NOTE: Scheduled working day + Office location does NOT derive Present.
 * Present and Absent cannot be derived automatically without attendance check-in logs;
 * they are asserted exclusively via HR Manual Override.
 *
 * @param {string} employeeId
 * @param {Array<Object>} employees
 * @param {Array<Object>} records
 * @param {Array<Object>} leaves
 * @param {Array<Object>} presenceOverrides
 * @param {Array<Object>} schedules
 * @param {Array<Object>} remoteRequests
 * @param {string} referenceDate Format 'YYYY-MM-DD', defaults to '2026-09-03'
 * @returns {Object} { state: string, source: string, details: Object|null }
 */
export function resolvePresenceState(
  employeeId,
  employees = [],
  records = [],
  leaves = [],
  presenceOverrides = [],
  schedules = [],
  remoteRequests = [],
  referenceDate = '2026-09-03'
) {
  // 1. Active Manual Override
  const activeOverride = (presenceOverrides || []).find(
    (o) => o.employeeId === employeeId && o.active === true
  );
  if (activeOverride) {
    return {
      state: activeOverride.overrideState,
      source: PRESENCE_SOURCES.MANUAL_OVERRIDE,
      details: {
        reason: activeOverride.reason,
        createdBy: activeOverride.createdBy,
        createdAt: activeOverride.createdAt,
        overrideId: activeOverride.id,
      },
    };
  }

  // 2. Approved Leave
  const approvedLeave = (leaves || []).find(
    (l) =>
      l.employeeId === employeeId &&
      l.status === 'Approved' &&
      l.startDate <= referenceDate &&
      l.endDate >= referenceDate
  );
  if (approvedLeave) {
    return {
      state: PRESENCE_STATES.ON_LEAVE,
      source: PRESENCE_SOURCES.APPROVED_LEAVE,
      details: {
        leaveType: approvedLeave.leaveType,
        reason: approvedLeave.reason,
        startDate: approvedLeave.startDate,
        endDate: approvedLeave.endDate,
      },
    };
  }

  // 3. Approved Remote Work Request
  const remoteReq = (remoteRequests || []).find(
    (r) =>
      r.employeeId === employeeId &&
      r.status === 'Approved' &&
      r.date === referenceDate
  );
  if (remoteReq) {
    return {
      state: PRESENCE_STATES.REMOTE,
      source: PRESENCE_SOURCES.REMOTE_REQUEST,
      details: { reason: remoteReq.reason },
    };
  }

  // 4. Work Schedule (Check for Non-Working Days)
  const currentRec = resolveCurrentRecord(employeeId, records, referenceDate);
  if (currentRec && currentRec.scheduleId) {
    const sched = (schedules || []).find((s) => s.id === currentRec.scheduleId);
    if (sched && sched.workingDays) {
      // Determine day of week for referenceDate
      const dateObj = new Date(referenceDate + 'T00:00:00Z');
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayOfWeek = dayNames[dateObj.getUTCDay()];

      const isWorkingDay = sched.workingDays.includes(dayOfWeek);

      if (!isWorkingDay) {
        return {
          state: PRESENCE_STATES.NOT_SCHEDULED,
          source: PRESENCE_SOURCES.WORK_SCHEDULE,
          details: { scheduleName: sched.name, dayOfWeek },
        };
      }
    }
  }

  // 5. System Fallback -> Unknown (Scheduled working day without explicit operational signal)
  return {
    state: PRESENCE_STATES.UNKNOWN,
    source: PRESENCE_SOURCES.SYSTEM,
    details: { note: 'No current presence signal' },
  };
}
