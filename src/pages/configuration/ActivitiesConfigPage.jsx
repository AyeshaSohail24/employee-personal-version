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
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 text-center max-w-2xl mx-auto my-12">
          <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Master Data Access Restricted</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Master data configuration (Activity Types) requires HR or HR Admin permissions.
          </p>
          <div className="inline-block px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">
            Current Role: {currentRole}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#129FA9]/10 text-[#129FA9] flex items-center justify-center shrink-0">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Activity Types Master Data</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Configure canonical activity types and workflow task categories used across tasks, onboarding, and offboarding.
            </p>
          </div>
        </div>

        {userCanMutate && (
          <button onClick={handleOpenCreate} className="btn-primary-teal shrink-0">
            <Plus className="w-4 h-4" />
            <span>Create Activity Type</span>
          </button>
        )}
      </div>

      {/* Read-Only Manager Notice */}
      {isManager && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-center gap-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            <strong>Read-Only Mode:</strong> You are viewing Activity Types configuration as a Manager. Administrative mutations require HR or HR Admin privileges.
          </span>
        </div>
      )}

      {/* Main Table Area */}
      {loading ? (
        <div className="bg-white dark:bg-slate-800 p-12 text-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500">
          Loading activity types configuration...
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {/* Desktop Table View */}
          <div className="config-desktop-table overflow-x-auto">
            <table className="config-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Activity Type</th>
                  <th style={{ width: '15%' }}>Icon</th>
                  <th style={{ width: '20%' }}>Category</th>
                  <th style={{ width: '15%' }}>References</th>
                  <th style={{ width: '10%' }}>Status</th>
                  <th style={{ width: '10%' }} className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {types.map((typeItem) => {
                  const IconComponent = ICON_MAP[typeItem.icon] || CheckSquare;
                  return (
                    <tr key={typeItem.id}>
                      <td className="font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-[#129FA9] border border-teal-200/80 dark:border-teal-800 shrink-0">
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <span>{typeItem.name}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 w-fit">
                          <IconComponent className="w-3.5 h-3.5 text-[#129FA9]" />
                          <span className="text-[11px] font-mono font-medium">{typeItem.icon}</span>
                        </div>
                      </td>
                      <td>
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                          {typeItem.category}
                        </span>
                      </td>
                      <td>
                        <span
                          title={typeItem.referenceSummary}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                            typeItem.totalReferences > 0
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {typeItem.totalReferences} ref(s)
                        </span>
                      </td>
                      <td>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                            typeItem.active !== false
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {typeItem.active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            disabled={!userCanMutate}
                            onClick={() => {
                              setSelectedType(typeItem);
                              setModalOpen(true);
                            }}
                            className="config-action-btn"
                            title="Edit Activity Type"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={!userCanMutate}
                            onClick={() => handleToggleActive(typeItem.id)}
                            className={`config-action-btn ${typeItem.active !== false ? 'deactivate' : 'activate'}`}
                            title={typeItem.active !== false ? 'Deactivate Activity Type' : 'Activate Activity Type'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={!userCanMutate}
                            onClick={() => handleOpenDelete(typeItem)}
                            className="config-action-btn delete"
                            title="Delete Activity Type"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
          <div className="config-mobile-cards p-4 space-y-3">
            {types.map((typeItem) => {
              const IconComponent = ICON_MAP[typeItem.icon] || CheckSquare;
              return (
                <div key={typeItem.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-teal-50 text-[#129FA9] border border-teal-200">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">{typeItem.name}</div>
                      <div className="text-xs text-slate-500">{typeItem.category} • {typeItem.icon}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${typeItem.active !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {typeItem.active !== false ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-xs text-blue-600 font-medium">{typeItem.totalReferences} ref(s)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button disabled={!userCanMutate} onClick={() => { setSelectedType(typeItem); setModalOpen(true); }} className="config-action-btn">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button disabled={!userCanMutate} onClick={() => handleToggleActive(typeItem.id)} className="config-action-btn">
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button disabled={!userCanMutate} onClick={() => handleOpenDelete(typeItem)} className="config-action-btn delete">
                        <Trash2 className="w-3.5 h-3.5" />
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
