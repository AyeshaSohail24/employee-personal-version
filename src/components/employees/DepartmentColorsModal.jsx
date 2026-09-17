import React, { useState, useEffect } from 'react';
import { X, Palette, AlertCircle } from 'lucide-react';
import { departmentService } from '../../services/departmentService.js';
import { resolveDepartmentColor } from '../../domain/departmentDomain.js';

/**
 * Lets HR customize each Department's Timeline bar color. The color belongs to the DEPARTMENT
 * record itself (departmentService.update(id, { color })) — never to individual personnel —
 * so changing one department's color here updates every displayed Timeline bar for that
 * department at once, via the exact same resolveDepartmentColor() resolver the bars themselves
 * use. Persists through departmentService (this app's existing service/storage abstraction) —
 * never localStorage directly from this component, and never claims backend/MySQL persistence,
 * which does not exist for department configuration yet.
 */
export default function DepartmentColorsModal({ isOpen, onClose, onSaved }) {
  const [departments, setDepartments] = useState([]);
  const [colors, setColors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setIsLoading(true);
    departmentService.getAll({ withCount: false })
      .then((depts) => {
        setDepartments(depts);
        // Seed the working color state from each department's CURRENT resolved color (its own
        // explicit `color` if set, otherwise the same stable hash fallback the bars already
        // render) — so the picker always shows what HR would actually see on the Timeline today,
        // never a blank/default swatch that doesn't match reality.
        const initial = {};
        depts.forEach((d) => {
          initial[d.id] = d.color || resolveDepartmentColor(d);
        });
        setColors(initial);
      })
      .catch((err) => {
        console.error('Failed to load departments for color customization:', err);
        setError('Failed to load departments.');
      })
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleColorChange = (deptId, value) => {
    setColors((prev) => ({ ...prev, [deptId]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      // Only persist departments whose color actually changed from what was already stored —
      // a department HR never touched keeps its existing configuration (explicit color, or
      // still unconfigured/falling back to the deterministic hash) rather than every department
      // silently gaining an explicit `color` value just because the modal was opened.
      const changed = departments.filter((d) => colors[d.id] && colors[d.id] !== d.color);
      await Promise.all(changed.map((d) => departmentService.update(d.id, { color: colors[d.id] })));
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save department colors.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <Palette size={20} />
            </div>
            <div>
              <h3 className="modal-title">Department Colors</h3>
              <p className="modal-subtitle">Customize each department's Timeline bar color</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="modal-error-alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Loading departments...</p>
          ) : departments.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>No departments found.</p>
          ) : (
            <div className="dept-color-list">
              {departments.map((d) => (
                <div key={d.id} className="dept-color-row">
                  <span className="dept-color-name">{d.name}</span>
                  <label className="dept-color-input-group">
                    <input
                      type="color"
                      className="dept-color-swatch-input"
                      value={colors[d.id] || '#94A3B8'}
                      onChange={(e) => handleColorChange(d.id, e.target.value)}
                      aria-label={`${d.name} Timeline color`}
                    />
                    <span className="dept-color-hex">{(colors[d.id] || '#94A3B8').toUpperCase()}</span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ padding: '1rem 1.5rem', backgroundColor: 'var(--bg-subtle)', marginTop: 0 }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
