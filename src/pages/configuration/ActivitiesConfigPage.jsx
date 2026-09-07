import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Plus,
  Edit2,
  Trash2,
  Power,
  AlertCircle,
  ShieldAlert,
  PhoneCall,
  Calendar,
  FileText,
  ClipboardCheck,
  Clock,
} from 'lucide-react';
import { useRole } from '../../state/RoleContext';
import { configurationService } from '../../services/configurationService';
import { canUserMutate } from '../../domain/configurationDomain';
import { ActivityTypeModal } from '../../components/configuration/ActivityTypeModal';
import { DeleteConfirmModal } from '../../components/configuration/DeleteConfirmModal';

const ICON_MAP = {
  CheckSquare,
  PhoneCall,
  Calendar,
  FileText,
  ClipboardCheck,
  Clock,
};

export default function ActivitiesConfigPage() {
  const { currentRole, isEmployee, isManager } = useRole();
  const userCanMutate = canUserMutate(currentRole);

  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await configurationService.getActivitiesConfig();
      setTypes(data);
    } catch (err) {
      console.error('Failed to load activity types config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    if (!userCanMutate) return;
    setSelectedType(null);
    setModalOpen(true);
  };

  const handleSaveType = async (cleanData) => {
    if (selectedType) {
      await configurationService.updateActivityType(selectedType.id, cleanData, currentRole);
    } else {
      await configurationService.createActivityType(cleanData, currentRole);
    }
    await loadData();
  };

  const handleToggleActive = async (id) => {
    if (!userCanMutate) return;
    try {
      await configurationService.toggleActivityTypeActive(id, currentRole);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenDelete = (typeItem) => {
    if (!userCanMutate) return;
    setDeleteItem(typeItem);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (id) => {
    await configurationService.deleteActivityType(id, currentRole);
    await loadData();
  };

  const handleConfirmDeactivate = async (id) => {
    await configurationService.toggleActivityTypeActive(id, currentRole);
    await loadData();
  };

  if (isEmployee) {
    return (
      <div className="config-page-wrapper">
        <div className="config-header-card" style={{ textAlign: 'center', justifyContent: 'center' }}>
          <div>
            <ShieldAlert style={{ width: '48px', height: '48px', color: '#d97706', margin: '0 auto 1rem' }} />
            <h2 className="config-header-title">Master Data Access Restricted</h2>
            <p className="config-header-desc">
              Master data configuration (Activity Types) requires HR or HR Admin permissions.
            </p>
            <div style={{ marginTop: '1rem' }}>
              <span className="config-pill-inactive">Current Role: {currentRole}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="config-page-wrapper">
      {/* Header Banner */}
      <div className="config-header-card">
        <div className="config-header-left">
          <div className="config-header-icon">
            <CheckSquare style={{ width: '24px', height: '24px' }} />
          </div>
          <div>
            <h1 className="config-header-title">Activity Types Master Data</h1>
            <p className="config-header-desc">
              Configure canonical activity types and workflow task categories used across tasks, onboarding, and offboarding.
            </p>
          </div>
        </div>

        {userCanMutate && (
          <button type="button" onClick={handleOpenCreate} className="btn-primary-teal">
            <Plus style={{ width: '16px', height: '16px' }} />
            <span>Create Activity Type</span>
          </button>
        )}
      </div>

      {/* Read-Only Manager Notice */}
      {isManager && (
        <div style={{ padding: '0.85rem 1rem', borderRadius: '10px', backgroundColor: '#fffbe6', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem', color: '#854d0e' }}>
          <AlertCircle style={{ width: '18px', height: '18px', flexShrink: 0, color: '#d97706' }} />
          <span>
            <strong>Read-Only Mode:</strong> You are viewing Activity Types configuration as a Manager. Administrative mutations require HR or HR Admin privileges.
          </span>
        </div>
      )}

      {/* Main Table Area */}
      {loading ? (
        <div className="config-table-card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
          Loading activity types configuration...
        </div>
      ) : (
        <div className="config-table-card">
          {/* Desktop Table View */}
          <div className="config-desktop-table">
            <table className="config-table">
              <thead>
                <tr>
                  <th style={{ width: '26%' }}>Activity Type</th>
                  <th style={{ width: '8%' }}>Icon</th>
                  <th style={{ width: '16%' }}>Category</th>
                  <th style={{ width: '14%' }}>References</th>
                  <th style={{ width: '14%' }}>Status</th>
                  <th style={{ width: '18%' }} className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {types.map((typeItem) => {
                  const IconComponent = ICON_MAP[typeItem.icon] || CheckSquare;
                  return (
                    <tr key={typeItem.id}>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ padding: '0.4rem', borderRadius: '6px', backgroundColor: '#e6f7f8', color: '#129FA9', border: '1px solid #bce7ea', display: 'inline-flex' }}>
                            <IconComponent style={{ width: '16px', height: '16px' }} />
                          </div>
                          <span>{typeItem.name}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', padding: '0.3rem 0.6rem', borderRadius: '6px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', color: '#129FA9' }}>
                          <IconComponent style={{ width: '16px', height: '16px' }} />
                        </div>
                      </td>
                      <td>
                        <span className="config-pill-inactive" style={{ fontWeight: 600, color: '#334155' }}>
                          {typeItem.category}
                        </span>
                      </td>
                      <td>
                        <span title={typeItem.referenceSummary} className={typeItem.totalReferences > 0 ? 'config-pill-ref' : 'config-pill-ref-zero'}>
                          {typeItem.totalReferences} ref(s)
                        </span>
                      </td>
                      <td>
                        <span className={typeItem.active !== false ? 'config-pill-active' : 'config-pill-inactive'}>
                          {typeItem.active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="config-actions-cell">
                          <button
                            type="button"
                            disabled={!userCanMutate}
                            onClick={() => {
                              setSelectedType(typeItem);
                              setModalOpen(true);
                            }}
                            className="config-action-btn"
                            title="Edit Activity Type"
                          >
                            <Edit2 style={{ width: '14px', height: '14px' }} />
                          </button>
                          <button
                            type="button"
                            disabled={!userCanMutate}
                            onClick={() => handleToggleActive(typeItem.id)}
                            className={`config-action-btn ${typeItem.active !== false ? 'deactivate' : 'activate'}`}
                            title={typeItem.active !== false ? 'Deactivate Activity Type' : 'Activate Activity Type'}
                          >
                            <Power style={{ width: '14px', height: '14px' }} />
                          </button>
                          <button
                            type="button"
                            disabled={!userCanMutate}
                            onClick={() => handleOpenDelete(typeItem)}
                            className="config-action-btn delete"
                            title="Delete Activity Type"
                          >
                            <Trash2 style={{ width: '14px', height: '14px' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Cards */}
          <div className="config-mobile-cards">
            {types.map((typeItem) => {
              const IconComponent = ICON_MAP[typeItem.icon] || CheckSquare;
              return (
                <div key={typeItem.id} className="config-mobile-card">
                  <div className="config-mobile-card-header">
                    <div className="config-mobile-card-title">
                      <div style={{ padding: '0.4rem', borderRadius: '6px', backgroundColor: '#e6f7f8', color: '#129FA9', border: '1px solid #bce7ea', display: 'inline-flex' }}>
                        <IconComponent style={{ width: '18px', height: '18px' }} />
                      </div>
                      <span>{typeItem.name}</span>
                    </div>
                    <span className="config-pill-inactive" style={{ fontWeight: 600, color: '#334155' }}>
                      {typeItem.category}
                    </span>
                  </div>
                  <div className="config-mobile-card-body">
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', alignItems: 'center' }}>
                      <span className={typeItem.totalReferences > 0 ? 'config-pill-ref' : 'config-pill-ref-zero'}>{typeItem.totalReferences} ref(s)</span>
                    </div>
                  </div>
                  <div className="config-mobile-card-footer">
                    <span className={typeItem.active !== false ? 'config-pill-active' : 'config-pill-inactive'}>
                      {typeItem.active !== false ? 'Active' : 'Inactive'}
                    </span>
                    <div className="config-actions-cell">
                      <button type="button" disabled={!userCanMutate} onClick={() => { setSelectedType(typeItem); setModalOpen(true); }} className="config-action-btn">
                        <Edit2 style={{ width: '14px', height: '14px' }} />
                      </button>
                      <button type="button" disabled={!userCanMutate} onClick={() => handleToggleActive(typeItem.id)} className={`config-action-btn ${typeItem.active !== false ? 'deactivate' : 'activate'}`}>
                        <Power style={{ width: '14px', height: '14px' }} />
                      </button>
                      <button type="button" disabled={!userCanMutate} onClick={() => handleOpenDelete(typeItem)} className="config-action-btn delete">
                        <Trash2 style={{ width: '14px', height: '14px' }} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      <ActivityTypeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveType}
        activityType={selectedType}
        allTypes={types}
      />

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirmDelete={handleConfirmDelete}
        onConfirmDeactivate={handleConfirmDeactivate}
        item={deleteItem}
        itemType="activity type"
      />
    </div>
  );
}
