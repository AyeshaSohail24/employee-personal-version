import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Trash2, Power, AlertCircle, ShieldAlert } from 'lucide-react';
import { useRole } from '../../state/RoleContext';
import { configurationService } from '../../services/configurationService';
import { employeeService } from '../../services/employeeService';
import { canUserMutate } from '../../domain/configurationDomain';
import { DepartmentModal } from '../../components/configuration/DepartmentModal';
import { PositionModal } from '../../components/configuration/PositionModal';
import { LocationModal } from '../../components/configuration/LocationModal';
import { DeleteConfirmModal } from '../../components/configuration/DeleteConfirmModal';

export default function OrganizationConfigPage() {
  const { currentRole, isEmployee, isManager } = useRole();
  const userCanMutate = canUserMutate(currentRole);

  const [activeTab, setActiveTab] = useState('departments'); // 'departments' | 'positions' | 'locations'
  const [config, setConfig] = useState({ departments: [], positions: [], locations: [] });
  const [activeEmployees, setActiveEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState(null);

  const [posModalOpen, setPosModalOpen] = useState(false);
  const [selectedPos, setSelectedPos] = useState(null);

  const [locModalOpen, setLocModalOpen] = useState(false);
  const [selectedLoc, setSelectedLoc] = useState(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteItemType, setDeleteItemType] = useState('record');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await configurationService.getOrganizationConfig();
      setConfig(data);
      const emps = await employeeService.getAll();
      setActiveEmployees(emps.filter((e) => e.status === 'Active'));
    } catch (err) {
      console.error('Failed to load organization config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // Explicitly reset all modal states on tab switch to prevent leaks
    setDeptModalOpen(false);
    setSelectedDept(null);
    setPosModalOpen(false);
    setSelectedPos(null);
    setLocModalOpen(false);
    setSelectedLoc(null);
    setDeleteModalOpen(false);
    setDeleteItem(null);
  };

  const handleOpenCreate = () => {
    if (!userCanMutate) return;
    if (activeTab === 'departments') {
      setSelectedDept(null);
      setDeptModalOpen(true);
    } else if (activeTab === 'positions') {
      setSelectedPos(null);
      setPosModalOpen(true);
    } else if (activeTab === 'locations') {
      setSelectedLoc(null);
      setLocModalOpen(true);
    }
  };

  const handleSaveDepartment = async (cleanData) => {
    if (selectedDept) {
      await configurationService.updateDepartment(selectedDept.id, cleanData, currentRole);
    } else {
      await configurationService.createDepartment(cleanData, currentRole);
    }
    await loadData();
  };

  const handleSavePosition = async (cleanData) => {
    if (selectedPos) {
      await configurationService.updatePosition(selectedPos.id, cleanData, currentRole);
    } else {
      await configurationService.createPosition(cleanData, currentRole);
    }
    await loadData();
  };

  const handleSaveLocation = async (cleanData) => {
    if (selectedLoc) {
      await configurationService.updateLocation(selectedLoc.id, cleanData, currentRole);
    } else {
      await configurationService.createLocation(cleanData, currentRole);
    }
    await loadData();
  };

  const handleToggleActive = async (id, type) => {
    if (!userCanMutate) return;
    try {
      if (type === 'department') {
        await configurationService.toggleDepartmentActive(id, currentRole);
      } else if (type === 'position') {
        await configurationService.togglePositionActive(id, currentRole);
      } else if (type === 'location') {
        await configurationService.toggleLocationActive(id, currentRole);
      }
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenDelete = (item, type) => {
    if (!userCanMutate) return;
    setDeleteItem(item);
    setDeleteItemType(type);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (id) => {
    if (deleteItemType === 'department') {
      await configurationService.deleteDepartment(id, currentRole);
    } else if (deleteItemType === 'position') {
      await configurationService.deletePosition(id, currentRole);
    } else if (deleteItemType === 'location') {
      await configurationService.deleteLocation(id, currentRole);
    }
    await loadData();
  };

  const handleConfirmDeactivate = async (id) => {
    if (deleteItemType === 'department') {
      await configurationService.toggleDepartmentActive(id, currentRole);
    } else if (deleteItemType === 'position') {
      await configurationService.togglePositionActive(id, currentRole);
    } else if (deleteItemType === 'location') {
      await configurationService.toggleLocationActive(id, currentRole);
    }
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
              Master data configuration (Departments, Job Positions, Work Locations) requires HR or HR Admin permissions.
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
      {/* Page Header Banner */}
      <div className="config-header-card">
        <div className="config-header-left">
          <div className="config-header-icon">
            <Building2 style={{ width: '24px', height: '24px' }} />
          </div>
          <div>
            <h1 className="config-header-title">Organization Master Data</h1>
            <p className="config-header-desc">
              Manage departments, job position titles, work locations, and structural assignments.
            </p>
          </div>
        </div>

        {userCanMutate && (
          <button type="button" onClick={handleOpenCreate} className="btn-primary-teal">
            <Plus style={{ width: '16px', height: '16px' }} />
            <span>
              Create {activeTab === 'departments' ? 'Department' : activeTab === 'positions' ? 'Job Position' : 'Work Location'}
            </span>
          </button>
        )}
      </div>

      {/* Read-Only Manager Notice */}
      {isManager && (
        <div style={{ padding: '0.85rem 1rem', borderRadius: '10px', backgroundColor: '#fffbe6', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem', color: '#854d0e' }}>
          <AlertCircle style={{ width: '18px', height: '18px', flexShrink: 0, color: '#d97706' }} />
          <span>
            <strong>Read-Only Mode:</strong> You are viewing master data configurations as a Manager. Administrative mutations require HR or HR Admin privileges.
          </span>
        </div>
      )}

      {/* Segmented Tab Controls — Modern pill style with count badges */}
      <div className="config-tab-container">
        <button
          type="button"
          onClick={() => handleTabChange('departments')}
          className={`config-tab-item ${activeTab === 'departments' ? 'active' : ''}`}
        >
          <span>Departments</span>
          <span className="config-tab-count">{config.departments.length}</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('positions')}
          className={`config-tab-item ${activeTab === 'positions' ? 'active' : ''}`}
        >
          <span>Job Positions</span>
          <span className="config-tab-count">{config.positions.length}</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('locations')}
          className={`config-tab-item ${activeTab === 'locations' ? 'active' : ''}`}
        >
          <span>Work Locations</span>
          <span className="config-tab-count">{config.locations.length}</span>
        </button>
      </div>

      {/* Main Content Card */}
      {loading ? (
        <div className="config-table-card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
          Loading master data configuration...
        </div>
      ) : (
        <div className="config-table-card">
          {/* TAB 1: DEPARTMENTS */}
          {activeTab === 'departments' && (
            <>
              {/* Desktop Table */}
              <div className="config-desktop-table">
                <table className="config-table">
                  <thead>
                    <tr>
                      <th style={{ width: '20%' }}>Department Name</th>
                      <th style={{ width: '8%' }}>Code</th>
                      <th style={{ width: '15%' }}>Parent Dept</th>
                      <th style={{ width: '15%' }}>Head of Dept</th>
                      <th style={{ width: '10%' }}>Headcount</th>
                      <th style={{ width: '8%' }}>References</th>
                      <th style={{ width: '12%' }}>Status</th>
                      <th style={{ width: '12%' }} className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.departments.map((dept) => {
                      const parent = config.departments.find((d) => d.id === dept.parentDepartmentId);
                      return (
                        <tr key={dept.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <span className="config-color-dot" style={{ backgroundColor: dept.color || '#129FA9' }} />
                              <span style={{ fontWeight: 600 }}>{dept.name}</span>
                            </div>
                          </td>
                          <td>
                            <span className="config-pill-inactive" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                              {dept.code}
                            </span>
                          </td>
                          <td style={{ color: '#475569' }}>
                            {parent ? `${parent.name} (${parent.code})` : '— (Top-Level)'}
                          </td>
                          <td style={{ color: '#475569' }}>{dept.managerName || 'Unassigned'}</td>
                          <td style={{ fontWeight: 600 }}>{dept.currentHeadcount} active</td>
                          <td>
                            <span title={dept.referenceSummary} className={dept.totalReferences > 0 ? 'config-pill-ref' : 'config-pill-ref-zero'}>
                              {dept.totalReferences} ref(s)
                            </span>
                          </td>
                          <td>
                            <span className={dept.active !== false ? 'config-pill-active' : 'config-pill-inactive'}>
                              {dept.active !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="text-right">
                            <div className="config-actions-cell">
                              <button
                                type="button"
                                disabled={!userCanMutate}
                                onClick={() => { setSelectedDept(dept); setDeptModalOpen(true); }}
                                className="config-action-btn"
                                title="Edit Department"
                              >
                                <Edit2 style={{ width: '14px', height: '14px' }} />
                              </button>
                              <button
                                type="button"
                                disabled={!userCanMutate}
                                onClick={() => handleToggleActive(dept.id, 'department')}
                                className={`config-action-btn ${dept.active !== false ? 'deactivate' : 'activate'}`}
                                title={dept.active !== false ? 'Deactivate Department' : 'Activate Department'}
                              >
                                <Power style={{ width: '14px', height: '14px' }} />
                              </button>
                              <button
                                type="button"
                                disabled={!userCanMutate}
                                onClick={() => handleOpenDelete(dept, 'department')}
                                className="config-action-btn delete"
                                title="Delete Department"
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

              {/* Mobile Cards */}
              <div className="config-mobile-cards">
                {config.departments.map((dept) => {
                  const parent = config.departments.find((d) => d.id === dept.parentDepartmentId);
                  return (
                    <div key={dept.id} className="config-mobile-card">
                      <div className="config-mobile-card-header">
                        <div className="config-mobile-card-title">
                          <span className="config-color-dot" style={{ backgroundColor: dept.color || '#129FA9' }} />
                          <span>{dept.name}</span>
                        </div>
                        <span className="config-pill-inactive" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                          {dept.code}
                        </span>
                      </div>
                      <div className="config-mobile-card-body">
                        <div>Parent: {parent ? `${parent.name} (${parent.code})` : 'Top-Level'}</div>
                        <div>Head: {dept.managerName || 'Unassigned'}</div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600 }}>{dept.currentHeadcount} headcount</span>
                          <span>•</span>
                          <span className={dept.totalReferences > 0 ? 'config-pill-ref' : 'config-pill-ref-zero'}>{dept.totalReferences} ref(s)</span>
                        </div>
                      </div>
                      <div className="config-mobile-card-footer">
                        <span className={dept.active !== false ? 'config-pill-active' : 'config-pill-inactive'}>
                          {dept.active !== false ? 'Active' : 'Inactive'}
                        </span>
                        <div className="config-actions-cell">
                          <button type="button" disabled={!userCanMutate} onClick={() => { setSelectedDept(dept); setDeptModalOpen(true); }} className="config-action-btn">
                            <Edit2 style={{ width: '14px', height: '14px' }} />
                          </button>
                          <button type="button" disabled={!userCanMutate} onClick={() => handleToggleActive(dept.id, 'department')} className={`config-action-btn ${dept.active !== false ? 'deactivate' : 'activate'}`}>
                            <Power style={{ width: '14px', height: '14px' }} />
                          </button>
                          <button type="button" disabled={!userCanMutate} onClick={() => handleOpenDelete(dept, 'department')} className="config-action-btn delete">
                            <Trash2 style={{ width: '14px', height: '14px' }} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* TAB 2: JOB POSITIONS */}
          {activeTab === 'positions' && (
            <>
              {/* Desktop Table */}
              <div className="config-desktop-table">
                <table className="config-table">
                  <thead>
                    <tr>
                      <th style={{ width: '26%' }}>Position Title</th>
                      <th style={{ width: '19%' }}>Department</th>
                      <th style={{ width: '19%' }}>Default Location</th>
                      <th style={{ width: '12%' }}>Occupants / Refs</th>
                      <th style={{ width: '12%' }}>Status</th>
                      <th style={{ width: '12%' }} className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.positions.map((pos) => (
                      <tr key={pos.id}>
                        <td style={{ fontWeight: 600 }}>{pos.name}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span className="config-color-dot" style={{ backgroundColor: pos.departmentColor || '#129FA9' }} />
                            <span>{pos.departmentName}</span>
                          </div>
                        </td>
                        <td style={{ color: '#475569' }}>{pos.locationName ? pos.locationName.replace('Rizurf HQ — Kuala Lumpur', 'Rizurf HQ — KL') : '—'}</td>
                        <td>
                          <span className={pos.active !== false ? 'config-pill-active' : 'config-pill-inactive'}>
                            {pos.active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <span style={{ fontWeight: 600 }}>{pos.currentOccupantsCount} current</span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{pos.totalReferences} ref(s)</span>
                          </div>
                        </td>
                        <td className="text-right">
                          <div className="config-actions-cell">
                            <button
                              type="button"
                              disabled={!userCanMutate}
                              onClick={() => { setSelectedPos(pos); setPosModalOpen(true); }}
                              className="config-action-btn"
                              title="Edit Job Position"
                            >
                              <Edit2 style={{ width: '14px', height: '14px' }} />
                            </button>
                            <button
                              type="button"
                              disabled={!userCanMutate}
                              onClick={() => handleToggleActive(pos.id, 'position')}
                              className={`config-action-btn ${pos.active !== false ? 'deactivate' : 'activate'}`}
                              title={pos.active !== false ? 'Deactivate Job Position' : 'Activate Job Position'}
                            >
                              <Power style={{ width: '14px', height: '14px' }} />
                            </button>
                            <button
                              type="button"
                              disabled={!userCanMutate}
                              onClick={() => handleOpenDelete(pos, 'position')}
                              className="config-action-btn delete"
                              title="Delete Job Position"
                            >
                              <Trash2 style={{ width: '14px', height: '14px' }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="config-mobile-cards">
                {config.positions.map((pos) => (
                  <div key={pos.id} className="config-mobile-card">
                    <div className="config-mobile-card-title">{pos.name}</div>
                    <div className="config-mobile-card-body">
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className="config-color-dot" style={{ backgroundColor: pos.departmentColor || '#129FA9' }} />
                        <span>Dept: <strong>{pos.departmentName}</strong></span>
                      </div>
                      <div>Location: {pos.locationName ? pos.locationName.replace('Rizurf HQ — Kuala Lumpur', 'Rizurf HQ — KL') : '—'}</div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{pos.currentOccupantsCount} occupants</span>
                        <span>•</span>
                        <span className={pos.totalReferences > 0 ? 'config-pill-ref' : 'config-pill-ref-zero'}>{pos.totalReferences} ref(s)</span>
                      </div>
                    </div>
                    <div className="config-mobile-card-footer">
                      <span className={pos.active !== false ? 'config-pill-active' : 'config-pill-inactive'}>
                        {pos.active !== false ? 'Active' : 'Inactive'}
                      </span>
                      <div className="config-actions-cell">
                        <button type="button" disabled={!userCanMutate} onClick={() => { setSelectedPos(pos); setPosModalOpen(true); }} className="config-action-btn">
                          <Edit2 style={{ width: '14px', height: '14px' }} />
                        </button>
                        <button type="button" disabled={!userCanMutate} onClick={() => handleToggleActive(pos.id, 'position')} className={`config-action-btn ${pos.active !== false ? 'deactivate' : 'activate'}`}>
                          <Power style={{ width: '14px', height: '14px' }} />
                        </button>
                        <button type="button" disabled={!userCanMutate} onClick={() => handleOpenDelete(pos, 'position')} className="config-action-btn delete">
                          <Trash2 style={{ width: '14px', height: '14px' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* TAB 3: WORK LOCATIONS */}
          {activeTab === 'locations' && (
            <>
              {/* Desktop Table */}
              <div className="config-desktop-table">
                <table className="config-table">
                  <thead>
                    <tr>
                      <th style={{ width: '20%' }}>Location Name</th>
                      <th style={{ width: '10%' }}>Type</th>
                      <th style={{ width: '24%' }}>Address</th>
                      <th style={{ width: '12%' }}>Workforce</th>
                      <th style={{ width: '10%' }}>References</th>
                      <th style={{ width: '12%' }}>Status</th>
                      <th style={{ width: '12%' }} className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.locations.map((loc) => (
                      <tr key={loc.id}>
                        <td style={{ fontWeight: 600 }}>{loc.name}</td>
                        <td>
                          <span className="config-pill-inactive" style={{ fontWeight: 600, color: '#6b21a8', backgroundColor: '#f3e8ff', borderColor: '#e9d5ff' }}>
                            {loc.type}
                          </span>
                        </td>
                        <td style={{ color: '#64748b' }}>{loc.address}</td>
                        <td style={{ fontWeight: 600 }}>{loc.currentWorkforceCount} assigned</td>
                        <td>
                          <span title={loc.referenceSummary} className={loc.totalReferences > 0 ? 'config-pill-ref' : 'config-pill-ref-zero'}>
                            {loc.totalReferences} ref(s)
                          </span>
                        </td>
                        <td>
                          <span className={loc.active !== false ? 'config-pill-active' : 'config-pill-inactive'}>
                            {loc.active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="config-actions-cell">
                            <button
                              type="button"
                              disabled={!userCanMutate}
                              onClick={() => { setSelectedLoc(loc); setLocModalOpen(true); }}
                              className="config-action-btn"
                              title="Edit Work Location"
                            >
                              <Edit2 style={{ width: '14px', height: '14px' }} />
                            </button>
                            <button
                              type="button"
                              disabled={!userCanMutate}
                              onClick={() => handleToggleActive(loc.id, 'location')}
                              className={`config-action-btn ${loc.active !== false ? 'deactivate' : 'activate'}`}
                              title={loc.active !== false ? 'Deactivate Work Location' : 'Activate Work Location'}
                            >
                              <Power style={{ width: '14px', height: '14px' }} />
                            </button>
                            <button
                              type="button"
                              disabled={!userCanMutate}
                              onClick={() => handleOpenDelete(loc, 'location')}
                              className="config-action-btn delete"
                              title="Delete Work Location"
                            >
                              <Trash2 style={{ width: '14px', height: '14px' }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="config-mobile-cards">
                {config.locations.map((loc) => (
                  <div key={loc.id} className="config-mobile-card">
                    <div className="config-mobile-card-header">
                      <span className="config-mobile-card-title">{loc.name}</span>
                      <span className="config-pill-inactive" style={{ fontWeight: 600, color: '#6b21a8', backgroundColor: '#f3e8ff' }}>{loc.type}</span>
                    </div>
                    <div className="config-mobile-card-body">
                      <div>{loc.address}</div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{loc.currentWorkforceCount} workforce</span>
                        <span>•</span>
                        <span className={loc.totalReferences > 0 ? 'config-pill-ref' : 'config-pill-ref-zero'}>{loc.totalReferences} ref(s)</span>
                      </div>
                    </div>
                    <div className="config-mobile-card-footer">
                      <span className={loc.active !== false ? 'config-pill-active' : 'config-pill-inactive'}>
                        {loc.active !== false ? 'Active' : 'Inactive'}
                      </span>
                      <div className="config-actions-cell">
                        <button type="button" disabled={!userCanMutate} onClick={() => { setSelectedLoc(loc); setLocModalOpen(true); }} className="config-action-btn">
                          <Edit2 style={{ width: '14px', height: '14px' }} />
                        </button>
                        <button type="button" disabled={!userCanMutate} onClick={() => handleToggleActive(loc.id, 'location')} className={`config-action-btn ${loc.active !== false ? 'deactivate' : 'activate'}`}>
                          <Power style={{ width: '14px', height: '14px' }} />
                        </button>
                        <button type="button" disabled={!userCanMutate} onClick={() => handleOpenDelete(loc, 'location')} className="config-action-btn delete">
                          <Trash2 style={{ width: '14px', height: '14px' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modals — Scoped strictly to tab state to avoid leaking */}
      <DepartmentModal
        isOpen={activeTab === 'departments' && deptModalOpen}
        onClose={() => setDeptModalOpen(false)}
        onSave={handleSaveDepartment}
        department={selectedDept}
        allDepartments={config.departments}
        activeEmployees={activeEmployees}
      />

      <PositionModal
        isOpen={activeTab === 'positions' && posModalOpen}
        onClose={() => setPosModalOpen(false)}
        onSave={handleSavePosition}
        position={selectedPos}
        activeDepartments={config.departments.filter((d) => d.active !== false)}
        activeLocations={config.locations.filter((l) => l.active !== false)}
      />

      <LocationModal
        isOpen={activeTab === 'locations' && locModalOpen}
        onClose={() => setLocModalOpen(false)}
        onSave={handleSaveLocation}
        location={selectedLoc}
        allLocations={config.locations}
      />

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirmDelete={handleConfirmDelete}
        onConfirmDeactivate={handleConfirmDeactivate}
        item={deleteItem}
        itemType={deleteItemType}
      />
    </div>
  );
}
