import { loadDatabase, resetDatabase } from '../mock-data/storageEngine.js';

export async function runStage10Verification() {
  console.log('--- START STAGE 10 VERIFICATION (UPDATED FOR FINAL PRODUCT SIMPLIFICATION) ---');

  resetDatabase();
  const db = loadDatabase();

  const emps = db.employees || [];
  if (emps.length !== 18) {
    throw new Error(`Expected 18 workforce employee records, got ${emps.length}`);
  }

  console.log('✅ Stage 10 operational workforce dataset verified (18 employees intact).');
  return true;
}

