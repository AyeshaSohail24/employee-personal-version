import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  FileText,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { onboardingService } from '../../services/onboardingService.js';
import { departmentService } from '../../services/departmentService.js';
import { activityService } from '../../services/activityService.js';
import { employeeService } from '../../services/employeeService.js';
import { ASSIGNMENT_RULES } from '../../domain/onboardingDomain.js';

export default function PlanEditorPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(planId && planId !== 'new');

  const [departments, setDepartments] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [tasks, setTasks] = useState([]);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadOptions();
    if (isEditing) {
      loadTemplate(planId);
    } else {
      // Default initial tasks for new template
      setTasks([
        {
          id: 'temp-1',
          title: 'Prepare workstation and access credentials',
          description: 'Setup laptop, email account, internal portal access, and desk setup.',
          activityTypeId: 'act-type-4',
          assignmentRule: ASSIGNMENT_RULES.MANAGER,
          specificAssigneeId: '',
          relativeOffsetDays: -5,
          required: true,
          sequence: 1,
        },
        {
          id: 'temp-2',
          title: 'Conduct HR Orientation Session',
          description: 'Welcome new hire, review company benefits, policies, and workplace overview.',
          activityTypeId: 'act-type-3',
          assignmentRule: ASSIGNMENT_RULES.HR,
          specificAssigneeId: '',
          relativeOffsetDays: 0,
          required: true,
          sequence: 2,
        },
      ]);
    }
  }, [planId]);

  const loadOptions = async () => {
    try {
      const depts = await departmentService.getAll();
      const types = await activityService.getActiveTypes();
      const emps = await employeeService.getAll();

      setDepartments(depts);
      setActivityTypes(types);
      setEmployees(emps.filter((e) => e.status !== 'Former'));
    } catch (err) {
      console.error('Failed to load plan builder options:', err);
    }
  };

  const loadTemplate = async (id) => {
    setLoading(true);
    try {
      const tpl = await onboardingService.getTemplateById(id);
      if (!tpl) {
        setError(`Plan Template "${id}" not found.`);
        return;
      }
      setName(tpl.name);
      setDepartmentId(tpl.departmentId || '');
      setDescription(tpl.description || '');
      setActive(tpl.active !== false);
      setTasks(
        (tpl.tasks || []).map((t, idx) => ({
          id: t.id,
          title: t.title,
          description: t.description || '',
          activityTypeId: t.activityTypeId,
          assignmentRule: t.assignmentRule,
          specificAssigneeId: t.specificAssigneeId || '',
          relativeOffsetDays: t.relativeOffsetDays || 0,
          required: t.required !== false,
          sequence: idx + 1,
        }))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = () => {
    const newTask = {
      id: `temp-${Date.now()}`,
      title: 'New Onboarding Task',
      description: '',
      activityTypeId: activityTypes.length > 0 ? activityTypes[0].id : 'act-type-1',
      assignmentRule: ASSIGNMENT_RULES.EMPLOYEE,
      specificAssigneeId: '',
      relativeOffsetDays: 0,
      required: true,
      sequence: tasks.length + 1,
    };
    setTasks((prev) => [...prev, newTask]);
  };

  const handleTaskChange = (index, field, value) => {
    setTasks((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveTask = (index) => {
    if (tasks.length <= 1) {
      alert('Plan template must contain at least 1 task.');
      return;
    }
    setTasks((prev) => prev.filter((_, i) => i !== index).map((t, idx) => ({ ...t, sequence: idx + 1 })));
  };

  const handleMoveTask = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= tasks.length) return;

    setTasks((prev) => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[newIndex];
      updated[newIndex] = temp;
      return updated.map((t, idx) => ({ ...t, sequence: idx + 1 }));
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Template name is required.');
      return;
    }

    if (tasks.length === 0) {
      setError('Template must contain at least 1 task.');
      return;
    }

    if (!tasks.some((t) => t.required)) {
      setError('Template must contain at least 1 required task.');
    }

    for (let i = 0; i < tasks.length; i++) {
      if (!tasks[i].title.trim()) {
        setError(`Task #${i + 1} is missing a title.`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        departmentId: departmentId || null,
        description: description.trim(),
        active,
      };

      if (isEditing) {
        await onboardingService.updateTemplate(planId, payload, tasks);
      } else {
        await onboardingService.createTemplate(payload, tasks);
      }

      navigate('/onboarding/plans');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-layout-container">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading template editor...
        </div>
      </div>
    );
  }

  return (
    <div className="page-layout-container">
      {/* Back link */}
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/onboarding/plans" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
          <ArrowLeft size={14} /> Back to Plan Templates
        </Link>
      </div>

      <form onSubmit={handleSave}>
        {/* Header Title & Actions */}
        <div className="page-header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">{isEditing ? 'Edit Plan Template' : 'Create Onboarding Plan Template'}</h1>
            <p className="page-subtitle">
              Configure template metadata, task sequences, relative offset days, and assignment rules.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link to="/onboarding/plans" className="btn-secondary" style={{ textDecoration: 'none' }}>
              Cancel
            </Link>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Save size={15} />
              <span>{saving ? 'Saving...' : 'Save Plan Template'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="modal-error-alert" style={{ marginBottom: '1.25rem' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Template Header Form */}
        <div className="table-container-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: '#FFF' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.975rem', fontWeight: 600 }}>Template Settings</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Template Name *</label>
              <input
                type="text"
                className="form-control-input"
                placeholder="e.g. Standard Employee Onboarding"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Applicable Department</label>
              <select
                className="form-control-input"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">General (All Departments)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <label className="form-label">Status</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                <span>Active Template</span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-control-input"
              rows={2}
              placeholder="Describe the purpose and target audience for this plan template..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        {/* Task Builder List */}
        <div className="table-container-card" style={{ padding: '1.25rem', background: '#FFF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.975rem', fontWeight: 600 }}>
              Plan Tasks ({tasks.length})
            </h3>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleAddTask}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.815rem' }}
            >
              <Plus size={14} />
              <span>Add Task</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {tasks.map((task, idx) => (
              <div
                key={task.id || idx}
                style={{
                  padding: '1rem',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  background: '#F8FAFC',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                {/* Task Header & Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--color-primary)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                      {idx + 1}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                      Task #{idx + 1}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn-icon-close"
                      onClick={() => handleMoveTask(idx, -1)}
                      disabled={idx === 0}
                      title="Move Up"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon-close"
                      onClick={() => handleMoveTask(idx, 1)}
                      disabled={idx === tasks.length - 1}
                      title="Move Down"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon-close"
                      onClick={() => handleRemoveTask(idx)}
                      style={{ color: '#DC2626' }}
                      title="Remove Task"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Task Form Inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Task Title *</label>
                    <input
                      type="text"
                      className="form-control-input"
                      style={{ fontSize: '0.815rem' }}
                      placeholder="Task title..."
                      value={task.title}
                      onChange={(e) => handleTaskChange(idx, 'title', e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Activity Type</label>
                    <select
                      className="form-control-input"
                      style={{ fontSize: '0.815rem' }}
                      value={task.activityTypeId}
                      onChange={(e) => handleTaskChange(idx, 'activityTypeId', e.target.value)}
                    >
                      {activityTypes.map((at) => (
                        <option key={at.id} value={at.id}>
                          {at.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Assignment Rule</label>
                    <select
                      className="form-control-input"
                      style={{ fontSize: '0.815rem' }}
                      value={task.assignmentRule}
                      onChange={(e) => handleTaskChange(idx, 'assignmentRule', e.target.value)}
                    >
                      <option value={ASSIGNMENT_RULES.EMPLOYEE}>Employee (New Joiner)</option>
                      <option value={ASSIGNMENT_RULES.MANAGER}>Manager</option>
                      <option value={ASSIGNMENT_RULES.HR}>HR Representative</option>
                      <option value={ASSIGNMENT_RULES.SPECIFIC_EMPLOYEE}>Specific Employee</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Relative Offset (Days)</label>
                    <input
                      type="number"
                      className="form-control-input"
                      style={{ fontSize: '0.815rem' }}
                      placeholder="e.g. -5, 0, 7"
                      value={task.relativeOffsetDays}
                      onChange={(e) => handleTaskChange(idx, 'relativeOffsetDays', e.target.value)}
                    />
                  </div>
                </div>

                {/* Specific Employee Picker if applicable */}
                {task.assignmentRule === ASSIGNMENT_RULES.SPECIFIC_EMPLOYEE && (
                  <div className="form-group" style={{ maxWidth: '300px' }}>
                    <label className="form-label">Select Specific Assignee *</label>
                    <select
                      className="form-control-input"
                      style={{ fontSize: '0.815rem' }}
                      value={task.specificAssigneeId || ''}
                      onChange={(e) => handleTaskChange(idx, 'specificAssigneeId', e.target.value)}
                    >
                      <option value="">-- Choose Employee --</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.fullName} ({e.employeeId})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="form-group" style={{ flex: 1, marginRight: '1rem' }}>
                    <input
                      type="text"
                      className="form-control-input"
                      style={{ fontSize: '0.785rem' }}
                      placeholder="Task description / notes for assignee..."
                      value={task.description}
                      onChange={(e) => handleTaskChange(idx, 'description', e.target.value)}
                    />
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.815rem', whiteSpace: 'nowrap' }}>
                    <input
                      type="checkbox"
                      checked={task.required}
                      onChange={(e) => handleTaskChange(idx, 'required', e.target.checked)}
                    />
                    <span>Required Task</span>
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleAddTask}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Plus size={14} />
              <span>Add Another Task</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
