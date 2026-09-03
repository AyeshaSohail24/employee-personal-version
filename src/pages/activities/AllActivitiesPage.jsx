import React, { useState, useEffect } from 'react';
import { activityService } from '../../services/activityService';
import { employeeService } from '../../services/employeeService';
import { useRole } from '../../state/RoleContext';
import ActivitySummaryCards from '../../components/activities/ActivitySummaryCards';
import ActivityToolbar from '../../components/activities/ActivityToolbar';
import ActivityTable from '../../components/activities/ActivityTable';
import CreateActivityModal from '../../components/activities/CreateActivityModal';
import ActivityDetailModal from '../../components/activities/ActivityDetailModal';
import { getTodayLocalDateString } from '../../utils/dateUtils';

export default function AllActivitiesPage() {
  const { currentUser, currentRole } = useRole();
  const currentUserId = currentUser ? currentUser.id || currentUser.employeeId || 'emp-001' : 'emp-001';

  // Provisional Stage 7 Role Check (HR / HR Admin / Manager can access organization-wide activities)
  const canManageAll = ['HR', 'HR Admin', 'Manager', 'Administrator'].includes(currentRole);

  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState({});
  const [activityTypes, setActivityTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    search: '',
    typeId: '',
    assigneeId: '',
    employeeId: '',
    dueState: '',
    source: '',
    sortBy: 'dueDate',
  });

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const todayDate = getTodayLocalDateString();
      const [typeList, empList, dataList, summary] = await Promise.all([
        activityService.getAllTypes(),
        employeeService.getAll(),
        activityService.getAll({
          ...filters,
          scope: 'all',
          referenceDate: todayDate,
        }),
        activityService.getSummaryStats({
          scope: 'all',
          referenceDate: todayDate,
        }),
      ]);

      setActivityTypes(typeList);
      setEmployees(empList);
      setActivities(dataList);
      setStats(summary);
    } catch (err) {
      console.error('Failed to load all activities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const handleResetFilters = () => {
    setFilters({
      search: '',
      typeId: '',
      assigneeId: '',
      employeeId: '',
      dueState: '',
      source: '',
      sortBy: 'dueDate',
    });
  };

  const handleCreateSubmit = async (formData) => {
    await activityService.create(formData, currentUserId);
    await loadData();
  };

  const handleMarkComplete = async (id) => {
    await activityService.markComplete(id, currentUserId);
    await loadData();
    if (selectedActivity && selectedActivity.id === id) {
      const updated = await activityService.getById(id);
      setSelectedActivity(updated);
    }
  };

  const handleReopen = async (id) => {
    await activityService.reopen(id, currentUserId);
    await loadData();
    if (selectedActivity && selectedActivity.id === id) {
      const updated = await activityService.getById(id);
      setSelectedActivity(updated);
    }
  };

  const handleUpdateDetail = async (id, updateData) => {
    await activityService.update(id, updateData, currentUserId);
    await loadData();
    const updated = await activityService.getById(id);
    setSelectedActivity(updated);
  };

  return (
    <div className="activities-page-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">All Activities</h1>
          <p className="page-description">
            Organization-wide operational HR tasks, follow-ups, and compliance reviews
          </p>
        </div>
        <div className="directory-count-badge">{stats.totalCount || 0} Total Activities</div>
      </div>

      {/* KPI Cards */}
      <ActivitySummaryCards stats={stats} loading={loading} />

      {/* Toolbar */}
      <ActivityToolbar
        scope="all"
        filters={filters}
        setFilters={setFilters}
        onResetFilters={handleResetFilters}
        onOpenCreateModal={() => setIsCreateOpen(true)}
        activityTypes={activityTypes}
        employees={employees}
        canCreate={canManageAll}
      />

      {/* Data Table */}
      <ActivityTable
        activities={activities}
        referenceDate={getTodayLocalDateString()}
        onViewDetail={(act) => setSelectedActivity(act)}
        onMarkComplete={handleMarkComplete}
        onReopen={handleReopen}
        loading={loading}
      />

      {/* Modals */}
      <CreateActivityModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateSubmit}
        activityTypes={activityTypes}
        employees={employees}
        currentUserId={currentUserId}
      />

      <ActivityDetailModal
        isOpen={Boolean(selectedActivity)}
        onClose={() => setSelectedActivity(null)}
        activity={selectedActivity}
        referenceDate={getTodayLocalDateString()}
        employees={employees}
        onUpdate={handleUpdateDetail}
        onMarkComplete={handleMarkComplete}
        onReopen={handleReopen}
      />
    </div>
  );
}
