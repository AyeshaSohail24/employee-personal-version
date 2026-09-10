import React, { useState, useEffect } from 'react';
import { X, Play, AlertTriangle, User, Calendar, Building2, Users, UsersRound, GraduationCap } from 'lucide-react';
import { onboardingService } from '../../services/onboardingService.js';
import { employeeService } from '../../services/employeeService.js';
import Select from '../common/Select.jsx';

export default function LaunchPlanModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedEmployeeId = null,
}) {
  const [onboardingEmployees, setOnboardingEmployees] = useState([]);
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'Employee' | 'Intern' — same normalization as Onboarding Employees
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(preselectedEmployeeId || '');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadInitialOptions();
    } else {
      resetState();
    }
  }, [isOpen]);

  useEffect(() => {
    if (preselectedEmployeeId) setSelectedEmployeeId(preselectedEmployeeId);
  }, [preselectedEmployeeId]);

  // If the currently selected employee no longer matches the newly chosen type filter,
  // clear the selection so Launch can't proceed against a now-hidden person.
  useEffect(() => {
    if (!selectedEmployeeId) return;
    const currentlySelected = onboardingEmployees.find((emp) => emp.id === selectedEmployeeId);
    const stillEligible = currentlySelected && (typeFilter === 'all' || currentlySelected.directoryType === typeFilter);
    if (!stillEligible) {
      setSelectedEmployeeId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  useEffect(() => {
    if (selectedEmployeeId) {
      loadPreview(selectedEmployeeId);
    } else {
      setPreview(null);
    }
  }, [selectedEmployeeId]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const loadInitialOptions = async () => {
    try {
      const allEmps = await employeeService.getAll();

      // Launch eligibility: only employee/intern records whose CURRENT lifecycle status is
      // 'Onboarding' — the existing normalized employee.status field used throughout the
      // app (directory, onboarding population helpers, etc.), not a new eligibility model.
      // This intentionally reads from the Employees service boundary, not Upcoming
      // candidates directly: by the time someone is selectable here they must already be a
      // converted Employee record in Onboarding status.
      const eligibleEmps = allEmps.filter((e) => e.status === 'Onboarding');

      setOnboardingEmployees(eligibleEmps);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadPreview = async (empId) => {
    setPreviewLoading(true);
    setError(null);
    try {
      const res = await onboardingService.previewOnboardingComposition(empId);
      setPreview(res);
    } catch (err) {
      setError(err.message);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const resetState = () => {
    setSelectedEmployeeId(preselectedEmployeeId || '');
    setTypeFilter('all');
    setPreview(null);
    setError(null);
    setLoading(false);
  };

  const handleLaunch = async () => {
    if (!selectedEmployeeId) return;
    setLoading(true);
    setError(null);
    try {
      const newInst = await onboardingService.launchPlanInstance(selectedEmployeeId);
      if (onSuccess) onSuccess(newInst);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Composed tasks are the same object the actual launch uses — Launch is only available once
  // a valid, non-empty composition has been previewed for the selected employee.
  const canLaunch = Boolean(preview) && preview.isValid && preview.counts.total > 0 && !previewLoading;

  // Lifecycle eligibility (status === 'Onboarding') is applied first in loadInitialOptions();
  // this is the secondary All/Employees/Interns narrowing on top of that already-eligible set.
  const filteredOnboardingEmployees = onboardingEmployees.filter(
    (emp) => typeFilter === 'all' || emp.directoryType === typeFilter
  );

  const employeeEmptyStateMessage =
    typeFilter === 'Employee'
      ? 'No onboarding employees available'
      : typeFilter === 'Intern'
      ? 'No onboarding interns available'
      : 'No employees currently awaiting onboarding';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card xl-modal modal-launch-plan modal-scroll-shell" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <Play size={20} />
            </div>
            <div>
              <h3 className="modal-title">Launch Onboarding Plan</h3>
              <p className="modal-subtitle">Assign an onboarding plan to an employee or intern.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body modal-body-spacious">
          {error && (
            <div className="modal-error-alert" style={{ marginBottom: '1.25rem' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Employee Selector */}
          <div className="form-group">
            <label className="form-label">Select Onboarding Employee <span className="required-star">*</span></label>

            <div className="view-switcher-group" style={{ marginBottom: '0.6rem' }}>
              <button
                type="button"
                className={`view-btn ${typeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setTypeFilter('all')}
              >
                <Users size={14} />
                <span>All</span>
              </button>
              <button
                type="button"
                className={`view-btn ${typeFilter === 'Employee' ? 'active' : ''}`}
                onClick={() => setTypeFilter('Employee')}
              >
                <UsersRound size={14} />
                <span>Employees</span>
              </button>
              <button
                type="button"
                className={`view-btn ${typeFilter === 'Intern' ? 'active' : ''}`}
                onClick={() => setTypeFilter('Intern')}
              >
                <GraduationCap size={14} />
                <span>Interns</span>
              </button>
            </div>

            {filteredOnboardingEmployees.length === 0 ? (
              <Select
                variant="form"
                value=""
                onChange={() => {}}
                disabled
                options={[{ value: '', label: employeeEmptyStateMessage }]}
              />
            ) : (
              <Select
                variant="form"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                options={[
                  { value: '', label: '-- Choose Employee --' },
                  ...filteredOnboardingEmployees.map((emp) => ({
                    value: emp.id,
                    label: emp.directoryType === 'Intern'
                      ? `${emp.fullName} (${emp.employeeId}) — Intern`
                      : `${emp.fullName} (${emp.employeeId})`
                  }))
                ]}
              />
            )}
            <span className="form-hint">Only employees/interns currently in Onboarding status are eligible</span>
          </div>

          {/* Preview Details */}
          {previewLoading && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Composing applicable onboarding tasks...
            </div>
          )}

          {preview && !previewLoading && (
            <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '1rem', border: '1px solid #E2E8F0' }}>
              {/* Summary Header */}
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', background: '#FFF', padding: '0.85rem 1rem', borderRadius: '6px', border: '1px solid #E2E8F0', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <User size={16} style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{preview.employee.fullName}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {preview.typeScope === 'intern' ? <GraduationCap size={16} style={{ color: '#7C3AED' }} /> : <UsersRound size={16} style={{ color: '#2563EB' }} />}
                  <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                    {preview.typeScope === 'intern' ? 'Intern' : 'Employee'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Building2 size={16} style={{ color: '#059669' }} />
                  <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                    {preview.employee.department ? preview.employee.department.name : 'No Department'}
                  </span>
                </div>
                {preview.anchorDate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={16} style={{ color: '#D97706' }} />
                    <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                      Anchor Start Date: <strong style={{ color: 'var(--text-main)' }}>{preview.anchorDate}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Scope Composition Breakdown */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
                  Universal Tasks {preview.counts.universal}
                </span>
                <span style={{ background: '#F5F3FF', color: '#7C3AED', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
                  {preview.typeScope === 'intern' ? 'Intern Tasks' : 'Employee Tasks'} {preview.counts.typeSpecific}
                </span>
                <span style={{ background: '#ECFDF5', color: '#059669', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
                  Department Tasks {preview.counts.department}
                </span>
                <span style={{ background: '#0F172A', color: '#FFF', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700 }}>
                  Total {preview.counts.total}
                </span>
              </div>

              {preview.counts.total === 0 ? (
                <div style={{ padding: '1.25rem', textAlign: 'center', color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                  No onboarding tasks are configured for this employee.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="presence-data-table" style={{ width: '100%', fontSize: '0.815rem' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '6%', textAlign: 'center' }}>#</th>
                        <th style={{ width: '44%', textAlign: 'left' }}>Task Title</th>
                        <th style={{ width: '18%', textAlign: 'center' }}>Relative Timing</th>
                        <th style={{ width: '22%', textAlign: 'center' }}>Calculated Due Date</th>
                        <th style={{ width: '10%', textAlign: 'center' }}>Req</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.tasks.map((pt) => (
                        <tr key={pt.id}>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{pt.sequence}</td>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{pt.title}</div>
                            {pt.description && (
                              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{pt.description}</div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.725rem', fontWeight: 600 }}>
                              Day {pt.relativeOffsetDays >= 0 ? `+${pt.relativeOffsetDays}` : pt.relativeOffsetDays}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {pt.calculatedDueDate}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {pt.required ? (
                              <span style={{ color: '#DC2626', fontWeight: 700 }}>Yes</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>No</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer modal-footer-spacious">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleLaunch}
            disabled={!canLaunch || loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Play size={14} />
            <span>{loading ? 'Launching Plan...' : 'Launch Onboarding Plan'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
