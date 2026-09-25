import React, { useEffect, useMemo, useState } from 'react';
import { X, Link2, AlertCircle, Trash2 } from 'lucide-react';
import { apiClient, ApiError } from '../../services/apiClient.js';
import { Select } from '../common/Select.jsx';

function errorText(err, fallback) {
  return err instanceof ApiError && err.message ? err.message : fallback;
}

/**
 * Maps the free-text department on a Recruitment job (e.g. "Engineering") to a real department
 * from the Departments service, for names that don't already match. Matching ignores upper/lower
 * case and extra spaces (server/db/departmentAliases.js). Mappings are shared by every HR user.
 *
 * `unmatchedNames` are the job department names on the current Upcoming candidates that didn't
 * resolve to a real department.
 */
export default function DepartmentMappingModal({ unmatchedNames = [], onClose, onChanged }) {
  const [departments, setDepartments] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [choices, setChoices] = useState({});
  const [error, setError] = useState('');
  const [busyName, setBusyName] = useState('');

  const load = async () => {
    try {
      const [{ departments: list }, { aliases: saved }] = await Promise.all([
        apiClient.get('/departments'),
        apiClient.get('/department-aliases'),
      ]);
      setDepartments(list);
      setAliases(saved);
    } catch (err) {
      setError(errorText(err, 'Could not load departments.'));
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const departmentOptions = useMemo(() => departments.map((d) => ({ value: d.id, label: d.name })), [departments]);

  // Unmatched names that don't have a saved mapping yet (case/spacing-insensitive).
  const normalize = (n) => String(n || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const mappedKeys = new Set(aliases.map((a) => normalize(a.alias)));
  const pending = unmatchedNames.filter((n) => !mappedKeys.has(normalize(n)));

  const save = async (alias, departmentId) => {
    setError('');
    if (!departmentId) {
      setError(`Choose a department for "${alias}".`);
      return;
    }
    setBusyName(alias);
    try {
      await apiClient.put('/department-aliases', { alias, departmentId });
      await load();
      await onChanged();
    } catch (err) {
      setError(errorText(err, 'Could not save this mapping.'));
    } finally {
      setBusyName('');
    }
  };

  const remove = async (alias) => {
    setError('');
    if (!window.confirm(`Remove the mapping for "${alias}"?`)) return;
    setBusyName(alias);
    try {
      await apiClient.delete(`/department-aliases/${encodeURIComponent(alias)}`);
      await load();
      await onChanged();
    } catch (err) {
      setError(errorText(err, 'Could not remove this mapping.'));
    } finally {
      setBusyName('');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide-modal modal-scroll-shell" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <Link2 size={20} />
            </div>
            <div>
              <h3 className="modal-title">Map Departments</h3>
              <p className="modal-subtitle">
                Link a department name from the Recruitment system to a real department. Upper/lower case and extra spaces are ignored.
              </p>
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

          <h4 className="placeholder-section-title" style={{ marginTop: 0 }}>Not matched yet</h4>
          {pending.length === 0 ? (
            <p className="form-hint" style={{ marginTop: 0 }}>Every candidate’s department matches a real department.</p>
          ) : (
            pending.map((name) => (
              <div key={name} className="dept-mapping-row">
                <span className="dept-mapping-alias">{name}</span>
                <span className="dept-mapping-arrow">→</span>
                <div className="dept-mapping-select">
                  <Select
                    variant="filter"
                    value={choices[name] || ''}
                    onChange={(e) => setChoices((prev) => ({ ...prev, [name]: e.target.value }))}
                    placeholder="Choose a department..."
                    options={departmentOptions}
                  />
                </div>
                <button
                  type="button"
                  className="btn-primary email-drafts-toolbar-btn"
                  disabled={busyName === name}
                  onClick={() => save(name, choices[name])}
                >
                  {busyName === name ? 'Saving...' : 'Save'}
                </button>
              </div>
            ))
          )}

          <h4 className="placeholder-section-title">Saved mappings</h4>
          {aliases.length === 0 ? (
            <p className="form-hint" style={{ marginTop: 0 }}>No mappings yet.</p>
          ) : (
            aliases.map((a) => (
              <div key={a.alias} className="dept-mapping-row">
                <span className="dept-mapping-alias">{a.alias}</span>
                <span className="dept-mapping-arrow">→</span>
                <div className="dept-mapping-select">
                  <Select
                    variant="filter"
                    value={a.departmentId}
                    onChange={(e) => save(a.alias, e.target.value)}
                    options={departmentOptions}
                  />
                  {!a.departmentName && (
                    <span className="form-hint" style={{ color: '#B45309' }}>That department no longer exists — choose another.</span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-danger-outline email-drafts-toolbar-btn"
                  disabled={busyName === a.alias}
                  onClick={() => remove(a.alias)}
                  aria-label={`Remove the mapping for ${a.alias}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="modal-footer" style={{ padding: '1rem 1.5rem', backgroundColor: 'var(--bg-subtle)', marginTop: 0 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
