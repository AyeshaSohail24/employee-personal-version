import React, { useState, useEffect } from 'react';
import { X, Play, AlertTriangle, User, Calendar, Building2, Users, UsersRound, GraduationCap } from 'lucide-react';
import { offboardingService } from '../../services/offboardingService.js';
import { formatDateDisplay } from '../../utils/dateUtils.js';
import Select from '../common/Select.jsx';

// Mirrors Onboarding's LaunchPlanModal UX pattern (eligible-candidates dropdown + composed-task
// preview), but keeps one genuinely offboarding-specific control Onboarding doesn't need: a
// Final Working Date custom override, since (unlike an onboarding start date) many employees have
// no confirmed exit date on record yet. All composition/eligibility logic is offboarding's own —
// nothing here is shared with or copied from onboardingService.
export default function LaunchOffboardingPlanModal({
  isOpen,
  onClose,
  onSuccess,
  initialEmployeeId = null,
}) {
  const [offboardingEmployees, setOffboardingEmployees] = useState([]);
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'Employee' | 'Intern'
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId || '');
  const [customAnchorDate, setCustomAnchorDate] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadInitialOptions();
      if (initialEmployeeId) {
        setSelectedEmployeeId(initialEmployeeId);
      }
    } else {
      resetState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialEmployeeId]);

  // If the currently selected person is no longer present in the eligible-candidates list (e.g.
  // they picked up an active plan elsewhere, or their lifecycle status changed) or no longer
  // matches the chosen type filter, clear the selection so Launch can't proceed against a
  // now-hidden/ineligible person.
  useEffect(() => {
    if (!selectedEmployeeId) return;
    const currentlySelected = offboardingEmployees.find((emp) => emp.id === selectedEmployeeId);
    const stillEligible = currentlySelected && (typeFilter === 'all' || currentlySelected.directoryType === typeFilter);
    if (!stillEligible) {
      setSelectedEmployeeId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, offboardingEmployees]);

  useEffect(() => {
    if (selectedEmployeeId) {
      loadPreview(selectedEmployeeId, customAnchorDate);
    } else {
      setPreview(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployeeId, customAnchorDate]);

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
      // Launch eligibility = current lifecycle status 'Active'/'Departing' AND no existing active
      // offboarding plan instance, resolved entirely through the service boundary
      // (offboardingService.getLaunchEligibleEmployees()) — this component never inspects
      // storageEngine/localStorage directly. That service method reuses the exact same
      // active-plan definition launchPlanInstance() enforces as its final duplicate-plan guard.
      const eligibleEmps = await offboardingService.getLaunchEligibleEmployees();
      setOffboardingEmployees(eligibleEmps);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadPreview = async (empId, anchorOverride) => {
    setPreviewLoading(true);
    setError(null);
    try {
      const res = await offboardingService.previewOffboardingComposition(empId, anchorOverride || null);
      setPreview(res);
    } catch (err) {
      setError(err.message);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const resetState = () => {
    setSelectedEmployeeId(initialEmployeeId || '');
    setTypeFilter('all');
    setCustomAnchorDate('');
    setPreview(null);
    setError(null);
    setLoading(false);
  };

  const handleLaunch = async () => {
    if (!selectedEmployeeId) return;
    setLoading(true);
    setError(null);
    try {
      const newInst = await offboardingService.launchPlanInstance(selectedEmployeeId, customAnchorDate || null, 'emp-001');
      if (onSuccess) onSuccess(newInst);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Composed tasks are the same object the actual launch uses — Launch is only available once a
  // valid, non-empty composition has been previewed for the selected employee (which also
  // requires a resolved Final Working Date — from record or the custom override below).
  const canLaunch = Boolean(preview) && preview.isValid && preview.counts.total > 0 && !previewLoading;

  const filteredOffboardingEmployees = offboardingEmployees.filter(
    (emp) => typeFilter === 'all' || emp.directoryType === typeFilter
  );

  const employeeEmptyStateMessage =
    typeFilter === 'Employee'
      ? 'No employees are currently eligible to launch offboarding.'
      : typeFilter === 'Intern'
      ? 'No interns are currently eligible to launch offboarding.'
      : 'No employees or interns are currently eligible to launch offboarding.';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card xl-modal modal-launch-plan modal-scroll-shell" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
              <Play size={20} />
            </div>
            <div>
              <h3 className="modal-title">Launch Offboarding Plan</h3>
              <p className="modal-subtitle">Assign an offboarding plan to a departing employee or intern.</p>
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
            <label className="form-label">Select Departing Employee <span className="required-star">*</span></label>

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

            {filteredOffboardingEmployees.length === 0 ? (
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
                  ...filteredOffboardingEmployees.map((emp) => ({
                    value: emp.id,
                    label: emp.directoryType === 'Intern'
                      ? `${emp.fullName} (${emp.employeeId}) — Intern [${emp.status}]`
                      : `${emp.fullName} (${emp.employeeId}) [${emp.status}]`
                  }))
                ]}
              />
            )}
            <span className="form-hint">Only Active/Departing employees or interns without an active offboarding plan are eligible.</span>
          </div>

          {/* Final Working Date Anchor & Custom Override — the employee's own canonical Final
              Working Date is retrieved automatically; HR is never required to enter it manually.
              Custom Override exists only for exceptional situations (e.g. a contract extension)
              and never mutates the employee's stored record — it only changes the anchor
              snapshotted onto this one launched plan instance. Mirrors Onboarding's Start Date
              Anchor section exactly, for consistent HR UX across both launch flows. */}
          <div style={{ padding: '0.85rem 1rem', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--border-light)', marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
              <Calendar size={18} style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontSize: '0.815rem', fontWeight: 600, color: 'var(--text-main)' }}>Final Working Date Anchor</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Employee Final Working Date</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: preview ? (preview.canonicalAnchorDate ? 'var(--text-main)' : '#DC2626') : 'var(--text-muted)' }}>
                  {preview ? (preview.canonicalAnchorDate ? formatDateDisplay(preview.canonicalAnchorDate) : 'Not available') : 'Select an employee'}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                  Custom Override
                </label>
                <input
                  type="date"
                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.815rem', border: '1px solid var(--border-light)', borderRadius: '6px', backgroundColor: '#FFF' }}
                  value={customAnchorDate}
                  onChange={(e) => setCustomAnchorDate(e.target.value)}
                />
              </div>

              {customAnchorDate && preview && preview.anchorDate && (
                <div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Effective Anchor Date</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-primary)' }}>{formatDateDisplay(preview.anchorDate)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Preview Details */}
          {previewLoading && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Composing applicable offboarding tasks...
            </div>
          )}

          {preview && !previewLoading && (
            <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '1rem', border: '1px solid #E2E8F0', marginTop: '1rem' }}>
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
                      Final Working Date: <strong style={{ color: 'var(--text-main)' }}>{preview.anchorDate}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Scope Composition Breakdown */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
                  Universal Tasks {preview.counts.universal}
                </span>
                <span style={{ background: '#ECFDF5', color: '#059669', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
                  Department Tasks {preview.counts.department}
                </span>
                <span style={{ background: '#0F172A', color: '#FFF', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700 }}>
                  Total {preview.counts.total}
                </span>
              </div>

              {!preview.isValid || preview.counts.total === 0 ? (
                <div style={{ padding: '1.25rem', textAlign: 'center', color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                  {preview.error || 'No offboarding tasks are configured for this employee.'}
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="presence-data-table" style={{ width: '100%', fontSize: '0.815rem' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '7%', textAlign: 'center' }}>#</th>
                        <th style={{ width: '48%', textAlign: 'left' }}>Task Title</th>
                        <th style={{ width: '20%', textAlign: 'center' }}>Relative Timing</th>
                        <th style={{ width: '25%', textAlign: 'center' }}>Calculated Due Date</th>
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
            <span>{loading ? 'Launching Plan...' : 'Launch Offboarding Plan'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
