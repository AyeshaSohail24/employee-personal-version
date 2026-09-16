import React, { useState, useEffect, useCallback } from 'react';
import { History } from 'lucide-react';
import { formerService } from '../../services/formerService.js';
import { departmentService } from '../../services/departmentService.js';
import FormerToolbar from '../../components/former/FormerToolbar.jsx';
import FormerListView from '../../components/former/FormerListView.jsx';
import DirectoryEmptyState from '../../components/employees/DirectoryEmptyState.jsx';
import DirectorySkeleton from '../../components/employees/DirectorySkeleton.jsx';

/**
 * Former Personnel directory — a historical, lifecycle-filtered VIEW (status === 'Former') over
 * the exact same Personnel identity employeeService already owns (see formerService.js). Never
 * imports mock data or localStorage directly; every read goes through formerService.
 */
export default function FormerPersonnelPage() {
  const [employees, setEmployees] = useState([]);
  const [baseCount, setBaseCount] = useState(0);
  const [totalFilteredCount, setTotalFilteredCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [departmentId, setDepartmentId] = useState('');
  const [exitType, setExitType] = useState('');
  const [sortBy, setSortBy] = useState('finalDate-desc');

  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    async function loadOptions() {
      try {
        const depts = await departmentService.getAll({ withCount: false });
        setDepartments(depts);
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    }
    loadOptions();
  }, []);

  const fetchFormerPersonnel = useCallback(async () => {
    setLoading(true);
    try {
      const res = await formerService.getFormerDirectory({
        search,
        typeFilter,
        departmentId,
        exitType,
        sortBy,
      });
      setEmployees(res.employees);
      setBaseCount(res.baseCount);
      setTotalFilteredCount(res.totalFilteredCount);
    } catch (err) {
      console.error('Failed to query former personnel:', err);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, departmentId, exitType, sortBy]);

  useEffect(() => {
    fetchFormerPersonnel();
  }, [fetchFormerPersonnel]);

  const handleResetFilters = () => {
    setSearch('');
    setTypeFilter('All');
    setDepartmentId('');
    setExitType('');
    setSortBy('finalDate-desc');
  };

  const hasActiveFilters =
    Boolean(search.trim()) ||
    typeFilter !== 'All' ||
    Boolean(departmentId) ||
    Boolean(exitType) ||
    sortBy !== 'finalDate-desc';

  // "former personnel" already reads correctly for any count (1 former personnel, 5 former
  // personnel), so no "-s" suffix is needed — dynamic count, never hardcoded.
  const resultCountText =
    totalFilteredCount === baseCount
      ? `${baseCount} former personnel`
      : `${totalFilteredCount} of ${baseCount} former personnel (Filtered)`;

  return (
    <div className="directory-page-wrapper">
      <div className="employees-page-header page-header">
        <div>
          <h1 className="page-title">Former Personnel</h1>
          <p className="page-description">Historical employment and internship records for people who have left Rizurf.</p>
        </div>
        <div className="header-actions">
          <div className="directory-count-badge">{resultCountText}</div>
        </div>
      </div>

      <FormerToolbar
        search={search}
        onSearchChange={setSearch}
        selectedType={typeFilter}
        onTypeChange={setTypeFilter}
        selectedDept={departmentId}
        onDeptChange={setDepartmentId}
        selectedExitType={exitType}
        onExitTypeChange={setExitType}
        selectedSort={sortBy}
        onSortChange={setSortBy}
        onResetFilters={handleResetFilters}
        departments={departments}
        hasActiveFilters={hasActiveFilters}
      />

      <div style={{ marginTop: '1.25rem' }}>
        {loading ? (
          <DirectorySkeleton viewMode="list" />
        ) : baseCount === 0 ? (
          // Genuinely zero Former personnel ever — never a "no results" filter message, and
          // never fake people created just to populate this page.
          <div className="directory-empty-card">
            <div className="empty-icon-badge">
              <History size={32} />
            </div>
            <h3 className="empty-title">No former personnel records yet</h3>
            <p className="empty-description">
              Former personnel will appear here after completing their employment/internship lifecycle.
            </p>
          </div>
        ) : employees.length === 0 ? (
          <DirectoryEmptyState onResetFilters={handleResetFilters} message="No former personnel match the current search or filter criteria." />
        ) : (
          <FormerListView employees={employees} />
        )}
      </div>
    </div>
  );
}
