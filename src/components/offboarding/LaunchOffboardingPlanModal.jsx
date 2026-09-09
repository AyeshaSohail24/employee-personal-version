import React, { useState, useEffect } from 'react';
import { X, Play, AlertCircle, Calendar, UserCheck, ShieldAlert } from 'lucide-react';
import { offboardingService } from '../../services/offboardingService.js';
import { employeeService } from '../../services/employeeService.js';
import { formatDateDisplay } from '../../utils/dateUtils.js';
import Select from '../common/Select.jsx';

export default function LaunchOffboardingPlanModal({ isOpen, onClose, onSuccess, initialEmployeeId = null }) {
  const [employees, setEmployees] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [customAnchorDate, setCustomAnchorDate] = useState('');
  const [manualOverrides, setManualOverrides] = useState({});

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      if (initialEmployeeId) {
        setSelectedEmployeeId(initialEmployeeId);
      }
    } else {
      resetModalState();
    }
  }, [isOpen, initialEmployeeId]);

  useEffect(() => {
    if (selectedEmployeeId && selectedTemplateId) {
      updatePreview();
    } else {
      setPreview(null);
    }
  }, [selectedEmployeeId, selectedTemplateId, customAnchorDate]);

  const resetModalState = () => {
    setSelectedEmployeeId('');
    setSelectedTemplateId('');
    setCustomAnchorDate('');
    setManualOverrides({});
    setPreview(null);
    setError(null);
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [allEmps, allTpls] = await Promise.all([
        employeeService.getAll(),
        offboardingService.getAllTemplates(),
      ]);

      const activeTpls = allTpls.filter((t) => t.active !== false);
      setEmployees(allEmps);
      setTemplates(activeTpls);

      if (activeTpls.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(activeTpls[0].id);
      }
    } catch (err) {
      setError(`Failed to load launch options: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updatePreview = async () => {
    setError(null);
    try {
      const prev = await offboardingService.previewPlanLaunch(
        selectedEmployeeId,
        selectedTemplateId,
        customAnchorDate
      );
      setPreview(prev);
    } catch (err) {
      setPreview(null);
      setError(err.message);
    }
  };

  const handleOverrideAssignee = (taskId, assigneeId) => {
    setManualOverrides((prev) => ({
      ...prev,
      [taskId]: assigneeId,
    }));
  };

  const handleLaunch = async (e) => {
    e.preventDefault();
    if (!selectedEmployeeId || !selectedTemplateId) {
      setError('Please select an employee and an offboarding plan template.');
      return;
    }

    setLaunching(true);
    setError(null);
    try {
      await offboardingService.launchPlanInstance(
        selectedEmployeeId,
        selectedTemplateId,
        manualOverrides,
        customAnchorDate,
        'emp-001'
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLaunching(false);
    }
  };

  if (!isOpen) return null;

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  return (
    <div className="modal-backdrop-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div className="modal-container-card" style={{ backgroundColor: '#FFF', borderRadius: '12px', width: '100%', maxWidth: '780px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
        
        {/* Modal Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Play size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-navy-header)' }}>
                Launch Offboarding Plan
              </h2>
              <p style={{ margin: 0, fontSize: '0.785rem', color: 'var(--text-muted)' }}>
                Single-write, validate-first PoC persistence launch flow
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.35rem', borderRadius: '6px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {error && (
            <div style={{ padding: '0.85rem 1rem', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#991B1B', fontSize: '0.825rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <AlertCircle size={18} style={{ color: '#DC2626', flexShrink: 0, marginTop: '2px' }} />
              <div>{error}</div>
            </div>
          )}

          {/* Form Selection Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.815rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                Departing Employee <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <Select
                variant="form"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                options={[
                  { value: '', label: '-- Select Departing Employee --' },
                  ...employees.map((emp) => {
                    const statusTag = emp.status === 'Departing' ? ' [Departing]' : emp.status === 'Active' ? ' [Active]' : ` [${emp.status}]`;
                    return {
                      value: emp.id,
                      label: `${emp.fullName} (${emp.employeeId})${statusTag}`
                    };
                  })
                ]}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.815rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                Offboarding Plan Template <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <Select
                variant="form"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                options={[
                  { value: '', label: '-- Select Clearance Template --' },
                  ...templates.map((tpl) => ({
                    value: tpl.id,
                    label: `${tpl.name} (${tpl.taskCount || 0} tasks)`
                  }))
                ]}
              />
            </div>
          </div>

          {/* Anchor Date & Custom Override */}
          <div style={{ padding: '0.85rem 1rem', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={18} style={{ color: 'var(--color-primary)' }} />
              <div>
                <div style={{ fontSize: '0.815rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Final Working Date Anchor
                </div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                  {preview?.anchorDate ? `Calculated anchor date: ${formatDateDisplay(preview.anchorDate)}` : 'Select employee to resolve exit anchor date'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.785rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Custom Override:
              </label>
              <input
                type="date"
                style={{ padding: '0.35rem 0.5rem', fontSize: '0.815rem', border: '1px solid var(--border-light)', borderRadius: '6px', backgroundColor: '#FFF' }}
                value={customAnchorDate}
                onChange={(e) => setCustomAnchorDate(e.target.value)}
              />
            </div>
          </div>

          {/* Live Task Preview Section */}
          {preview && (
            <div style={{ border: '1px solid var(--border-light)', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem 1rem', backgroundColor: '#F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Task Launch Preview ({preview.totalTasks} tasks, {preview.requiredTasksCount} required)
                </span>
                <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '12px', fontWeight: 600, backgroundColor: preview.isValid ? '#ECFDF5' : '#FEF2F2', color: preview.isValid ? '#059669' : '#DC2626' }}>
                  {preview.isValid ? 'Valid & Ready' : `${preview.unresolvedCount} Unresolved`}
                </span>
              </div>

              <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--border-light)' }}>
                    <tr>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>#</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Task Title</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Relative Offset</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Due Date</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Assignee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.taskPreviews.map((pt) => {
                      const offsetLabel = pt.relativeOffsetDays === 0
                        ? 'Day 0 (Exit)'
                        : pt.relativeOffsetDays < 0
                        ? `Day ${pt.relativeOffsetDays}`
                        : `Day +${pt.relativeOffsetDays}`;

                      return (
                        <tr key={pt.planTaskId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>{pt.sequence}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{pt.title}</div>
                            {pt.required && <span style={{ fontSize: '0.685rem', color: '#DC2626', fontWeight: 700 }}>Required</span>}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                            {offsetLabel}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {formatDateDisplay(pt.calculatedDueDate)}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            {pt.isResolved ? (
                              <span style={{ color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                <UserCheck size={13} /> {pt.resolvedAssigneeName}
                              </span>
                            ) : (
                              <span style={{ color: '#DC2626', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                <ShieldAlert size={13} /> {pt.resolvedAssigneeName}
                              </span>
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

        {/* Modal Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', backgroundColor: '#F8FAFC' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={launching || (preview && !preview.isValid)}
            onClick={handleLaunch}
            style={{ padding: '0.45rem 1.25rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', opacity: (preview && !preview.isValid) ? 0.6 : 1 }}
          >
            <Play size={15} />
            <span>{launching ? 'Launching...' : 'Confirm & Launch Plan'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
