import React, { useState, useEffect } from 'react';
import { X, Play, AlertTriangle, User, Calendar, FileText, Users, UsersRound, GraduationCap } from 'lucide-react';
import { onboardingService } from '../../services/onboardingService.js';
import { employeeService } from '../../services/employeeService.js';
import Select from '../common/Select.jsx';

export default function LaunchPlanModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedEmployeeId = null,
  preselectedTemplateId = null,
}) {
  const [onboardingEmployees, setOnboardingEmployees] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'Employee' | 'Intern' — same normalization as Onboarding Employees
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(preselectedEmployeeId || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState(preselectedTemplateId || '');
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
    if (preselectedTemplateId) setSelectedTemplateId(preselectedTemplateId);
  }, [preselectedEmployeeId, preselectedTemplateId]);

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
    if (selectedEmployeeId && selectedTemplateId) {
      loadPreview(selectedEmployeeId, selectedTemplateId);
    } else {
      setPreview(null);
    }
  }, [selectedEmployeeId, selectedTemplateId]);

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

      const allTpls = await onboardingService.getAllTemplates();
      const activeTpls = allTpls.filter((t) => t.active !== false);

      setOnboardingEmployees(eligibleEmps);
      setTemplates(activeTpls);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadPreview = async (empId, tplId) => {
    setPreviewLoading(true);
    setError(null);
    try {
      const res = await onboardingService.previewPlanLaunch(empId, tplId);
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
    setSelectedTemplateId(preselectedTemplateId || '');
    setTypeFilter('all');
    setPreview(null);
    setError(null);
    setLoading(false);
  };

  const handleLaunch = async () => {
    if (!selectedEmployeeId || !selectedTemplateId) return;
    setLoading(true);
    setError(null);
    try {
      const newInst = await onboardingService.launchPlanInstance(selectedEmployeeId, selectedTemplateId);
      if (onSuccess) onSuccess(newInst);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Launch is available whenever a valid employee + template combination has produced a
  // preview — this modal only ever collects employee and template, nothing else.
  const canLaunch = Boolean(preview) && !previewLoading;

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

          {/* Form Selectors */}
          <div className="modal-field-grid-2">
            <div className="form-group" style={{ marginBottom: 0 }}>
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

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Select Onboarding Template <span className="required-star">*</span></label>
              <Select
                variant="form"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                options={[
                  { value: '', label: '-- Choose Template --' },
                  ...templates.map((tpl) => ({
                    value: tpl.id,
                    label: `${tpl.name} (${tpl.taskCount} tasks)`
                  }))
                ]}
              />
            </div>
          </div>

          {/* Preview Details */}
          {previewLoading && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Calculating plan preview and due dates...
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
                  <Calendar size={16} style={{ color: '#D97706' }} />
                  <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                    Anchor Start Date: <strong style={{ color: 'var(--text-main)' }}>{preview.anchorDate}</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={16} style={{ color: '#2563EB' }} />
                  <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                    Plan: <strong style={{ color: 'var(--text-main)' }}>{preview.template.name}</strong> ({preview.totalTasks} Tasks)
                  </span>
                </div>
              </div>

              {/* Task Preview Table */}
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
                    {preview.taskPreviews.map((pt) => (
                      <tr key={pt.planTaskId}>
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
