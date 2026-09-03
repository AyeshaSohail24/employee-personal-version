import React, { useState, useEffect, useCallback } from 'react';
import { employeeService } from '../../services/employeeService';
import { departmentService } from '../../services/departmentService';
import { employeeTypeService } from '../../services/employeeTypeService';
import { locationService } from '../../services/locationService';

import DirectoryToolbar from './DirectoryToolbar';
import EmployeeListView from './EmployeeListView';
import EmployeeCardView from './EmployeeCardView';
import DirectoryEmptyState from './DirectoryEmptyState';
import DirectorySkeleton from './DirectorySkeleton';

export default function DirectoryPageContainer({
  title = 'Employee Directory',
  description = 'Browse, filter, and manage Rizurf workforce records',
  baseLifecycleScope = 'All',
}) {
  const [employees, setEmployees] = useState([]);
  const [baseCount, setBaseCount] = useState(0);
  const [totalFilteredCount, setTotalFilteredCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [departmentId, setDepartmentId] = useState('');
  const [employeeTypeId, setEmployeeTypeId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'card'

  // Dropdown Options
  const [departments, setDepartments] = useState([]);
  const [employeeTypes, setEmployeeTypes] = useState([]);
  const [locations, setLocations] = useState([]);

  // Load dropdown options once on mount
  useEffect(() => {
    async function loadOptions() {
      try {
        const [depts, types, locs] = await Promise.all([
          departmentService.getAll({ withCount: false }),
          employeeTypeService.getAll(),
          locationService.getAll(),
        ]);
        setDepartments(depts);
        setEmployeeTypes(types);
        setLocations(locs);
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    }
    loadOptions();
  }, []);

  // Fetch queried employees whenever scope or filter states change
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await employeeService.queryEmployees({
        baseLifecycleScope,
        statusFilter,
        departmentId,
        employeeTypeId,
        locationId,
        search,
        sortBy,
      });

      setEmployees(res.employees);
      setBaseCount(res.baseCount);
      setTotalFilteredCount(res.totalFilteredCount);
    } catch (err) {
      console.error('Failed to query employees:', err);
    } finally {
      setLoading(false);
    }
  }, [baseLifecycleScope, statusFilter, departmentId, employeeTypeId, locationId, search, sortBy]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Reset interactive filters without changing the route's base lifecycle scope!
  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('All');
    setDepartmentId('');
    setEmployeeTypeId('');
    setLocationId('');
    setSortBy('name-asc');
  };

  const hasActiveFilters =
    Boolean(search.trim()) ||
    (baseLifecycleScope === 'All' && statusFilter !== 'All') ||
    Boolean(departmentId) ||
    Boolean(employeeTypeId) ||
    Boolean(locationId) ||
    sortBy !== 'name-asc';

  // Result count formatting
  const resultCountText =
    totalFilteredCount === baseCount
      ? `${baseCount} ${baseCount === 1 ? 'employee' : 'employees'}`
      : `${totalFilteredCount} of ${baseCount} employees (Filtered)`;

  return (
    <div className="directory-page-wrapper">
      {/* Header & Page Title */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-description">{description}</p>
        </div>
        <div className="directory-count-badge">{resultCountText}</div>
      </div>

      {/* Toolbar controls */}
      <DirectoryToolbar
        search={search}
        onSearchChange={setSearch}
        selectedStatus={statusFilter}
        onStatusChange={setStatusFilter}
        selectedDept={departmentId}
        onDeptChange={setDepartmentId}
        selectedType={employeeTypeId}
        onTypeChange={setEmployeeTypeId}
        selectedLoc={locationId}
        onLocChange={setLocationId}
        selectedSort={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onResetFilters={handleResetFilters}
        departments={departments}
        employeeTypes={employeeTypes}
        locations={locations}
        showStatusFilter={baseLifecycleScope === 'All'}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Directory Views / Loading / Empty States */}
      <div style={{ marginTop: '1.25rem' }}>
        {loading ? (
          <DirectorySkeleton viewMode={viewMode} />
        ) : employees.length === 0 ? (
          <DirectoryEmptyState onResetFilters={handleResetFilters} />
        ) : viewMode === 'list' ? (
          <EmployeeListView employees={employees} />
        ) : (
          <EmployeeCardView employees={employees} />
        )}
      </div>
    </div>
  );
}
