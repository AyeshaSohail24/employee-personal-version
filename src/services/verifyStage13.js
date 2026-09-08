import { configurationService } from './configurationService.js';
import { scheduleService } from './scheduleService.js';
import {
  validateSchedule,
  calculateScheduleReferences,
  canUserMutate,
  SUPPORTED_DAYS,
} from '../domain/configurationDomain.js';
import { loadDatabase } from '../mock-data/storageEngine.js';

export async function verifyStage13() {
  console.log('=== RUNNING STAGE 13 VERIFICATION SUITE ===');
  const results = [];

  const assert = (condition, title, details = '') => {
    if (condition) {
      console.log(`✅ [PASS] ${title}`);
      results.push({ title, status: 'PASS', details });
    } else {
      console.error(`❌ [FAIL] ${title} - ${details}`);
      results.push({ title, status: 'FAIL', details });
    }
  };

  try {
    const db = loadDatabase();

    // 1. Domain Validation & Purity Verification
    assert(Array.isArray(SUPPORTED_DAYS) && SUPPORTED_DAYS.length === 7, 'SUPPORTED_DAYS contains all 7 days of the week');

    // Name Validation
    const valName = validateSchedule({ name: '', workingDays: ['Monday'], startTime: '09:00', endTime: '18:00', weeklyHours: 40 });
    assert(valName.isValid === false && valName.errors.name !== undefined, 'validateSchedule rejects empty name');

    // Working Days Validation
    const valDays = validateSchedule({ name: 'Shift A', workingDays: [], startTime: '09:00', endTime: '18:00', weeklyHours: 40 });
    assert(valDays.isValid === false && valDays.errors.workingDays !== undefined, 'validateSchedule rejects empty workingDays');

    // Time Format Validation
    const valTime = validateSchedule({ name: 'Shift B', workingDays: ['Monday'], startTime: '9am', endTime: '18:00', weeklyHours: 40 });
    assert(valTime.isValid === false && valTime.errors.startTime !== undefined, 'validateSchedule rejects invalid startTime format');

    // Weekly Hours Validation
    const valHours = validateSchedule({ name: 'Shift C', workingDays: ['Monday'], startTime: '09:00', endTime: '18:00', weeklyHours: 0 });
    assert(valHours.isValid === false && valHours.errors.weeklyHours !== undefined, 'validateSchedule rejects non-positive weeklyHours');

    // 2. Role Authorization Verification
    let managerError = null;
    try {
      await configurationService.createSchedule({ name: 'Manager Shift', workingDays: ['Monday'], startTime: '09:00', endTime: '17:00', weeklyHours: 40 }, 'Manager');
    } catch (err) {
      managerError = err;
    }
    assert(managerError !== null && managerError.message.includes('Unauthorized'), 'Service-level authorization rejects Manager schedule mutations');

    let employeeError = null;
    try {
      await configurationService.createSchedule({ name: 'Employee Shift', workingDays: ['Monday'], startTime: '09:00', endTime: '17:00', weeklyHours: 40 }, 'Employee');
    } catch (err) {
      employeeError = err;
    }
    assert(employeeError !== null && employeeError.message.includes('Unauthorized'), 'Service-level authorization rejects Employee schedule mutations');

    // 3. Initial Baseline Master Data Verification
    const initialSchedules = await scheduleService.getAll();
    assert(initialSchedules.length >= 4, 'Baseline work schedules present (at least 4: sched-1 through sched-4)');
    const sched1 = initialSchedules.find((s) => s.id === 'sched-1');
    assert(sched1 && sched1.name === 'Standard Office Schedule', 'sched-1 baseline name verified');
    assert(sched1.weeklyHours === 40, 'sched-1 explicit weeklyHours verified as 40');

    // Duplicate Name Rejection
    let dupNameErr = null;
    try {
      await configurationService.createSchedule(
        { name: initialSchedules[0].name, workingDays: ['Monday'], startTime: '09:00', endTime: '17:00', weeklyHours: 35 },
        'HR Admin'
      );
    } catch (err) {
      dupNameErr = err;
    }
    assert(dupNameErr !== null, 'Schedule duplicate name rejection (case-insensitive)');

    // 4. Reference Calculation & Referential Integrity
    const sched1RefCheck = calculateScheduleReferences('sched-1', db);
    assert(sched1RefCheck.totalReferences > 0, `sched-1 has employment history references (${sched1RefCheck.totalReferences} refs)`);

    // Attempt Delete Referenced Schedule -> Must fail
    let deleteReferencedErr = null;
    try {
      await configurationService.deleteSchedule('sched-1', 'HR Admin');
    } catch (err) {
      deleteReferencedErr = err;
    }
    assert(deleteReferencedErr !== null && deleteReferencedErr.message.includes('Cannot delete work schedule'), 'Referential integrity blocks deletion of referenced schedule');

    // 5. Full CRUD & Deactivation Workflow
    const newSchedule = await configurationService.createSchedule(
      {
        name: 'Flexible Part-Time Shift (Mon-Wed)',
        workingDays: ['Monday', 'Tuesday', 'Wednesday'],
        startTime: '10:00',
        endTime: '15:00',
        weeklyHours: 15,
      },
      'HR Admin'
    );
    assert(newSchedule && newSchedule.id.startsWith('sched-'), 'Work schedule creation succeeds with generated collision-checked ID');
    assert(newSchedule.weeklyHours === 15, 'Created schedule explicit weeklyHours correctly set to 15');

    // Update Schedule
    const updatedSchedule = await configurationService.updateSchedule(
      newSchedule.id,
      {
        name: 'Flexible Part-Time Shift (Mon-Wed Updated)',
        workingDays: ['Monday', 'Tuesday', 'Wednesday'],
        startTime: '10:00',
        endTime: '16:00',
        weeklyHours: 18,
      },
      'HR Admin'
    );
    assert(updatedSchedule.name.includes('Updated'), 'Work schedule update succeeds');
    assert(updatedSchedule.weeklyHours === 18, 'Updated explicit weeklyHours set to 18');

    // Toggle Active Status
    const toggled = await configurationService.toggleScheduleActive(newSchedule.id, 'HR Admin');
    assert(toggled.active === false, 'Deactivating work schedule succeeds');

    const toggledBack = await configurationService.toggleScheduleActive(newSchedule.id, 'HR Admin');
    assert(toggledBack.active === true, 'Reactivating work schedule succeeds');

    // Delete Unreferenced Schedule
    const deleted = await configurationService.deleteSchedule(newSchedule.id, 'HR Admin');
    assert(deleted === true, 'Deleting unreferenced work schedule succeeds');

    const postDeleteSchedules = await scheduleService.getAll();
    assert(postDeleteSchedules.find((s) => s.id === newSchedule.id) === undefined, 'Deleted schedule no longer present in storage');

    // 6. Config Orchestrator Verification
    const presenceConfig = await configurationService.getPresenceConfig();
    assert(Array.isArray(presenceConfig.schedules), 'getPresenceConfig returns schedules array');
    assert(presenceConfig.schedules.every((s) => typeof s.totalReferences === 'number' && typeof s.canDelete === 'boolean'), 'Presence config enriches items with totalReferences and canDelete flag');

    const failures = results.filter((r) => r.status === 'FAIL');
    console.log(`=== STAGE 13 VERIFICATION COMPLETE: ${results.length - failures.length}/${results.length} PASSED ===`);

    if (failures.length > 0) {
      throw new Error(`Stage 13 Verification Failed with ${failures.length} failure(s).`);
    }

    return { success: true, results };
  } catch (err) {
    console.error('❌ Stage 13 Verification Fatal Error:', err);
    return { success: false, error: err.message, results };
  }
}
