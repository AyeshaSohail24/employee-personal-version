import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';

export const AUDIT_ACTIONS = {
  ACTIVITY_CREATED: 'ACTIVITY_CREATED',
  ACTIVITY_UPDATED: 'ACTIVITY_UPDATED',
  ACTIVITY_COMPLETED: 'ACTIVITY_COMPLETED',
  ACTIVITY_REOPENED: 'ACTIVITY_REOPENED',
  PRESENCE_OVERRIDDEN: 'PRESENCE_OVERRIDDEN',
  PRESENCE_CLEARED: 'PRESENCE_CLEARED',
};

export const auditService = {
  /**
   * Appends an audit log entry to the audit trail.
   * 
   * @param {string} userId User ID performing the action
   * @param {string} action Action type constant
   * @param {string} entity Target entity type (e.g. 'Activity', 'Presence')
   * @param {string} entityId Primary key of target entity
   * @param {string} details Human-readable details
   * @returns {Promise<Object>} Created audit log record
   */
  async logAction(userId, action, entity, entityId, details) {
    const db = loadDatabase();
    const logs = db.auditLogs || [];

    const newLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: userId || 'system',
      action,
      entity,
      entityId,
      details,
      timestamp: new Date().toISOString(),
    };

    logs.push(newLog);
    db.auditLogs = logs;
    saveDatabase(db);

    return newLog;
  },

  /**
   * Retrieves audit logs for a specific entity.
   * 
   * @param {string} entity Entity type
   * @param {string} entityId Entity ID
   * @returns {Promise<Array<Object>>} Audit log history
   */
  async getEntityLogs(entity, entityId) {
    const db = loadDatabase();
    const logs = db.auditLogs || [];
    return logs
      .filter((l) => l.entity === entity && l.entityId === entityId)
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  },
};
