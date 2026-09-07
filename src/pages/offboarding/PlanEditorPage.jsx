import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  AlertCircle,
  Building,
  CheckSquare,
} from 'lucide-react';
import { offboardingService } from '../../services/offboardingService.js';
import { activityService } from '../../services/activityService.js';
import { departmentService } from '../../services/departmentService.js';
import { employeeService } from '../../services/employeeService.js';

export default function OffboardingPlanEditorPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(planId);

  const [templateName, setTemplateName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [description, setDescription] = useState('');
  const [tasks, setTasks] = useState([]);

  const [departments, setDepartments] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadEditorData();
  }, [planId]);

  const loadEditorData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [depts, types, emps] = await Promise.all([
        departmentService.getAll(),
        activityService.getAllTypes(),
        employeeService.getAll(),
      ]);

      setDepartments(depts);
      setActivityTypes(types);
      setEmployees(emps);

      if (isEditing) {
        const tpl = await offboardingService.getTemplateById(planId);
        if (!tpl) {
          setError(`Offboarding template with ID "${planId}" not found.`);
          return;
        }

        setTemplateName(tpl.name || '');
        setDepartmentId(tpl.departmentId || '');
        setDescription(tpl.description || '');

        const mappedTasks = (tpl.tasks || []).map((t, idx) => ({
          id: t.id || `pt-${idx + 1}`,
          title: t.title || '',
          description: t.description || '',
          activityTypeId: t.activityTypeId || (types[0] ? types[0].id : 'act-type-1'),
          assignmentRule: t.assignmentRule || 'employee',
          specificAssigneeId: t.specificAssigneeId || '',
          relativeOffsetDays: t.relativeOffsetDays !== undefined ? t.relativeOffsetDays : 0,
          required: t.required !== undefined ? t.required : true,
          sequence: idx + 1,
        }));

        setTasks(mappedTasks);
      } else {
        // Initial empty template with 1 default task
        setTasks([
          {
            id: `pt-new-1`,
            title: 'Conduct Handover Briefing',
            description: 'Document current tasks and conduct handover session.',
            activityTypeId: types[0] ? types[0].id : 'act-type-1',
            assignmentRule: 'employee',
            specificAssigneeId: '',
            relativeOffsetDays: -30,
            required: true,
            sequence: 1,
          },
        ]);
      }
    } catch (err) {
      setError(`Failed to load editor data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = () => {
    const nextSeq = tasks.length + 1;
    const defaultType = activityTypes[0] ? activityTypes[0].id : 'act-type-1';
    setTasks([
      ...tasks,
      {
        id: `pt-new-${Date.now()}`,
        title: '',
        description: '',
        activityTypeId: defaultType,
        assignmentRule: 'employee',
        specificAssigneeId: '',
        relativeOffsetDays: 0,
        required: true,
        sequence: nextSeq,
      },
    ]);
  };

  const handleRemoveTask = (index) => {
    if (tasks.length <= 1) {
      alert('Template must contain at least 1 task.');
      return;
    }
    const updated = tasks.filter((_, i) => i !== index).map((t, idx) => ({
      ...t,
      sequence: idx + 1,
    }));
    setTasks(updated);
  };

  const handleTaskChange = (index, field, value) => {
    const updated = [...tasks];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setTasks(updated);
  };

  const handleMoveTask = (index, direction) => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === tasks.length - 1)) {
      return;
    }
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...tasks];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;

    const resequenced = updated.map((t, idx) => ({
      ...t,
      sequence: idx + 1,
    }));
    setTasks(resequenced);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!templateName.trim()) {
      setError('Template name is required.');
      return;
    }

    if (tasks.length === 0) {
      setError('Template must contain at least 1 task.');
      return;
    }

    if (tasks.some((t) => !t.title.trim())) {
      setError('All tasks must have a valid title.');
      return;
    }

    if (!tasks.some((t) => t.required)) {
      setError('Template must contain at least 1 required task.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const templatePayload = {
        name: templateName.trim(),
        departmentId: departmentId || null,
        description: description.trim(),
      };

      if (isEditing) {
        await offboardingService.updateTemplate(planId, templatePayload, tasks, 'emp-001');
      } else {
        await offboardingService.createTemplate(templatePayload, tasks, 'emp-001');
      }

      navigate('/offboarding/plans');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-layout-container" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading plan template builder...
      </div>
    );
  }

  return (
    <div className="page-layout-container">
      {/* Top Header & Actions */}
      <div style={{ marginBottom: '1rem' }}>
        <Link
          to="/offboarding/plans"
          style={{ fontSize: '0.825rem', color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500 }}
        >
          <ArrowLeft size={15} /> Back to Offboarding Templates
        </Link>
      </div>

      <form onSubmit={handleSave}>
        <div className="onboarding-dashboard-header" style={{ marginBottom: '1.25rem' }}>
          <div className="header-text-group">
            <h1 className="page-title">
              {isEditing ? 'Edit Offboarding Template' : 'Create Offboarding Template'}
            </h1>
            <p className="page-subtitle">
              Define reusable exit clearance tasks, relative offsets from Final Working Date, and assignees.
            </p>
          </div>
          <div className="header-actions">
            <button
              type="submit"
              className="btn-primary btn-header-action"
              disabled={saving}
            >
              <Save size={15} />
              <span>{saving ? 'Saving Template...' : 'Save Offboarding Template'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '0.85rem 1rem', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#991B1B', fontSize: '0.825rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} style={{ color: '#DC2626', flexShrink: 0 }} />
            <div>{error}</div>
          </div>
        )}

        {/* Metadata Card */}
        <div className="table-container-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--color-navy-header)' }}>
            Template General Information
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.815rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                Template Name <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type="text"
                className="search-input"
                placeholder="e.g. Standard Employee Offboarding Clearance"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', background: '#FFF', border: '1px solid var(--border-light)', borderRadius: '6px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.815rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                Target Department Scope
              </label>
              <select
                className="search-input"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', background: '#FFF', border: '1px solid var(--border-light)', borderRadius: '6px' }}
              >
                <option value="">General / All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.815rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
              Template Description
            </label>
            <textarea
              className="search-input"
              rows={2}
              placeholder="Provide a clear description of the exit clearance objectives covered by this template..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', background: '#FFF', border: '1px solid var(--border-light)', borderRadius: '6px', resize: 'vertical' }}
            />
          </div>
        </div>

        {/* Task Sequence Builder */}
        <div className="table-container-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-navy-header)' }}>
                Exit Clearance Tasks ({tasks.length})
              </h3>
              <p style={{ margin: 0, fontSize: '0.785rem', color: 'var(--text-muted)' }}>
                Relative day offsets are calculated relative to the Final Working Date (Day 0).
              </p>
            </div>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleAddTask}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.815rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <Plus size={15} /> Add Task
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {tasks.map((task, index) => (
              <div
                key={task.id}
                style={{
                  padding: '1.25rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  backgroundColor: '#F8FAFC',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                {/* Task Header Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary-active)', fontSize: '0.815rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {task.sequence}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                      Task #{task.sequence}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={() => handleMoveTask(index, 'up')}
                      disabled={index === 0}
                      style={{ background: '#FFF', border: '1px solid var(--border-light)', borderRadius: '4px', padding: '0.2rem 0.4rem', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.4 : 1 }}
                    >
                      <MoveUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveTask(index, 'down')}
                      disabled={index === tasks.length - 1}
                      style={{ background: '#FFF', border: '1px solid var(--border-light)', borderRadius: '4px', padding: '0.2rem 0.4rem', cursor: index === tasks.length - 1 ? 'not-allowed' : 'pointer', opacity: index === tasks.length - 1 ? 0.4 : 1 }}
                    >
                      <MoveDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveTask(index)}
                      style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: '4px', padding: '0.2rem 0.4rem', cursor: 'pointer' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Task Fields Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.785rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Task Title <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="search-input"
                      placeholder="e.g. Confirm IT Asset Return"
                      value={task.title}
                      onChange={(e) => handleTaskChange(index, 'title', e.target.value)}
                      style={{ width: '100%', padding: '0.4rem 0.65rem', fontSize: '0.825rem', background: '#FFF', border: '1px solid var(--border-light)', borderRadius: '6px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.785rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Activity Type
                    </label>
                    <select
                      className="search-input"
                      value={task.activityTypeId}
                      onChange={(e) => handleTaskChange(index, 'activityTypeId', e.target.value)}
                      style={{ width: '100%', padding: '0.4rem 0.65rem', fontSize: '0.825rem', background: '#FFF', border: '1px solid var(--border-light)', borderRadius: '6px' }}
                    >
                      {activityTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name} ({type.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.785rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Relative Offset (Days)
                    </label>
                    <input
                      type="number"
                      className="search-input"
                      placeholder="e.g. -30 or 0 or +7"
                      value={task.relativeOffsetDays}
                      onChange={(e) => handleTaskChange(index, 'relativeOffsetDays', e.target.value)}
                      style={{ width: '100%', padding: '0.4rem 0.65rem', fontSize: '0.825rem', background: '#FFF', border: '1px solid var(--border-light)', borderRadius: '6px' }}
                    />
                  </div>
                </div>

                {/* Assignment & Requirement Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', alignItems: 'center' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.785rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Assignment Rule
                    </label>
                    <select
                      className="search-input"
                      value={task.assignmentRule}
                      onChange={(e) => handleTaskChange(index, 'assignmentRule', e.target.value)}
                      style={{ width: '100%', padding: '0.4rem 0.65rem', fontSize: '0.825rem', background: '#FFF', border: '1px solid var(--border-light)', borderRadius: '6px' }}
                    >
                      <option value="employee">Departing Employee</option>
                      <option value="manager">Manager (from record)</option>
                      <option value="hr">HR Representative</option>
                      <option value="specific_employee">Specific Employee</option>
                    </select>
                  </div>

                  {task.assignmentRule === 'specific_employee' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.785rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                        Select Specific Assignee
                      </label>
                      <select
                        className="search-input"
                        value={task.specificAssigneeId}
                        onChange={(e) => handleTaskChange(index, 'specificAssigneeId', e.target.value)}
                        style={{ width: '100%', padding: '0.4rem 0.65rem', fontSize: '0.825rem', background: '#FFF', border: '1px solid var(--border-light)', borderRadius: '6px' }}
                      >
                        <option value="">-- Choose Assignee --</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.fullName} ({emp.employeeId})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={{ paddingTop: '1.25rem' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={task.required}
                        onChange={(e) => handleTaskChange(index, 'required', e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
                      />
                      <span>Required Clearance Task</span>
                    </label>
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>

      </form>
    </div>
  );
}
