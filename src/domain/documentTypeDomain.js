/**
 * Pure domain logic and validation for DocumentType entities.
 * Strict Rule: 100% pure functions. No React, no localStorage, no mock-data imports, no service calls.
 */

export const DOCUMENT_CATEGORIES = [
  'Employment',
  'Identity',
  'Compliance',
  'Qualifications',
  'Offboarding',
];

/**
 * Validates a DocumentType record for creation or update.
 *
 * @param {Object} data - Input payload (name, code, category, requiresExpiry, description, active)
 * @param {Array} existingTypes - List of current DocumentType records in the database
 * @param {string} [currentId] - Optional current ID when editing an existing record
 * @returns {Object} { isValid: boolean, errors: Object, cleanData: Object }
 */
export function validateDocumentType(data = {}, existingTypes = [], currentId = null) {
  const errors = {};

  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const rawCode = typeof data.code === 'string' ? data.code.trim() : '';
  const code = rawCode.toUpperCase();
  const category = typeof data.category === 'string' ? data.category.trim() : '';
  const requiresExpiry = Boolean(data.requiresExpiry);
  const description = typeof data.description === 'string' ? data.description.trim() : '';
  const active = data.active !== undefined ? Boolean(data.active) : true;

  // 1. Name validation
  if (!name) {
    errors.name = 'Document type name is required.';
  } else {
    const nameLower = name.toLowerCase();
    const isDuplicateName = existingTypes.some(
      (t) => t.id !== currentId && t.name && t.name.trim().toLowerCase() === nameLower
    );
    if (isDuplicateName) {
      errors.name = `A document type with the name "${name}" already exists.`;
    }
  }

  // 2. Code validation
  if (!code) {
    errors.code = 'Document type code is required.';
  } else {
    const codeUpper = code.toUpperCase();
    const isDuplicateCode = existingTypes.some(
      (t) => t.id !== currentId && t.code && t.code.trim().toUpperCase() === codeUpper
    );
    if (isDuplicateCode) {
      errors.code = `A document type with code "${code}" already exists.`;
    }
  }

  // 3. Category validation
  if (!category) {
    errors.category = 'Document category is required.';
  } else if (!DOCUMENT_CATEGORIES.includes(category)) {
    errors.category = `Invalid category. Must be one of: ${DOCUMENT_CATEGORIES.join(', ')}.`;
  }

  const isValid = Object.keys(errors).length === 0;

  const cleanData = {
    name,
    code,
    category,
    requiresExpiry,
    description,
    active,
  };

  return { isValid, errors, cleanData };
}

/**
 * Calculates canonical referential integrity for a DocumentType entity.
 * Strict Rule: Inspects ONLY explicit canonical `documentTypeId` references.
 * DO NOT search prose, task descriptions, or keywords.
 *
 * @param {string} id - The DocumentType ID to check
 * @param {Object} db - The full database object
 * @returns {Object} { totalReferences: number, summary: string, canDelete: boolean }
 */
export function calculateDocumentTypeReferences(id, db = {}) {
  if (!id || !db) {
    return { totalReferences: 0, summary: '0 operational references', canDelete: true };
  }

  let totalReferences = 0;

  // 1. Check explicit employee document records (if any explicit documentTypeId field exists)
  if (Array.isArray(db.employeeDocuments)) {
    const empDocRefs = db.employeeDocuments.filter((d) => d && d.documentTypeId === id).length;
    totalReferences += empDocRefs;
  }

  // 2. Check explicit onboarding task template requirements (if explicit documentTypeId exists)
  if (Array.isArray(db.onboardingPlanTasks)) {
    const onboardingTaskRefs = db.onboardingPlanTasks.filter((t) => t && t.documentTypeId === id).length;
    totalReferences += onboardingTaskRefs;
  }

  // 3. Check explicit offboarding task template requirements (if explicit documentTypeId exists)
  if (Array.isArray(db.offboardingPlanTasks)) {
    const offboardingTaskRefs = db.offboardingPlanTasks.filter((t) => t && t.documentTypeId === id).length;
    totalReferences += offboardingTaskRefs;
  }

  const summary = totalReferences === 0 ? '0 operational references' : `${totalReferences} explicit reference(s)`;

  return {
    totalReferences,
    summary,
    canDelete: totalReferences === 0,
  };
}
