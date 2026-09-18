// Department Timeline bar colors are a pure local UI preference, never real department business
// data — the external Departments service (department-zeta.vercel.app) has no `color` field and
// is never written to from this app (its own client's own doc comment: department create/update
// belongs to the Department Management team, not this app). So unlike everything else that used
// to live in the mock departmentService.js, a color assignment genuinely belongs in browser
// storage, keyed by the department's real id — not routed through any department service at all.
const STORAGE_KEY = 'rizurf_department_colors_v1';

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Unavailable storage (private browsing, quota) just means colors won't persist — not fatal.
  }
}

export const departmentColorStore = {
  /** @returns {Object<string, string>} departmentId -> hex color */
  getAll() {
    return readAll();
  },

  /** @param {string} departmentId @param {string} color hex string */
  setColor(departmentId, color) {
    const map = readAll();
    map[departmentId] = color;
    writeAll(map);
  },
};
