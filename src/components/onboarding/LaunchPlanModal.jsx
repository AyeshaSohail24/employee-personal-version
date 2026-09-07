import React, { useState, useEffect } from 'react';
import { X, Play, AlertTriangle, CheckCircle2, User, Calendar, FileText } from 'lucide-react';
import { onboardingService } from '../../services/onboardingService.js';
import { employeeService } from '../../services/employeeService.js';

export default function LaunchPlanModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedEmployeeId = null,
  preselectedTemplateId = null,
}) {
  const [employees, setEmployees] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(preselectedEmployeeId || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState(preselectedTemplateId || '');
  const [preview, setPreview] = useState(null);
  const [manualOverrides, setManualOverrides] = useState({});
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

  useEffect(() => {
    if (selectedEmployeeId && selectedTemplateId) {
      loadPreview(selectedEmployeeId, selectedTemplateId);
    } else {
      setPreview(null);
    }
  }, [selectedEmployeeId, selectedTemplateId]);

  const loadInitialOptions = async () => {
    try {
      const allEmps = await employeeService.getAll();
      // Onboarding target population: Upcoming, Onboarding, or Active without active plan
      const instances = await onboardingService.getAllInstances();
      const activeEmpIdsWithPlan = new Set(
        instances.filter((i) => i.derivedStatus !== 'Completed').map((i) => i.employeeId)
      );

      const candidateEmps = allEmps.filter((e) => {
        if (e.status === 'Upcoming' || e.status === 'Onboarding') return true;
        if (e.status === 'Active' && !activeEmpIdsWithPlan.has(e.id)) return true;
        return false;
      });

      const allTpls = await onboardingService.getAllTemplates();
      const activeTpls = allTpls.filter((t) => t.active !== false);

      setEmployees(candidateEmps);
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
      setManualOverrides({});
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
    setPreview(null);
    setManualOverrides({});
    setError(null);
    setLoading(false);
  };

  const handleAssigneeChange = (planTaskId, newAssigneeId) => {
    setManualOverrides((prev) => ({
      ...prev,
      [planTaskId]: newAssigneeId,
    }));
  };

  const handleLaunch = async () => {
    if (!selectedEmployeeId || !selectedTemplateId) return;
    setLoading(true);
    setError(null);
    try {
      const newInst = await onboardingService.launchPlanInstance(
        selectedEmployeeId,
        selectedTemplateId,
        manualOverrides
      );
      if (onSuccess) onSuccess(newInst);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Check if launch can proceed
  const canLaunch =
    preview &&
    !previewLoading &&
    preview.taskPreviews.every((pt) => {
      const currentAssignee = manualOverrides[pt.planTaskId] || pt.resolvedAssigneeId;
      if (pt.required) return Boolean(currentAssignee);
      return true;
    });

  return (
    <div className="modal-backdrop-overlay">
      <div className="modal-container-card" style={{ maxWidth: '850px', width: '92%' }}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Play size={20} className="modal-icon-teal" />
            <h2>Launch Onboarding Plan</h2>
          </div>
          <button type="button" className="btn-icon-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body-content" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
          {error && (
            <div className="modal-error-alert" style={{ marginBottom: '1rem' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Form Selectors */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Select Onboarding Employee *</label>
              <select
                className="form-control-input"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
              >
                <option value="">-- Choose Employee --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.employeeId}) — [{emp.status}]
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Select Onboarding Template *</label>
              <select
                className="form-control-input"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
              >
                <option value="">-- Choose Template --</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.taskCount} tasks)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview Details */}
          {previewLoading && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Calculating plan preview, due dates, and assignee rules...
            </div>
          )}

          {preview && !previewLoading && (
            <div className="preview-container-box" style={{ background: '#F8FAFC', borderRadius: '8px', padding: '1rem', border: '1px solid #E2E8F0' }}>
              {/* Summary Header */}
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', background: '#FFF', padding: '0.85rem 1rem', borderRadius: '6px', border: '1px solid #E2E8F0', alignItems: 'center' }}>
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

              {preview.hasUnresolvedRequired`Unassigned Required Tasks` && (
                <div className="modal-warning-alert" style={{ marginBottom: '1rem', backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: '#DC2626', padding: '0.75rem 1rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={16} />
                  <span style={{ fontSize: '0.815rem' }}>
                    One or more required tasks are unassigned. Please select an assignee for required tasks before launching.
                  </span>
                </div>
              )}

              {/* Task Preview Table */}
              <div style={{ overflowX: 'auto' }}>
                <table className="presence-data-table" style={{ width: '100%', fontSize: '0.815rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '5%', textAlign: 'center' }}>#</th>
                      <th style={{ width: '32%', textAlign: 'left' }}>Task Title</th>
                      <th style={{ width: '15%', textAlign: 'center' }}>Relative Timing</th>
                      <th style={{ width: '18%', textAlign: 'center' }}>Calculated Due Date</th>
                      <th style={{ width: '22%', textAlign: 'left' }}>Resolved Assignee</th>
                      <th style={{ width: '8%', textAlign: 'center' }}>Req</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.taskPreviews.map((pt) => {
                      const currentAssignee = manualOverrides[pt.planTaskId] || pt.resolvedAssigneeId;
                      const isUnassignedReq = pt.required && !currentAssignee;

                      return (
                        <tr key={pt.planTaskId} style={isUnassignedReq ? { backgroundColor: '#FEF2F2' } : undefined}>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{pt.sequence}</td>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{pt.title}</div>
                            {pt.description && (
                              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{pt.description}</div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span className="badge-timing" style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.725rem', fontWeight: 600 }}>
                              Day {pt.relativeOffsetDays >= 0 ? `+${pt.relativeOffsetDays}` : pt.relativeOffsetDays}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {pt.calculatedDueDate}
                          </td>
                          <td>
                            <select
                              className="form-control-input"
                              style={{ padding: '0.2rem 0.4rem', fontSize: '0.785rem', borderColor: isUnassignedReq ? '#EF4444' : '#CBD5E1' }}
                              value={currentAssignee || ''}
                              onChange={(e) => handleAssigneeChange(pt.planTaskId, e.target.value)}
                            >
                              <option value="">-- Select Assignee --</option>
                              {pt.allCandidates && pt.allCandidates.length > 0 ? (
                                pt.allCandidates.map((cand) => (
                                  <option key={cand.id} value={cand.id}>
                                    {cand.fullName} ({cand.role})
                                  </option>
                                ))
                              ) : (
                                pt.resolvedAssigneeId && (
                                  <option value={pt.resolvedAssigneeId}>{pt.resolvedAssigneeName}</option>
                                )
                              )}
                              {employees.map((emp) => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.fullName}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {pt.required ? (
                              <span style={{ color: '#DC2626', fontWeight: 700 }}>Yes</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>No</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
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
            <span>{loading ? 'Launching Plan...' : 'Confirm & Launch Plan'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
