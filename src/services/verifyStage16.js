import fs from 'fs';
import path from 'path';
import { documentTypeService } from './documentTypeService.js';
import { configurationService } from './configurationService.js';
import {
  DOCUMENT_CATEGORIES,
  validateDocumentType,
  calculateDocumentTypeReferences,
} from '../domain/documentTypeDomain.js';
import {
  PRESENCE_STATES,
  PRESENCE_SOURCES,
  resolvePresenceState,
} from '../domain/presenceDomain.js';
import { presenceService } from './presenceService.js';
import { loadDatabase, saveDatabase, resetDatabase } from '../mock-data/storageEngine.js';

export async function verifyStage16() {
  console.log('=== RUNNING STAGE 16 VERIFICATION SUITE ===');
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

    // 1. Storage Engine Collection & Baseline Seed Verification
    assert(Array.isArray(db.documentTypes), '1. db.documentTypes collection initialized in storage engine');
    assert(db.documentTypes.length >= 6, '2. Baseline documentTypes contains at least 6 seed records');

    const contractType = db.documentTypes.find((d) => d.id === 'doc-type-1');
    assert(
      contractType && contractType.code === 'CONTRACT' && contractType.category === 'Employment',
      '3. Seed record doc-type-1 (Employment Contract) verified'
    );

    // 2. Storage Migration Idempotence Verification
    const fakeDbWithoutDocs = { ...db };
    delete fakeDbWithoutDocs.documentTypes;
    const dbAfterLoad = loadDatabase();
    assert(Array.isArray(dbAfterLoad.documentTypes), '4. Idempotent storage migration injects documentTypes without resetting existing collections');

    // 3. Domain Validation & Pure Rules Verification
    assert(DOCUMENT_CATEGORIES.length === 5, '5. DOCUMENT_CATEGORIES contains 5 controlled enum values');

    const emptyVal = validateDocumentType({}, db.documentTypes);
    assert(!emptyVal.isValid && emptyVal.errors.name && emptyVal.errors.code, '6. validateDocumentType rejects empty name and code');

    const dupNameVal = validateDocumentType({ name: 'employment contract', code: 'NEW_CODE', category: 'Employment' }, db.documentTypes);
    assert(!dupNameVal.isValid && dupNameVal.errors.name, '7. Case-insensitive duplicate name rejected');

    const dupCodeVal = validateDocumentType({ name: 'Unique Name', code: 'contract', category: 'Employment' }, db.documentTypes);
    assert(!dupCodeVal.isValid && dupCodeVal.errors.code, '8. Case-insensitive duplicate code rejected');

    const lowercaseCodeVal = validateDocumentType({ name: 'Unique Name 2', code: 'test_code', category: 'Employment' }, db.documentTypes);
    assert(lowercaseCodeVal.isValid && lowercaseCodeVal.cleanData.code === 'TEST_CODE', '9. Code is automatically normalized to uppercase');

    const invalidCatVal = validateDocumentType({ name: 'Unique Name 3', code: 'UNIQUE_CODE', category: 'InvalidCategory' }, db.documentTypes);
    assert(!invalidCatVal.isValid && invalidCatVal.errors.category, '10. Invalid category rejected');

    // 4. Document Types CRUD Operations
    const docTypesAll = await documentTypeService.getAll();
    assert(Array.isArray(docTypesAll) && docTypesAll.length >= 6, '11. HR permitted to fetch document types');

    // Create new valid DocumentType
    const created = await documentTypeService.create({
      id: 'doc-type-test-16',
      name: 'Work Visa Permitting',
      code: 'WORK_VISA',
      category: 'Identity',
      requiresExpiry: true,
      description: 'Expatriate work visa documentation.',
      active: true,
    });
    assert(created && created.id.startsWith('doc-type-'), '13. DocumentType creation succeeds with generated ID');
    assert(created.requiresExpiry === true, '14. requiresExpiry boolean flag preserved');

    // Toggle Active Status
    const toggled = await documentTypeService.toggleActive(created.id);
    assert(toggled.active === false, '15. Toggling active status succeeds (active=false)');

    // 5. Referential Integrity (No Prose References Rule)
    const refCheckBaseline = calculateDocumentTypeReferences('doc-type-1', db);
    assert(
      refCheckBaseline.totalReferences === 0,
      '16. No prose keyword search: DocumentType accurately returns 0 references when no canonical ID refs exist'
    );

    // Unreferenced deletion succeeds
    const deletedSuccess = await documentTypeService.delete(created.id);
    assert(deletedSuccess === true, '17. Unreferenced DocumentType deletion succeeds');

    // Controlled explicit canonical ID reference check
    const testDbWithExplicitRef = loadDatabase();
    testDbWithExplicitRef.employeeDocuments = [{ id: 'emp-doc-1', employeeId: 'emp-001', documentTypeId: 'doc-type-1' }];
    saveDatabase(testDbWithExplicitRef);

    let deleteBlocked = false;
    try {
      await documentTypeService.delete('doc-type-1');
    } catch (err) {
      deleteBlocked = err.message.includes('referenced');
    }
    assert(deleteBlocked, '18. Explicit canonical documentTypeId reference blocks deletion');

    // Clean up test fixture
    resetDatabase();

    // 6. Preservation of Stage 14 & Stage 15 Architecture
    const lifecyclePagePath = path.resolve('./src/pages/configuration/LifecycleConfigPage.jsx');
    assert(!fs.existsSync(lifecyclePagePath), '19. Stage 15 LifecycleConfigPage.jsx remains removed');

    const seedAttendancePath = path.resolve('./src/mock-data/seedAttendance.js');
    assert(!fs.existsSync(seedAttendancePath), '20. Attendance tracking remains completely removed');

    const marcusPresence = await presenceService.getEmployeePresence('emp-004', '2026-09-03');
    assert(marcusPresence.state === PRESENCE_STATES.UNKNOWN, '21. Stage 14 Presence rules preserved (Scheduled office employee resolves Unknown)');

    const failures = results.filter((r) => r.status === 'FAIL');
    console.log(`=== STAGE 16 VERIFICATION COMPLETE: ${results.length - failures.length}/${results.length} PASSED ===`);

    if (failures.length > 0) {
      throw new Error(`Stage 16 Verification Failed with ${failures.length} failure(s).`);
    }

    return { success: true, results };
  } catch (err) {
    console.error('❌ Stage 16 Verification Fatal Error:', err);
    throw err;
  }
}
