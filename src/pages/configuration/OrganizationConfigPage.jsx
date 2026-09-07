import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Trash2, Power, AlertCircle, ShieldAlert, Layers, MapPin, Briefcase } from 'lucide-react';
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
    // Explicitly unmount and reset all modal states on tab switch to prevent stale leaks
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
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 text-center max-w-2xl mx-auto my-12">
          <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Master Data Access Restricted</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Master data configuration (Departments, Job Positions, Work Locations) requires HR or HR Admin permissions.
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#129FA9]/10 text-[#129FA9] flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Organization Master Data</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Manage departments, job position titles, work locations, and structural assignments.
            </p>
          </div>
        </div>

        {userCanMutate && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#129FA9] hover:bg-[#0e7c85] text-white text-sm font-semibold rounded-lg shadow-sm transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>
              Create {activeTab === 'departments' ? 'Department' : activeTab === 'positions' ? 'Job Position' : 'Work Location'}
            </span>
          </button>
        )}
      </div>

      {/* Read-Only Manager Banners */}
      {isManager && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-center gap-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            <strong>Read-Only Mode:</strong> You are viewing master data configurations as a Manager. Administrative mutations require HR or HR Admin privileges.
          </span>
        </div>
      )}

      {/* Segmented Tab Controls — Modern pill style with count badges, NO oversized icons */}
      <div className="inline-flex bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700 gap-1.5">
        <button
          type="button"
          onClick={() => handleTabChange('departments')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'departments'
              ? 'bg-teal-50 dark:bg-teal-950/40 text-[#129FA9] dark:text-teal-300 shadow-sm border border-teal-200/60 dark:border-teal-800/50 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
          }`}
        >
          <span>Departments</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
            activeTab === 'departments'
              ? 'bg-[#129FA9]/15 text-[#129FA9] dark:bg-teal-900/50 dark:text-teal-300'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
          }`}>
            {config.departments.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('positions')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'positions'
              ? 'bg-teal-50 dark:bg-teal-950/40 text-[#129FA9] dark:text-teal-300 shadow-sm border border-teal-200/60 dark:border-teal-800/50 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
          }`}
        >
          <span>Job Positions</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
            activeTab === 'positions'
              ? 'bg-[#129FA9]/15 text-[#129FA9] dark:bg-teal-900/50 dark:text-teal-300'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
          }`}>
            {config.positions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('locations')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'locations'
              ? 'bg-teal-50 dark:bg-teal-950/40 text-[#129FA9] dark:text-teal-300 shadow-sm border border-teal-200/60 dark:border-teal-800/50 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
          }`}
        >
          <span>Work Locations</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
            activeTab === 'locations'
              ? 'bg-[#129FA9]/15 text-[#129FA9] dark:bg-teal-900/50 dark:text-teal-300'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
          }`}>
            {config.locations.length}
          </span>
        </button>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white dark:bg-slate-800 p-12 text-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500">
          Loading master data configuration...
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {/* TAB 1: DEPARTMENTS */}
          {activeTab === 'departments' && (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-bold border-b border-slate-200 dark:border-slate-700">
                      <th className="px-4 py-3">Department Name</th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Parent Dept</th>
                      <th className="px-4 py-3">Head of Dept</th>
                      <th className="px-4 py-3">Headcount</th>
                      <th className="px-4 py-3">References</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {config.departments.map((dept) => {
                      const parent = config.departments.find((d) => d.id === dept.parentDepartmentId);
                      return (
                        <tr key={dept.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0 inline-block" style={{ backgroundColor: dept.color || '#3b82f6' }} />
                              <span className="truncate">{dept.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                              {dept.code}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                            {parent ? `${parent.name} (${parent.code})` : '— (Top-Level)'}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{dept.managerName || 'Unassigned'}</td>
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">{dept.currentHeadcount} active</td>
                          <td className="px-4 py-3">
                            <span
                              title={dept.referenceSummary}
                              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                                dept.totalReferences > 0
                                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {dept.totalReferences} ref(s)
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                                dept.active !== false
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {dept.active !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={!userCanMutate}
                                onClick={() => {
                                  setSelectedDept(dept);
                                  setDeptModalOpen(true);
                                }}
                                className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Edit Department"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={!userCanMutate}
                                onClick={() => handleToggleActive(dept.id, 'department')}
                                className={`w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                                  dept.active !== false
                                    ? 'text-slate-600 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200'
                                    : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                                }`}
                                title={dept.active !== false ? 'Deactivate Department' : 'Activate Department'}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={!userCanMutate}
                                onClick={() => handleOpenDelete(dept, 'department')}
                                className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Delete Department"
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
              <div className="block md:hidden p-4 space-y-3">
                {config.departments.map((dept) => {
                  const parent = config.departments.find((d) => d.id === dept.parentDepartmentId);
                  return (
                    <div key={dept.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dept.color || '#3b82f6' }} />
                          <span className="font-bold text-sm text-slate-900 dark:text-white">{dept.name}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {dept.code}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                        <div>Parent: {parent ? `${parent.name} (${parent.code})` : 'Top-Level'}</div>
                        <div>Head: {dept.managerName || 'Unassigned'}</div>
                        <div className="flex items-center gap-2 pt-1">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{dept.currentHeadcount} headcount</span>
                          <span>•</span>
                          <span className="text-blue-600 dark:text-blue-400 font-medium">{dept.totalReferences} ref(s)</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${dept.active !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {dept.active !== false ? 'Active' : 'Inactive'}
                        </span>
                        <div className="flex items-center gap-2">
                          <button type="button" disabled={!userCanMutate} onClick={() => { setSelectedDept(dept); setDeptModalOpen(true); }} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" disabled={!userCanMutate} onClick={() => handleToggleActive(dept.id, 'department')} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-amber-50">
                            <Power className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" disabled={!userCanMutate} onClick={() => handleOpenDelete(dept, 'department')} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
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
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-bold border-b border-slate-200 dark:border-slate-700">
                      <th className="px-4 py-3" style={{ width: '32%' }}>Position Title</th>
                      <th className="px-4 py-3" style={{ width: '22%' }}>Department</th>
                      <th className="px-4 py-3" style={{ width: '20%' }}>Default Location</th>
                      <th className="px-4 py-3" style={{ width: '10%' }}>Status</th>
                      <th className="px-4 py-3" style={{ width: '10%' }}>Occupants / Refs</th>
                      <th className="px-4 py-3 text-right" style={{ width: '6%' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {config.positions.map((pos) => (
                      <tr key={pos.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white leading-snug">{pos.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 inline-block"
                              style={{ backgroundColor: pos.departmentColor || '#129FA9' }}
                            />
                            <span className="text-slate-900 dark:text-white font-medium text-xs">
                              {pos.departmentName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{pos.locationName}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                              pos.active !== false
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {pos.active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col text-xs">
                            <span className="font-medium text-slate-900 dark:text-white whitespace-nowrap">{pos.currentOccupantsCount} current</span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{pos.totalReferences} ref(s)</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={!userCanMutate}
                              onClick={() => {
                                setSelectedPos(pos);
                                setPosModalOpen(true);
                              }}
                              className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Edit Job Position"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={!userCanMutate}
                              onClick={() => handleToggleActive(pos.id, 'position')}
                              className={`w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                                pos.active !== false
                                  ? 'text-slate-600 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200'
                                  : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                              }`}
                              title={pos.active !== false ? 'Deactivate Job Position' : 'Activate Job Position'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={!userCanMutate}
                              onClick={() => handleOpenDelete(pos, 'position')}
                              className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Delete Job Position"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Responsive Cards */}
              <div className="block md:hidden p-4 space-y-3">
                {config.positions.map((pos) => (
                  <div key={pos.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm space-y-2">
                    <div className="font-bold text-sm text-slate-900 dark:text-white">{pos.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: pos.departmentColor || '#129FA9' }} />
                        <span>Dept: <span className="font-semibold text-slate-700 dark:text-slate-300">{pos.departmentName}</span></span>
                      </div>
                      <div>Location: {pos.locationName}</div>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{pos.currentOccupantsCount} occupants</span>
                        <span>•</span>
                        <span className="text-blue-600 dark:text-blue-400 font-medium">{pos.totalReferences} ref(s)</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${pos.active !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {pos.active !== false ? 'Active' : 'Inactive'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button type="button" disabled={!userCanMutate} onClick={() => { setSelectedPos(pos); setPosModalOpen(true); }} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" disabled={!userCanMutate} onClick={() => handleToggleActive(pos.id, 'position')} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-amber-50">
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" disabled={!userCanMutate} onClick={() => handleOpenDelete(pos, 'position')} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
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
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-bold border-b border-slate-200 dark:border-slate-700">
                      <th className="px-4 py-3" style={{ width: '25%' }}>Location Name</th>
                      <th className="px-4 py-3" style={{ width: '15%' }}>Type</th>
                      <th className="px-4 py-3" style={{ width: '30%' }}>Address</th>
                      <th className="px-4 py-3" style={{ width: '10%' }}>Workforce</th>
                      <th className="px-4 py-3" style={{ width: '10%' }}>References</th>
                      <th className="px-4 py-3" style={{ width: '5%' }}>Status</th>
                      <th className="px-4 py-3 text-right" style={{ width: '5%' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {config.locations.map((loc) => (
                      <tr key={loc.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{loc.name}</td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            {loc.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">{loc.address}</td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">{loc.currentWorkforceCount} assigned</td>
                        <td className="px-4 py-3">
                          <span
                            title={loc.referenceSummary}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                              loc.totalReferences > 0
                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {loc.totalReferences} ref(s)
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                              loc.active !== false
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {loc.active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={!userCanMutate}
                              onClick={() => {
                                setSelectedLoc(loc);
                                setLocModalOpen(true);
                              }}
                              className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Edit Work Location"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={!userCanMutate}
                              onClick={() => handleToggleActive(loc.id, 'location')}
                              className={`w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                                loc.active !== false
                                  ? 'text-slate-600 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200'
                                  : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                              }`}
                              title={loc.active !== false ? 'Deactivate Work Location' : 'Activate Work Location'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={!userCanMutate}
                              onClick={() => handleOpenDelete(loc, 'location')}
                              className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Delete Work Location"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Responsive Cards */}
              <div className="block md:hidden p-4 space-y-3">
                {config.locations.map((loc) => (
                  <div key={loc.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{loc.name}</span>
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700">{loc.type}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                      <div>{loc.address}</div>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{loc.currentWorkforceCount} workforce</span>
                        <span>•</span>
                        <span className="text-blue-600 dark:text-blue-400 font-medium">{loc.totalReferences} ref(s)</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${loc.active !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {loc.active !== false ? 'Active' : 'Inactive'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button type="button" disabled={!userCanMutate} onClick={() => { setSelectedLoc(loc); setLocModalOpen(true); }} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" disabled={!userCanMutate} onClick={() => handleToggleActive(loc.id, 'location')} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-amber-50">
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" disabled={!userCanMutate} onClick={() => handleOpenDelete(loc, 'location')} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
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

