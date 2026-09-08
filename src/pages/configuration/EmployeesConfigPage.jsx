import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Power, AlertCircle, ShieldAlert } from 'lucide-react';
import { useRole } from '../../state/RoleContext';
import { configurationService } from '../../services/configurationService';
import { canUserMutate } from '../../domain/configurationDomain';
import { EmployeeTypeModal } from '../../components/configuration/EmployeeTypeModal';
import { EmployeeTagModal } from '../../components/configuration/EmployeeTagModal';
import { DeleteConfirmModal } from '../../components/configuration/DeleteConfirmModal';

export default function EmployeesConfigPage() {
  const { currentRole, isEmployee } = useRole();
  const userCanMutate = canUserMutate(currentRole);

  const [activeTab, setActiveTab] = useState('types'); // 'types' | 'tags'
  const [employeeTypes, setEmployeeTypes] = useState([]);
  const [employeeTags, setEmployeeTags] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states for Employee Type
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(null);

  // Modal states for Employee Tag
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null);

  // Delete Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'type'|'tag', item: object }

  const loadData = async () => {
    setLoading(true);
    try {
      const config = await configurationService.getEmployeesConfig();
      setEmployeeTypes(config.employeeTypes || []);
      setEmployeeTags(config.employeeTags || []);
    } catch (err) {
      console.error('Failed to load employees configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setTypeModalOpen(false);
    setSelectedType(null);
    setTagModalOpen(false);
    setSelectedTag(null);
    setDeleteModalOpen(false);
    setDeleteTarget(null);
  };

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

  // --- Employment Type Handlers ---
  const handleSaveType = async (typeData) => {
    if (selectedType) {
      await configurationService.updateEmployeeType(selectedType.id, typeData, currentRole);
    } else {
      await configurationService.createEmployeeType(typeData, currentRole);
    }
    await loadData();
  };

  const handleToggleTypeActive = async (type) => {
    if (!userCanMutate) return;
    await configurationService.toggleEmployeeTypeActive(type.id, currentRole);
    await loadData();
  };

  const handleDeleteTypeClick = (type) => {
    if (!userCanMutate) return;
    setDeleteTarget({ type: 'type', item: type });
    setDeleteModalOpen(true);
  };

  // --- Employee Tag Handlers ---
  const handleSaveTag = async (tagData) => {
    if (selectedTag) {
      await configurationService.updateEmployeeTag(selectedTag.id, tagData, currentRole);
    } else {
      await configurationService.createEmployeeTag(tagData, currentRole);
    }
    await loadData();
  };

  const handleToggleTagActive = async (tag) => {
    if (!userCanMutate) return;
    await configurationService.toggleEmployeeTagActive(tag.id, currentRole);
    await loadData();
  };

  const handleDeleteTagClick = (tag) => {
    if (!userCanMutate) return;
    setDeleteTarget({ type: 'tag', item: tag });
    setDeleteModalOpen(true);
  };

  // --- Confirm Delete Handler ---
  const handleConfirmDelete = async () => {
    if (!deleteTarget || !userCanMutate) return;

    if (deleteTarget.type === 'type') {
      await configurationService.deleteEmployeeType(deleteTarget.item.id, currentRole);
    } else if (deleteTarget.type === 'tag') {
      await configurationService.deleteEmployeeTag(deleteTarget.item.id, currentRole);
    }

    setDeleteModalOpen(false);
    setDeleteTarget(null);
    await loadData();
  };

  return (
    <div className="config-page-wrapper">
      {/* Header Card — Exactly matching Stage 11 */}
      <div className="config-header-card">
        <div className="config-header-left">
          <div className="config-header-icon">
            <Users style={{ width: '1.5rem', height: '1.5rem' }} />
          </div>
          <div>
            <h1 className="config-header-title">Employees Configuration</h1>
            <p className="config-header-desc">
              Manage employment types and employee tags/classifications.
            </p>
          </div>
        </div>

        {userCanMutate && (
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'types') {
                setSelectedType(null);
                setTypeModalOpen(true);
              } else {
                setSelectedTag(null);
                setTagModalOpen(true);
              }
            }}
            className="btn-primary-teal"
          >
            <Plus style={{ width: '16px', height: '16px' }} />
            <span>{activeTab === 'types' ? 'Create Employment Type' : 'Create Employee Tag'}</span>
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

      {/* Segmented Tab Controls — Standard Stage 11 pill style with count badges */}
      <div className="config-tab-container">
        <button
          type="button"
          onClick={() => handleTabChange('types')}
          className={`config-tab-item ${activeTab === 'types' ? 'active' : ''}`}
        >
          <span>Employment Types</span>
          <span className="config-tab-count">{employeeTypes.length}</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('tags')}
          className={`config-tab-item ${activeTab === 'tags' ? 'active' : ''}`}
        >
          <span>Employee Tags</span>
          <span className="config-tab-count">{employeeTags.length}</span>
        </button>
      </div>

      {/* Main Table Card */}
      {loading ? (
        <div className="config-table-card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
          Loading master data configuration...
        </div>
      ) : activeTab === 'types' ? (
        /* TAB 1: EMPLOYMENT TYPES */
        <div className="config-table-card">
          <div className="config-desktop-table">
            <table className="config-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Employment Type</th>
                  <th style={{ width: '12%' }}>Code</th>
                  <th style={{ width: '28%' }}>Description</th>
                  <th style={{ width: '12%' }}>References</th>
                  <th style={{ width: '12%' }}>Status</th>
                  <th style={{ width: '14%' }} className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employeeTypes.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      No employment types configured. Click "+ Create Employment Type" to add one.
                    </td>
                  </tr>
                ) : (
                  employeeTypes.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span style={{ fontWeight: 600 }}>{item.name}</span>
                      </td>
                      <td>
                        <span className="config-pill-inactive" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                          {item.code}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: '#475569', fontSize: '0.8125rem' }}>
                          {item.description || '—'}
                        </span>
                      </td>
                      <td>
                        <span title={item.referenceSummary} className={item.totalReferences > 0 ? 'config-pill-ref' : 'config-pill-ref-zero'}>
                          {item.totalReferences} ref(s)
                        </span>
                      </td>
                      <td>
                        <span className={item.active !== false ? 'config-pill-active' : 'config-pill-inactive'}>
                          {item.active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="config-actions-cell">
                          <button
                            type="button"
                            disabled={!userCanMutate}
                            onClick={() => {
                              setSelectedType(item);
                              setTypeModalOpen(true);
                            }}
                            className="config-action-btn"
                            title="Edit Employment Type"
                          >
                            <Edit2 style={{ width: '15px', height: '15px' }} />
                          </button>

                          <button
                            type="button"
                            disabled={!userCanMutate}
                            onClick={() => handleToggleTypeActive(item)}
                            className={`config-action-btn ${item.active !== false ? 'deactivate' : 'activate'}`}
                            title={item.active !== false ? 'Deactivate Employment Type' : 'Activate Employment Type'}
                          >
                            <Power style={{ width: '15px', height: '15px' }} />
                          </button>

                          <button
                            type="button"
                            disabled={!userCanMutate}
                            onClick={() => handleDeleteTypeClick(item)}
                            className="config-action-btn delete"
                            title={item.canDelete ? 'Delete Employment Type' : item.referenceSummary}
                          >
                            <Trash2 style={{ width: '15px', height: '15px' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards for Employment Types */}
          <div className="config-mobile-cards">
            {employeeTypes.map((item) => (
              <div key={item.id} className="config-mobile-card">
                <div className="config-mobile-card-header">
                  <div>
                    <h3 className="config-mobile-card-title">{item.name}</h3>
                    <span className="config-pill-inactive" style={{ fontFamily: 'monospace', fontWeight: 700, marginTop: '0.25rem', display: 'inline-block' }}>
                      {item.code}
                    </span>
                  </div>
                  <span className={item.active !== false ? 'config-pill-active' : 'config-pill-inactive'}>
                    {item.active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <p style={{ fontSize: '0.8125rem', color: '#475569', margin: '0.5rem 0' }}>
                  {item.description || 'No description provided.'}
                </p>

                <div className="config-mobile-card-footer">
                  <span className={item.totalReferences > 0 ? 'config-pill-ref' : 'config-pill-ref-zero'}>
                    {item.totalReferences} ref(s)
                  </span>
                  <div className="config-actions-cell">
                    <button
                      type="button"
                      disabled={!userCanMutate}
                      onClick={() => {
                        setSelectedType(item);
                        setTypeModalOpen(true);
                      }}
                      className="config-action-btn"
                      title="Edit Employment Type"
                    >
                      <Edit2 style={{ width: '15px', height: '15px' }} />
                    </button>
                    <button
                      type="button"
                      disabled={!userCanMutate}
                      onClick={() => handleToggleTypeActive(item)}
                      className={`config-action-btn ${item.active !== false ? 'deactivate' : 'activate'}`}
                      title={item.active !== false ? 'Deactivate Type' : 'Activate Type'}
                    >
                      <Power style={{ width: '15px', height: '15px' }} />
                    </button>
                    <button
                      type="button"
                      disabled={!userCanMutate}
                      onClick={() => handleDeleteTypeClick(item)}
                      className="config-action-btn delete"
                      title={item.canDelete ? 'Delete Type' : item.referenceSummary}
                    >
                      <Trash2 style={{ width: '15px', height: '15px' }} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* TAB 2: EMPLOYEE TAGS */
        <div className="config-table-card">
          <div className="config-desktop-table">
            <table className="config-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Tag Name</th>
                  <th style={{ width: '16%' }}>Color</th>
                  <th style={{ width: '17%' }}>Category</th>
                  <th style={{ width: '12%' }}>References</th>
                  <th style={{ width: '12%' }}>Status</th>
                  <th style={{ width: '16%' }} className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employeeTags.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      No employee tags configured. Click "+ Create Employee Tag" to add one.
                    </td>
                  </tr>
                ) : (
                  employeeTags.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="config-color-dot" style={{ backgroundColor: item.color || '#129FA9' }} />
                          <span style={{ fontWeight: 600 }}>{item.name}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'monospace', fontSize: '0.8125rem', color: '#334155' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: item.color || '#129FA9', display: 'inline-block', flexShrink: 0 }} />
                          <span>{item.color || '#129FA9'}</span>
                        </div>
                      </td>
                      <td>
                        <span className="config-pill-inactive" style={{ fontSize: '0.75rem' }}>
                          {item.category || 'General'}
                        </span>
                      </td>
                      <td>
                        <span title={item.referenceSummary} className={item.totalReferences > 0 ? 'config-pill-ref' : 'config-pill-ref-zero'}>
                          {item.totalReferences} ref(s)
                        </span>
                      </td>
                      <td>
                        <span className={item.active !== false ? 'config-pill-active' : 'config-pill-inactive'}>
                          {item.active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="config-actions-cell">
                          <button
                            type="button"
                            disabled={!userCanMutate}
                            onClick={() => {
                              setSelectedTag(item);
                              setTagModalOpen(true);
                            }}
                            className="config-action-btn"
                            title="Edit Employee Tag"
                          >
                            <Edit2 style={{ width: '15px', height: '15px' }} />
                          </button>

                          <button
                            type="button"
                            disabled={!userCanMutate}
                            onClick={() => handleToggleTagActive(item)}
                            className={`config-action-btn ${item.active !== false ? 'deactivate' : 'activate'}`}
                            title={item.active !== false ? 'Deactivate Employee Tag' : 'Activate Employee Tag'}
                          >
                            <Power style={{ width: '15px', height: '15px' }} />
                          </button>

                          <button
                            type="button"
                            disabled={!userCanMutate}
                            onClick={() => handleDeleteTagClick(item)}
                            className="config-action-btn delete"
                            title={item.canDelete ? 'Delete Employee Tag' : item.referenceSummary}
                          >
                            <Trash2 style={{ width: '15px', height: '15px' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards for Employee Tags */}
          <div className="config-mobile-cards">
            {employeeTags.map((item) => (
              <div key={item.id} className="config-mobile-card">
                <div className="config-mobile-card-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="config-color-dot" style={{ backgroundColor: item.color || '#129FA9' }} />
                      <h3 className="config-mobile-card-title">{item.name}</h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                      <span>{item.color || '#129FA9'}</span>
                    </div>
                  </div>
                  <span className={item.active !== false ? 'config-pill-active' : 'config-pill-inactive'}>
                    {item.active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div style={{ margin: '0.5rem 0' }}>
                  <span className="config-pill-inactive" style={{ fontSize: '0.75rem' }}>
                    {item.category || 'General'}
                  </span>
                </div>

                <div className="config-mobile-card-footer">
                  <span className={item.totalReferences > 0 ? 'config-pill-ref' : 'config-pill-ref-zero'}>
                    {item.totalReferences} ref(s)
                  </span>
                  <div className="config-actions-cell">
                    <button
                      type="button"
                      disabled={!userCanMutate}
                      onClick={() => {
                        setSelectedTag(item);
                        setTagModalOpen(true);
                      }}
                      className="config-action-btn"
                      title="Edit Employee Tag"
                    >
                      <Edit2 style={{ width: '15px', height: '15px' }} />
                    </button>
                    <button
                      type="button"
                      disabled={!userCanMutate}
                      onClick={() => handleToggleTagActive(item)}
                      className={`config-action-btn ${item.active !== false ? 'deactivate' : 'activate'}`}
                      title={item.active !== false ? 'Deactivate Tag' : 'Activate Tag'}
                    >
                      <Power style={{ width: '15px', height: '15px' }} />
                    </button>
                    <button
                      type="button"
                      disabled={!userCanMutate}
                      onClick={() => handleDeleteTagClick(item)}
                      className="config-action-btn delete"
                      title={item.canDelete ? 'Delete Tag' : item.referenceSummary}
                    >
                      <Trash2 style={{ width: '15px', height: '15px' }} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <EmployeeTypeModal
        isOpen={typeModalOpen}
        onClose={() => setTypeModalOpen(false)}
        onSave={handleSaveType}
        employeeType={selectedType}
        allTypes={employeeTypes}
      />

      <EmployeeTagModal
        isOpen={tagModalOpen}
        onClose={() => setTagModalOpen(false)}
        onSave={handleSaveTag}
        employeeTag={selectedTag}
        allTags={employeeTags}
      />

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDelete}
        item={deleteTarget?.item}
        itemType={deleteTarget?.type === 'type' ? 'Employment Type' : 'Employee Tag'}
      />
    </div>
  );
}
