import { configurationService } from './configurationService.js';
import { departmentService } from './departmentService.js';
import { positionService } from './positionService.js';
import { locationService } from './locationService.js';
import { activityTypeService } from './activityTypeService.js';
import {
  validateDepartment,
  validatePosition,
  validateLocation,
  validateActivityType,
  generateUniqueId,
  calculateDepartmentReferences,
  calculatePositionReferences,
  calculateLocationReferences,
  calculateActivityTypeReferences,
  canUserMutate,
} from '../domain/configurationDomain.js';
import { loadDatabase } from '../mock-data/storageEngine.js';

export async function verifyStage11() {
  console.log('=== RUNNING STAGE 11 VERIFICATION SUITE ===');
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

    // 1. Role Authorization Verification
    assert(canUserMutate('HR') === true, 'Role Authorization: HR permitted');

    // 2. Department Administration & Validation
    const initialDepts = await departmentService.getAll();
    assert(initialDepts.length >= 8, 'Initial canonical departments present (at least 8)');

    // Duplicate Name Rejection
    let dupNameErr = null;
    try {
      await configurationService.createDepartment({ name: initialDepts[0].name, code: 'NEWC' }, 'HR Admin');
    } catch (err) {
      dupNameErr = err;
    }
    assert(dupNameErr !== null, 'Department duplicate name rejection (case-insensitive)');

    // Duplicate Code Rejection & Code Uppercasing
    let dupCodeErr = null;
    try {
      await configurationService.createDepartment({ name: 'Unique Dept', code: initialDepts[0].code }, 'HR Admin');
    } catch (err) {
      dupCodeErr = err;
    }
    assert(dupCodeErr !== null, 'Department duplicate code rejection (case-insensitive)');

    // Flat Department validation
    const mockDeptRes = validateDepartment({ name: 'Flat Dept', code: 'FLAT' }, initialDepts);
    assert(mockDeptRes.isValid === true, 'Flat department validation succeeds without parent department');

    // Create New Department
    const newDept = await configurationService.createDepartment(
      { name: 'Transformation & AI', code: 'tai', color: '#8b5cf6' },
      'HR Admin'
    );
    assert(newDept && newDept.id.startsWith('dept-'), 'Department creation succeeds with collision-checked ID');
    assert(newDept.code === 'TAI', 'Department code normalized to uppercase');

    // Edit Department
    const updatedDept = await configurationService.updateDepartment(
      newDept.id,
      { name: 'Transformation & Artificial Intelligence', code: 'TAI' },
      'HR Admin'
    );
    assert(updatedDept.name === 'Transformation & Artificial Intelligence', 'Department edit succeeds');

    // Referenced Department Deletion Blocking
    let deleteReferencedDeptErr = null;
    try {
      await configurationService.deleteDepartment('dept-1', 'HR Admin');
    } catch (err) {
      deleteReferencedDeptErr = err;
    }
    assert(
      deleteReferencedDeptErr !== null && deleteReferencedDeptErr.message.includes('Deactivate it instead'),
      'Referenced Department deletion blocked with Deactivate prompt'
    );

    // Unreferenced Department Deletion Permitted
    const unrefDept = await configurationService.createDepartment(
      { name: 'Temporary Dept', code: 'TMP' },
      'HR Admin'
    );
    const deleteSuccess = await configurationService.deleteDepartment(unrefDept.id, 'HR Admin');
    assert(deleteSuccess === true, 'Unreferenced Department deletion succeeds');

    // Deactivation & Active vs Inactive Selection
    await configurationService.toggleDepartmentActive(newDept.id, 'HR Admin');
    const allDepts = await departmentService.getAll();
    const activeDepts = await departmentService.getActive();
    assert(allDepts.some((d) => d.id === newDept.id && d.active === false), 'Deactivated department retained in getAll() with active=false');
    assert(!activeDepts.some((d) => d.id === newDept.id), 'Deactivated department excluded from getActive() selection');

    // 3. Job Positions Administration
    const initialPositions = await positionService.getAll();
    assert(initialPositions.length >= 15, 'Initial canonical job positions present (at least 15)');

    // Duplicate Position Title within Same Department
    let dupPosErr = null;
    try {
      await configurationService.createPosition(
        { name: initialPositions[0].name, departmentId: initialPositions[0].departmentId },
        'HR Admin'
      );
    } catch (err) {
      dupPosErr = err;
    }
    assert(dupPosErr !== null, 'Duplicate job position title within same department rejected');

    // Create New Job Position
    const newPos = await configurationService.createPosition(
      { name: 'AI Product Manager', departmentId: 'dept-1', defaultLocationId: 'loc-1' },
      'HR Admin'
    );
    assert(newPos && newPos.id.startsWith('pos-'), 'Job position creation succeeds with collision-checked ID');

    // Referenced Position Deletion Blocking
    let deleteReferencedPosErr = null;
    try {
      await configurationService.deletePosition('pos-1', 'HR Admin');
    } catch (err) {
      deleteReferencedPosErr = err;
    }
    assert(deleteReferencedPosErr !== null, 'Referenced Job Position deletion blocked');

    // Unreferenced Position Deletion
    const deletePosSuccess = await configurationService.deletePosition(newPos.id, 'HR Admin');
    assert(deletePosSuccess === true, 'Unreferenced Job Position deletion succeeds');

    // 4. Work Locations Administration
    const initialLocations = await locationService.getAll();
    assert(initialLocations.length >= 3, 'Initial canonical work locations present (at least 3)');

    // Remote Location Optional Address Validation
    const { isValid: remoteValid } = validateLocation({ name: 'Remote Hub', type: 'Remote', address: '' }, initialLocations);
    assert(remoteValid === true, 'Remote location address is optional');

    const { isValid: officeInvalid } = validateLocation({ name: 'New Office', type: 'Office', address: '' }, initialLocations);
    assert(officeInvalid === false, 'Physical office address is required');

    // Create Work Location
    const newLoc = await configurationService.createLocation(
      { name: 'Regional Tech Center', type: 'Branch', address: 'Tech Park, Shah Alam' },
      'HR Admin'
    );
    assert(newLoc && newLoc.id.startsWith('loc-'), 'Work location creation succeeds');

    // Referenced Location Deletion Blocking
    let deleteReferencedLocErr = null;
    try {
      await configurationService.deleteLocation('loc-1', 'HR Admin');
    } catch (err) {
      deleteReferencedLocErr = err;
    }
    assert(deleteReferencedLocErr !== null, 'Referenced Work Location deletion blocked');

    // Unreferenced Location Deletion
    const deleteLocSuccess = await configurationService.deleteLocation(newLoc.id, 'HR Admin');
    assert(deleteLocSuccess === true, 'Unreferenced Work Location deletion succeeds');

    // 5. Activity Types Administration
    const initialTypes = await activityTypeService.getAll();
    assert(initialTypes.length >= 6, 'Initial canonical activity types present (at least 6)');

    // Invalid Icon Name Validation
    const { isValid: invalidIconResult } = validateActivityType({ name: 'Invalid Type', category: 'General', icon: 'InvalidIconName' }, initialTypes);
    assert(invalidIconResult === false, 'Arbitrary invalid icon name rejected');

    // Create Activity Type
    const newType = await activityTypeService.create({
      id: generateUniqueId('act-type', initialTypes),
      name: 'Security Audit Review',
      category: 'Compliance',
      icon: 'ShieldAlert',
      active: true,
    });
    assert(newType && newType.id.startsWith('act-type-'), 'Activity type creation succeeds');

    // Referenced Activity Type Deletion Blocking
    let deleteReferencedTypeErr = null;
    try {
      await configurationService.deleteActivityType('act-type-1', 'HR Admin');
    } catch (err) {
      deleteReferencedTypeErr = err;
    }
    assert(deleteReferencedTypeErr !== null, 'Referenced Activity Type deletion blocked');

    // Unreferenced Activity Type Deletion
    const deleteTypeSuccess = await activityTypeService.delete(newType.id);
    assert(deleteTypeSuccess === true, 'Unreferenced Activity Type deletion succeeds');

    // 6. Rapid ID Generation Uniqueness & Baseline Seed Stability
    const rapidIds = new Set();
    const mockList = [...initialDepts];
    for (let i = 0; i < 20; i++) {
      const generated = generateUniqueId('dept', mockList);
      rapidIds.add(generated);
      mockList.push({ id: generated });
    }
    assert(rapidIds.size === 20, 'Rapid ID generation produces 20 distinct collision-checked IDs');

    // Baseline Seed IDs intact assertion
    const currentDb = loadDatabase();
    assert(currentDb.departments.some((d) => d.id === 'dept-1'), 'Baseline seed department dept-1 intact');
    assert(currentDb.positions.some((p) => p.id === 'pos-1'), 'Baseline seed position pos-1 intact');
    assert(currentDb.locations.some((l) => l.id === 'loc-1'), 'Baseline seed location loc-1 intact');
    assert(currentDb.activityTypes.some((t) => t.id === 'act-type-1'), 'Baseline seed activity type act-type-1 intact');

    console.log('=== STAGE 11 VERIFICATION COMPLETE ===');
    return { success: true, results };
  } catch (globalErr) {
    console.error('❌ Stage 11 Verification Suite Failed with Exception:', globalErr);
    return { success: false, error: globalErr.message, results };
  }
}
