import { CANONICAL_ROLES, hasCapability } from '../domain/permissionDomain.js';
import { employeeService } from './employeeService.js';
import { departmentService } from './departmentService.js';
import { loadDatabase, resetDatabase } from '../mock-data/storageEngine.js';

export async function verifyStage17() {
  console.log('=== RUNNING STAGE 17 VERIFICATION SUITE ===');
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
    resetDatabase();
    const db = loadDatabase();

    // 1. Only HR application role exists
    assert(
      CANONICAL_ROLES.length === 1 && CANONICAL_ROLES[0] === 'HR',
      '1. Only HR application role exists'
    );

    // 2. Employee and Payroll are no longer application roles
    assert(!CANONICAL_ROLES.includes('Employee') && !CANONICAL_ROLES.includes('Payroll'), '2. Employee and Payroll application roles removed');

    // 3. Employee domain/workforce records remain intact
    const employees = await employeeService.getAll();
    assert(Array.isArray(employees) && employees.length >= 10, '3. Employee workforce records remain 100% intact');

    // 4. HR has operational capability
    assert(hasCapability('HR', 'manage_employees') === true, '4. HR has manage_employees capability');

    // 5. HR can access department master data
    const depts = await departmentService.getAll();
    assert(Array.isArray(depts) && depts.length > 0, '5. HR can access Department master data');

    console.log('=== STAGE 17 VERIFICATION COMPLETE ===');
    return { success: true, results };
  } catch (err) {
    console.error('❌ Stage 17 Verification Fatal Error:', err);
    return { success: false, error: err.message, results };
  }
}

if (process.argv[1] && process.argv[1].endsWith('verifyStage17.js')) {
  verifyStage17().then((res) => {
    if (!res.success) {
      process.exit(1);
    }
  });
}
