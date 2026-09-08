import React, { useState, useEffect } from 'react';
import { Clock, Plus, Edit2, Trash2, Power, AlertCircle, ShieldAlert } from 'lucide-react';
import { useRole } from '../../state/RoleContext';
import { configurationService } from '../../services/configurationService';
import { canUserMutate } from '../../domain/configurationDomain';
import { ScheduleModal } from '../../components/configuration/ScheduleModal';
import { DeleteConfirmModal } from '../../components/configuration/DeleteConfirmModal';

export default function PresenceConfigPage() {
  const { currentRole, isEmployee } = useRole();
  const userCanMutate = canUserMutate(currentRole);

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Schedule Modal state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  // Delete Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // WorkSchedule object

  const loadData = async () => {
    setLoading(true);
    try {
      const config = await configurationService.getPresenceConfig();
      setSchedules(config.schedules || []);
    } catch (err) {
      console.error('Failed to load presence configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (isEmployee) {
    return (
      <div className="config-page-wrapper">
        <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <ShieldAlert style={{ width: '48px', height: '48px', color: '#ef4444', margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#0f172a' }}>Access Restricted</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            System configuration is restricted to HR and Administrator roles.
          </p>
        </div>
      </div>
    );
  }

  const handleOpenCreate = () => {
    if (!userCanMutate) return;
    setSelectedSchedule(null);
    setScheduleModalOpen(true);
  };

  const handleOpenEdit = (sched) => {
    if (!userCanMutate) return;
    setSelectedSchedule(sched);
    setScheduleModalOpen(true);
  };

  const handleSaveSchedule = async (scheduleData) => {
    if (selectedSchedule) {
      await configurationService.updateSchedule(selectedSchedule.id, scheduleData, currentRole);
    } else {
      await configurationService.createSchedule(scheduleData, currentRole);
    }
    await loadData();
  };

  const handleToggleActive = async (sched) => {
    if (!userCanMutate) return;
    try {
      await configurationService.toggleScheduleActive(sched.id, currentRole);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteClick = (sched) => {
    if (!userCanMutate) return;
    setDeleteTarget(sched);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !userCanMutate) return;
    await configurationService.deleteSchedule(deleteTarget.id, currentRole);
    setDeleteModalOpen(false);
    setDeleteTarget(null);
    await loadData();
  };

  const handleConfirmDeactivate = async () => {
    if (!deleteTarget || !userCanMutate) return;
    await configurationService.toggleScheduleActive(deleteTarget.id, currentRole);
    setDeleteModalOpen(false);
    setDeleteTarget(null);
    await loadData();
  };

  const formatWorkingDays = (daysArray = []) => {
    if (daysArray.length === 5 && daysArray.join(',') === 'Monday,Tuesday,Wednesday,Thursday,Friday') {
      return 'Mon – Fri (5 days)';
    }
    if (daysArray.length === 6 && daysArray.join(',') === 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday') {
      return 'Mon – Sat (6 days)';
    }
    if (daysArray.length === 7) {
      return 'Everyday (7 days)';
    }
    const shortDays = daysArray.map((d) => d.substring(0, 3)).join(', ');
    return `${shortDays} (${daysArray.length} day${daysArray.length === 1 ? '' : 's'})`;
  };

  return (
    <div className="config-page-wrapper">
      {/* Header Card */}
      <div className="config-header-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: '#f0fdfa',
              color: '#129FA9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #ccfbf1',
              flexShrink: 0,
            }}
          >
            <Clock style={{ width: '22px', height: '22px' }} />
          </div>
          <div>
            <h1 className="config-header-title">Presence Configuration</h1>
            <p className="config-header-desc">
              Master work schedules, shift templates, contracted weekly hours, and working day configurations.
            </p>
          </div>
        </div>

        {userCanMutate && (
          <button type="button" onClick={handleOpenCreate} className="btn-primary-teal">
            <Plus style={{ width: '16px', height: '16px' }} />
            <span>Create Work Schedule</span>
          </button>
        )}
      </div>

      {/* Read-Only Manager Notice */}
      {!userCanMutate && (
        <div style={{ padding: '0.85rem 1rem', borderRadius: '10px', backgroundColor: '#fffbe6', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem', color: '#854d0e' }}>
          <AlertCircle style={{ width: '18px', height: '18px', flexShrink: 0, color: '#d97706' }} />
          <span>
            <strong>Read-Only Mode:</strong> You are viewing master data configurations as a Manager. Administrative mutations require HR or HR Admin privileges.
          </span>
        </div>
      )}

      {/* Segmented Tab Controls — Single Tab: Work Schedules */}
      <div className="config-tab-container">
        <button type="button" className="config-tab-item active">
          <span>Work Schedules</span>
          <span className="config-tab-count">{schedules.length}</span>
        </button>
      </div>

      {/* Main Table Card */}
      {loading ? (
        <div className="config-table-card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
          Loading presence configuration...
        </div>
      ) : (
        <div className="config-table-card">
          <div className="config-desktop-table">
            <table className="config-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Work Schedule</th>
                  <th style={{ width: '25%' }}>Working Days</th>
                  <th style={{ width: '15%' }}>Shift Hours</th>
                  <th style={{ width: '12%' }}>Weekly Hours</th>
                  <th style={{ width: '10%' }}>References</th>
                  <th style={{ width: '8%' }}>Status</th>
                  <th style={{ width: '15%' }} className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      No work schedules configured. Click "+ Create Work Schedule" to add one.
                    </td>
                  </tr>
                ) : (
                  schedules.map((sched) => (
                    <tr key={sched.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{sched.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>ID: {sched.id}</div>
                      </td>
                      <td>
                        <span style={{ color: '#334155', fontSize: '0.8125rem' }}>
                          {formatWorkingDays(sched.workingDays)}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500, color: '#0f172a', fontSize: '0.8125rem' }}>
                          {sched.startTime} – {sched.endTime}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: '#475569', fontSize: '0.8125rem', fontWeight: 500 }}>
                          {sched.weeklyHours} hrs/wk
                        </span>
                      </td>
                      <td>
                        <span title={sched.referenceSummary} className={sched.totalReferences > 0 ? 'config-pill-ref' : 'config-pill-ref-zero'}>
                          {sched.totalReferences} ref(s)
                        </span>
                      </td>
                      <td>
                        <span className={sched.active !== false ? 'config-pill-active' : 'config-pill-inactive'}>
                          {sched.active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="config-actions-cell" style={{ justifyContent: 'flex-end' }}>
                          {userCanMutate ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(sched)}
                                className="config-action-btn edit"
                                title="Edit Work Schedule"
                              >
                                <Edit2 style={{ width: '14px', height: '14px' }} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleActive(sched)}
                                className={`config-action-btn ${sched.active !== false ? 'deactivate' : 'activate'}`}
                                title={sched.active !== false ? 'Deactivate Schedule' : 'Activate Schedule'}
                              >
                                <Power style={{ width: '14px', height: '14px' }} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteClick(sched)}
                                className="config-action-btn delete"
                                title="Delete Work Schedule"
                              >
                                <Trash2 style={{ width: '14px', height: '14px' }} />
                              </button>
                            </>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Read-only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="config-mobile-cards">
            {schedules.map((sched) => (
              <div key={sched.id} className="config-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <div className="config-card-title">{sched.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ID: {sched.id}</div>
                  </div>
                  <span className={sched.active !== false ? 'config-pill-active' : 'config-pill-inactive'}>
                    {sched.active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="config-card-meta">
                  <div className="config-card-meta-row">
                    <span className="config-card-meta-label">Working Days</span>
                    <span className="config-card-meta-value">{formatWorkingDays(sched.workingDays)}</span>
                  </div>
                  <div className="config-card-meta-row">
                    <span className="config-card-meta-label">Shift Hours</span>
                    <span className="config-card-meta-value">{sched.startTime} – {sched.endTime}</span>
                  </div>
                  <div className="config-card-meta-row">
                    <span className="config-card-meta-label">Weekly Hours</span>
                    <span className="config-card-meta-value">{sched.weeklyHours} hrs/wk</span>
                  </div>
                  <div className="config-card-meta-row">
                    <span className="config-card-meta-label">References</span>
                    <span className={sched.totalReferences > 0 ? 'config-pill-ref' : 'config-pill-ref-zero'}>
                      {sched.totalReferences} ref(s)
                    </span>
                  </div>
                </div>

                {userCanMutate && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(sched)}
                      className="btn-secondary-cancel"
                      style={{ flex: 1, padding: '0.375rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      <Edit2 style={{ width: '12px', height: '12px', marginRight: '4px' }} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(sched)}
                      className="btn-secondary-cancel"
                      style={{ flex: 1, padding: '0.375rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      <Power style={{ width: '12px', height: '12px', marginRight: '4px' }} />
                      {sched.active !== false ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(sched)}
                      className="btn-secondary-cancel"
                      style={{ padding: '0.375rem 0.5rem', fontSize: '0.75rem', color: '#dc2626', borderColor: '#fecaca' }}
                    >
                      <Trash2 style={{ width: '12px', height: '12px' }} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedule Create / Edit Modal */}
      <ScheduleModal
        isOpen={scheduleModalOpen}
        onClose={() => {
          setScheduleModalOpen(false);
          setSelectedSchedule(null);
        }}
        onSave={handleSaveSchedule}
        schedule={selectedSchedule}
        allSchedules={schedules}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeleteTarget(null);
        }}
        onConfirmDelete={handleConfirmDelete}
        onConfirmDeactivate={handleConfirmDeactivate}
        entityType="Work Schedule"
        entityName={deleteTarget?.name || ''}
        totalReferences={deleteTarget?.totalReferences || 0}
        referenceSummary={deleteTarget?.referenceSummary || ''}
        isActive={deleteTarget?.active !== false}
      />
    </div>
  );
}
