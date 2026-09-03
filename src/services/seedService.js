import { resetDatabase } from '../mock-data/storageEngine.js';

/**
 * Service providing dataset reset capabilities for PoC demonstration testing.
 */
export const seedService = {
  /**
   * Resets localStorage dataset back to original seed data.
   * @returns {Promise<boolean>} Success indicator
   */
  async resetToSeedData() {
    resetDatabase();
    return true;
  },
};
