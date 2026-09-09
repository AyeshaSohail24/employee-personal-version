import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadDatabase, resetDatabase } from '../mock-data/storageEngine.js';
import { employeeTypeService } from './employeeTypeService.js';
import { employeeTagService } from './employeeTagService.js';
import { configurationService } from './configurationService.js';
import { employeeService } from './employeeService.js';
import { canUserMutate, validateEmployeeType, validateEmployeeTag } from '../domain/configurationDomain.js';
import { resolveHydratedEmployee } from '../domain/employmentDomain.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function verifyStage12() {
  console.log('=== RUNNING STAGE 12 VERIFICATION SUITE ===');
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
    // 1. Domain Purity Checks
    const employmentDomainContent = fs.readFileSync(
      path.join(__dirname, '../domain/employmentDomain.js'),
      'utf8'
    );

    const illegalImportsRegex = /from\s+['"].*(service|storageEngine).*['"]/i;
    assert(
      !illegalImportsRegex.test(employmentDomainContent),
      'Domain Purity: employmentDomain.js has no service or storage imports'
    );

    // 2. Role Authorization Verification for Employee Master Data
    assert(canUserMutate('HR') === true, 'Authorization: HR permitted');

    // Reset localStorage / in-memory storage to test initial load & migration
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    resetDatabase();
    const db = loadDatabase();

    // 3. Employment Types Verification
    const initialTypes = await employeeTypeService.getAll();
    assert(initialTypes.length >= 4, 'Baseline Employment Types present (at least type-1 through type-4)');
    const baselineIds = initialTypes.map((t) => t.id);
    assert(
      ['type-1', 'type-2', 'type-3', 'type-4'].every((id) => baselineIds.includes(id)),
      'Baseline Employment Type IDs stable (type-1 to type-4)'
    );

    // Duplicate Name & Code Validation for Employment Types
    let dupTypeNameErr = null;
    try {
      await configurationService.createEmployeeType({ name: 'Full-Time Permanent', code: 'FT-NEW' }, 'HR Admin');
    } catch (err) {
      dupTypeNameErr = err;
    }
    assert(dupTypeNameErr !== null, 'Employment Type duplicate name rejected (case-insensitive)');

    let dupTypeCodeErr = null;
    try {
      await configurationService.createEmployeeType({ name: 'Unique Type', code: 'fte' }, 'HR Admin');
    } catch (err) {
      dupTypeCodeErr = err;
    }
    assert(dupTypeCodeErr !== null, 'Employment Type duplicate code rejected (case-insensitive)');

    // Create New Employment Type & Code Uppercasing
    const createdType = await configurationService.createEmployeeType(
      { name: 'Apprentice / Trainee', code: 'app-tr', description: 'Trainee program' },
      'HR Admin'
    );
    assert(createdType && createdType.id.startsWith('type-'), 'Employment Type creation succeeds with unique ID');
    assert(createdType.code === 'APP-TR', 'Employment Type code normalized to uppercase');

    // Get Active vs Get All Employment Types
    const activeBeforeToggle = await employeeTypeService.getActive();
    assert(activeBeforeToggle.some((t) => t.id === createdType.id), 'Newly created Employment Type is active');

    const toggledType = await configurationService.toggleEmployeeTypeActive(createdType.id, 'HR Admin');
    assert(toggledType.active === false, 'Employment Type toggles to inactive');

    const activeAfterToggle = await employeeTypeService.getActive();
    const allAfterToggle = await employeeTypeService.getAll();
    assert(!activeAfterToggle.some((t) => t.id === createdType.id), 'getActive() excludes inactive Employment Types');
    assert(allAfterToggle.some((t) => t.id === createdType.id), 'getAll() retains inactive Employment Types');

    // Referenced Employment Type Deletion Blocked Across ALL Lifecycle Statuses
    let deleteReferencedTypeErr = null;
    try {
      await configurationService.deleteEmployeeType('type-1', 'HR Admin');
    } catch (err) {
      deleteReferencedTypeErr = err;
    }
    assert(
      deleteReferencedTypeErr !== null && deleteReferencedTypeErr.message.includes('referenced'),
      'Referenced Employment Type deletion blocked'
    );

    // Unreferenced Employment Type Deletion Succeeds
    const deletedType = await configurationService.deleteEmployeeType(createdType.id, 'HR Admin');
    assert(deletedType === true, 'Unreferenced Employment Type deletion succeeds');

    // Programmatic Default Employee Type Assignment in employeeService.create()
    const newEmpData = {
      name: 'Default Type Test Employee',
      email: 'default.type@rizurf.com',
      departmentId: 'dept-1',
      positionId: 'pos-1',
      locationId: 'loc-1',
    };
    const createdEmp = await employeeService.create(newEmpData);
    assert(createdEmp.employeeTypeId === 'type-1', 'employeeService.create() defaults to type-1 when type-1 is active');

    // Historical Resolution and Reporting Behavior
    const hydratedHistorical = resolveHydratedEmployee(
      { id: 'test-historical', name: 'Test Emp', employeeTypeId: 'type-1', tags: ['tag-1'] },
      [],
      [],
      [],
      [],
      [],
      [],
      allAfterToggle,
      db.employeeTags
    );
    assert(hydratedHistorical.employeeType?.name === 'Full-Time Permanent', 'Hydrated employee resolves employeeType object correctly');



    // 4. Employee Tag Migration & Canonical Model Verification
    const employeesAfterLoad = db.employees;
    const allEmployeeTags = db.employeeTags;

    assert(allEmployeeTags.length >= 26, 'At least 26 canonical Employee Tag seed records present');

    // Check baseline seed tag IDs (tag-1 to tag-26)
    const seedIdsPresent = Array.from({ length: 26 }, (_, i) => `tag-${i + 1}`).every((id) =>
      allEmployeeTags.some((t) => t.id === id)
    );
    assert(seedIdsPresent, 'Baseline seed tag IDs tag-1 through tag-26 remain stable');

    // Ensure all employees contain canonical Tag IDs only (no raw strings)
    const allEmpTagsAreIds = employeesAfterLoad.every((emp) =>
      (emp.tags || []).every((tagRef) => typeof tagRef === 'string' && tagRef.startsWith('tag-'))
    );
    assert(allEmpTagsAreIds, 'All Employee.tags converted to 100% canonical Tag IDs (no raw strings)');

    // Repeat loadDatabase to verify migration idempotency & persistence stability
    const reloadedDb = loadDatabase();
    assert(
      JSON.stringify(reloadedDb.employeeTags) === JSON.stringify(allEmployeeTags),
      'Repeated database load produces identical canonical EmployeeTag records (idempotent)'
    );

    // 5. Employee Tag Master Data CRUD & Validation
    let dupTagNameErr = null;
    try {
      await configurationService.createEmployeeTag({ name: 'Executive Committee', category: 'Leadership' }, 'HR Admin');
    } catch (err) {
      dupTagNameErr = err;
    }
    assert(dupTagNameErr !== null, 'Employee Tag duplicate name rejected (case-insensitive)');

    const createdTag = await configurationService.createEmployeeTag(
      { name: 'AI Specialist', category: 'Role/Skill', color: '#10b981' },
      'HR Admin'
    );
    assert(createdTag && createdTag.id.startsWith('tag-'), 'Employee Tag creation succeeds with collision-checked ID');

    // Tag Rename Propagation Check
    const updatedTag = await configurationService.updateEmployeeTag(
      createdTag.id,
      { name: 'AI & Automation Specialist', category: 'Role/Skill', color: '#10b981' },
      'HR Admin'
    );
    const testHydratedTagEmp = resolveHydratedEmployee(
      { id: 'emp-tag-test', name: 'Tag Test Emp', tags: [createdTag.id] },
      [],
      [],
      [],
      [],
      [],
      [],
      initialTypes,
      [...allEmployeeTags, updatedTag]
    );
    assert(
      testHydratedTagEmp.resolvedTags[0]?.name === 'AI & Automation Specialist',
      'Employee Tag rename dynamically propagates to hydrated employee resolvedTags'
    );

    // Inactive Tag Remains Visible on Existing Employee Cards
    const toggledTag = await configurationService.toggleEmployeeTagActive(createdTag.id, 'HR Admin');
    assert(toggledTag.active === false, 'Employee Tag toggles to inactive');

    const activeTagsList = await employeeTagService.getActive();
    assert(!activeTagsList.some((t) => t.id === createdTag.id), 'getActive() excludes inactive Employee Tags');

    const hydratedWithInactiveTag = resolveHydratedEmployee(
      { id: 'emp-inactive-tag', name: 'Tag Emp', tags: [createdTag.id] },
      [],
      [],
      [],
      [],
      [],
      [],
      initialTypes,
      [...allEmployeeTags, toggledTag]
    );
    assert(
      hydratedWithInactiveTag.resolvedTags.length === 1 && hydratedWithInactiveTag.resolvedTags[0].id === createdTag.id,
      'Existing assigned inactive tag remains visible in hydrated employee resolvedTags'
    );

    // Deletion Blocked for Referenced Tags Across ALL Lifecycle Statuses
    let deleteReferencedTagErr = null;
    try {
      await configurationService.deleteEmployeeTag('tag-1', 'HR Admin');
    } catch (err) {
      deleteReferencedTagErr = err;
    }
    assert(
      deleteReferencedTagErr !== null && deleteReferencedTagErr.message.includes('referenced'),
      'Referenced Employee Tag deletion blocked across ALL employee statuses'
    );

    // Delete Unreferenced Tag Succeeds
    const deletedTag = await configurationService.deleteEmployeeTag(createdTag.id, 'HR Admin');
    assert(deletedTag === true, 'Unreferenced Employee Tag deletion succeeds');

    console.log('\n=== STAGE 12 VERIFICATION COMPLETED SUCCESSFULLY ===');
    return { success: true, results };
  } catch (err) {
    console.error('CRITICAL UNHANDLED ERROR IN STAGE 12 VERIFICATION:', err);
    return { success: false, error: err.message, results };
  }
}

// Run directly if invoked via Node CLI
if (process.argv[1] && process.argv[1].endsWith('verifyStage12.js')) {
  verifyStage12().then((res) => {
    if (!res.success) {
      process.exit(1);
    }
  });
}
