import React, { useEffect, useMemo, useState } from 'react';
import { X, Link2, AlertCircle, Trash2, ArrowRight, Check, Plus } from 'lucide-react';
import { apiClient, ApiError } from '../../services/apiClient.js';
import { Select } from '../common/Select.jsx';

function errorText(err, fallback) {
  return err instanceof ApiError && err.message ? err.message : fallback;
}

const KIND_OPTIONS = [
  { value: 'department', label: 'Department name' },
  { value: 'job', label: 'Job title' },
];
const KIND_LABEL = { department: 'Department', job: 'Job' };

/**
 * Maps text from the Recruitment system to a real department from the Departments service, for
 * the Upcoming candidates' department (server/db/departmentAliases.js). Two kinds:
 *  - a job's department name (e.g. "Engineering" → Software engineering);
 *  - a job title (e.g. "Business Intelligence & Data Analytics" → Data Analytics & Business
 *    Intelligence), for a job filed under the wrong department in Recruitment — it takes priority
 *    over that job's department name.
 * Matching ignores upper/lower case and extra spaces. Mappings are shared by every HR user, and
 * nothing in the Recruitment system changes.
 *
 * `unmatchedNames`: department names on the current candidates that didn't resolve.
 * `knownDepartmentNames` / `knownJobTitles`: what the current candidates use, offered as
 * suggestions when adding a mapping.
 */
export default function DepartmentMappingModal({ unmatchedNames = [], knownDepartmentNames = [], knownJobTitles = [], onClose, onChanged }) {
  const [departments, setDepartments] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [choices, setChoices] = useState({});
  const [error, setError] = useState('');
  const [busyName, setBusyName] = useState('');
  const [newKind, setNewKind] = useState('department');
  const [newName, setNewName] = useState('');
  const [newDepartmentId, setNewDepartmentId] = useState('');

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

  // Same matching as the server: case- and spacing-insensitive, separately per kind.
  const normalize = (n) => String(n || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const kindOf = (a) => a.kind || 'department';
  const isMapped = (kind, name) => aliases.some((a) => kindOf(a) === kind && normalize(a.alias) === normalize(name));
  const pending = unmatchedNames.filter((n) => !isMapped('department', n));
  const suggestions = (newKind === 'job' ? knownJobTitles : knownDepartmentNames).filter((n) => !isMapped(newKind, n));
  const busyKey = (kind, name) => `${kind}:${normalize(name)}`;

  const afterChange = async () => {
    await load();
    await onChanged();
  };

  // `create`: a new mapping (refused by the server if that name is already mapped — e.g. by
  // another HR user meanwhile); otherwise changes an existing one.
  const save = async ({ kind, alias, departmentId, create }) => {
    setError('');
    if (!departmentId) {
      setError(`Choose a department for "${alias}".`);
      return false;
    }
    setBusyName(busyKey(kind, alias));
    try {
      if (create) await apiClient.post('/department-aliases', { kind, alias, departmentId });
      else await apiClient.put('/department-aliases', { kind, alias, departmentId });
      await afterChange();
      return true;
    } catch (err) {
      setError(errorText(err, 'Could not save this mapping.'));
      await load();
      return false;
    } finally {
      setBusyName('');
    }
  };

  const addMapping = async (e) => {
    e.preventDefault();
    const name = newName.trim().replace(/\s+/g, ' ');
    if (!name) {
      setError(`Enter the ${newKind === 'job' ? 'job title' : 'department name'} used in the Recruitment system.`);
      return;
    }
    if (isMapped(newKind, name)) {
      setError(`"${name}" is already mapped. Change it under Saved mappings instead.`);
      return;
    }
    if (await save({ kind: newKind, alias: name, departmentId: newDepartmentId, create: true })) {
      setNewName('');
      setNewDepartmentId('');
    }
  };

  const remove = async (a) => {
    setError('');
    const kind = kindOf(a);
    if (!window.confirm(`Remove the mapping for ${kind === 'job' ? 'the job' : ''} "${a.alias}"?`)) return;
    setBusyName(busyKey(kind, a.alias));
    try {
      await apiClient.delete(`/department-aliases/${encodeURIComponent(a.alias)}?kind=${kind}`);
      await afterChange();
    } catch (err) {
      setError(errorText(err, 'Could not remove this mapping.'));
    } finally {
      setBusyName('');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide-modal modal-scroll-shell" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <Link2 size={20} />
            </div>
            <div>
              <h3 className="modal-title">Map Departments</h3>
              <p className="modal-subtitle">
                Link a department name or job title from the Recruitment system to a real department. Upper/lower case and extra spaces are ignored. A job title mapping takes priority over that job’s department name.
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="modal-error-alert" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <h4 className="placeholder-section-title" style={{ marginTop: 0 }}>Not matched yet</h4>
          {pending.length === 0 ? (
            <p className="form-hint" style={{ marginTop: 0 }}>Every candidate’s department name matches a real department. If one shows the wrong department (e.g. their job is filed under the wrong one in Recruitment), add a job title mapping below.</p>
          ) : (
            pending.map((name) => (
              <div key={name} className="dept-mapping-row dept-mapping-row-pending">
                <span className="dept-mapping-alias" title="Department name in the Recruitment system">{name}</span>
                <span className="dept-mapping-arrow" aria-hidden="true"><ArrowRight size={14} /></span>
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
                  className="btn-primary dept-mapping-save"
                  disabled={busyName === busyKey('department', name) || !choices[name]}
                  onClick={() => save({ kind: 'department', alias: name, departmentId: choices[name], create: true })}
                >
                  <Check size={14} />
                  <span>{busyName === busyKey('department', name) ? 'Saving...' : 'Save'}</span>
                </button>
              </div>
            ))
          )}

          <h4 className="placeholder-section-title">Add a mapping</h4>
          <form className="dept-mapping-add" onSubmit={addMapping}>
            <div className="dept-mapping-add-kind">
              <label className="form-label" htmlFor="dept-mapping-kind">Recruitment</label>
              <Select
                id="dept-mapping-kind"
                variant="filter"
                value={newKind}
                onChange={(e) => { setNewKind(e.target.value); setNewName(''); }}
                options={KIND_OPTIONS}
              />
            </div>
            <div className="dept-mapping-add-name">
              <label className="form-label" htmlFor="dept-mapping-name">{newKind === 'job' ? 'Job title' : 'Department name'}</label>
              <input
                id="dept-mapping-name"
                className="form-input"
                list="dept-mapping-suggestions"
                value={newName}
                maxLength={240}
                placeholder={newKind === 'job' ? 'e.g. Business Intelligence & Data Analytics' : 'e.g. Engineering'}
                onChange={(e) => setNewName(e.target.value)}
              />
              <datalist id="dept-mapping-suggestions">
                {suggestions.map((n) => <option key={n} value={n} />)}
              </datalist>
            </div>
            <div className="dept-mapping-add-dept">
              <label className="form-label" htmlFor="dept-mapping-target">Real department</label>
              <Select
                id="dept-mapping-target"
                variant="filter"
                value={newDepartmentId}
                onChange={(e) => setNewDepartmentId(e.target.value)}
                placeholder="Choose a department..."
                options={departmentOptions}
              />
            </div>
            <button
              type="submit"
              className="btn-primary dept-mapping-save"
              disabled={busyName === busyKey(newKind, newName) || !newName.trim() || !newDepartmentId}
            >
              <Plus size={14} />
              <span>{busyName === busyKey(newKind, newName) ? 'Adding...' : 'Add Mapping'}</span>
            </button>
          </form>

          <h4 className="placeholder-section-title">Saved mappings</h4>
          {aliases.length === 0 ? (
            <p className="form-hint" style={{ marginTop: 0 }}>No mappings yet.</p>
          ) : (
            aliases.map((a) => (
              <div key={`${kindOf(a)}:${a.alias}`} className="dept-mapping-row">
                <span className="dept-mapping-alias" title={`${kindOf(a) === 'job' ? 'Job title' : 'Department name'} in the Recruitment system: ${a.alias}`}>
                  <span className={`dept-mapping-kind dept-mapping-kind-${kindOf(a)}`}>{KIND_LABEL[kindOf(a)]}</span>
                  {a.alias}
                </span>
                <span className="dept-mapping-arrow" aria-hidden="true"><ArrowRight size={14} /></span>
                <div className="dept-mapping-select">
                  <Select
                    variant="filter"
                    value={a.departmentId}
                    onChange={(e) => save({ kind: kindOf(a), alias: a.alias, departmentId: e.target.value, create: false })}
                    options={departmentOptions}
                  />
                  {!a.departmentName && (
                    <span className="form-hint" style={{ color: 'var(--warn-text)' }}>That department no longer exists — choose another.</span>
                  )}
                </div>
                <button
                  type="button"
                  className="dept-mapping-remove"
                  disabled={busyName === busyKey(kindOf(a), a.alias)}
                  onClick={() => remove(a)}
                  title="Remove this mapping"
                  aria-label={`Remove the mapping for ${a.alias}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="modal-footer" style={{ padding: '1rem 1.5rem', backgroundColor: 'var(--bg-subtle)', marginTop: 0 }}>
          <button type="button" className="btn-primary dept-mapping-done" onClick={onClose}>
            <Check size={15} />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
}
