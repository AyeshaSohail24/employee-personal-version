import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Globe2,
  Building2,
} from 'lucide-react';
import { offboardingService } from '../../services/offboardingService.js';
import { departmentService } from '../../services/departmentService.js';
import { activityService } from '../../services/activityService.js';
import Select from '../../components/common/Select.jsx';

const PERSON_TYPE_LABEL = {
  employee: 'Employee',
  intern: 'Intern',
};

// Scope-based Offboarding task editor — mirrors Onboarding's PlanEditorPage UX pattern exactly
// (same field set, same task-card builder), but reads/writes offboardingService's own
// scope methods only. Offboarding tasks are anchored to the Final Working Date/departure date,
// never an onboarding start-date anchor — see the relative-offset helper text below.
export default function OffboardingPlanEditorPage() {
  // '/offboarding/plans/:personType/universal' -> scopeType 'universal'
  // '/offboarding/plans/:personType/department/:departmentId' -> scopeType 'department'
  const { personType, departmentId } = useParams();
  const navigate = useNavigate();
  const scopeType = departmentId !== undefined ? 'department' : 'universal';

  const [activityTypes, setActivityTypes] = useState([]);
  const [department, setDepartment] = useState(null);
  const [tasks, setTasks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    loadEditor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personType, scopeType, departmentId]);

  const loadEditor = async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);

    const validPersonType = personType === 'employee' || personType === 'intern';
    const validScope = scopeType === 'universal' || (scopeType === 'department' && departmentId);
    if (!validPersonType || !validScope) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    try {
      const types = await activityService.getActiveTypes();
      setActivityTypes(types);

      if (scopeType === 'department') {
        const dept = await departmentService.getById(departmentId);
        if (!dept) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setDepartment(dept);
      }

      const scopeTasks = await offboardingService.getScopeTasks(scopeType, personType, departmentId);
      setTasks(
        scopeTasks.map((t, idx) => ({
          id: t.id,
          title: t.title,
          description: t.description || '',
          activityTypeId: t.activityTypeId,
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
      title: '',
      description: '',
      activityTypeId: activityTypes.length > 0 ? activityTypes[0].id : 'act-type-1',
      relativeOffsetDays: 0,
      // Required Task is no longer a configurable, HR-facing concept — this stays as an internal
      // compatibility field only (never rendered/edited in the UI). All tasks count equally
      // toward offboarding progress regardless of this value; see calculateOffboardingProgress().
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

    // Scopes may legitimately be empty (e.g. a brand-new department, or Universal before HR
    // configures it) — the only validation left is that any task present has a title.
    for (let i = 0; i < tasks.length; i++) {
      if (!tasks[i].title.trim()) {
        setError(`Task #${i + 1} is missing a title.`);
        return;
      }
    }

    setSaving(true);
    try {
      await offboardingService.saveScopeTasks(scopeType, personType, departmentId, tasks);
      navigate('/offboarding/plans', { state: { personType } });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (notFound) {
    return (
      <div className="page-layout-container">
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <h2>Task Scope Not Found</h2>
          <Link to="/offboarding/plans" className="btn-secondary" style={{ marginTop: '1rem', display: 'inline-block' }}>
            Back to Offboarding Plans
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-layout-container">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading task scope editor...
        </div>
      </div>
    );
  }

  const personLabel = PERSON_TYPE_LABEL[personType];
  const meta = scopeType === 'department'
    ? {
        title: `${department.name} — ${personLabel} Tasks`,
        subtitle: `These tasks are added specifically for ${personLabel}s in ${department.name}.`,
        icon: <Building2 size={20} />,
      }
    : {
        title: `${personLabel} Universal Tasks`,
        subtitle: personType === 'intern'
          ? 'These tasks are included for every intern or apprentice regardless of department.'
          : 'These tasks are included for every employee regardless of department.',
        icon: <Globe2 size={20} />,
      };

  return (
    <div className="page-layout-container">
      {/* Back link — carries the personType back via router state so the Plans page reopens on
          the same Employees/Interns filter the user was just editing, rather than resetting to
          the default. */}
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/offboarding/plans" state={{ personType }} style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
          <ArrowLeft size={14} /> Back to Offboarding Plans
        </Link>
      </div>

      <form onSubmit={handleSave}>
        {/* Header Title (no actions here — Cancel/Save Tasks live at the bottom of the page) */}
        <div className="page-header-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="modal-icon-badge">{meta.icon}</div>
            <div>
              <h1 className="page-title">{meta.title}</h1>
              <p className="page-subtitle">{meta.subtitle}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="modal-error-alert" style={{ marginBottom: '1.25rem' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Task Builder List */}
        <div className="table-container-card" style={{ padding: '1.25rem', background: '#FFF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.975rem', fontWeight: 600 }}>
              Tasks ({tasks.length})
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

          {tasks.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', border: '1px dashed var(--border-light)', borderRadius: 'var(--radius-lg)', marginBottom: '1rem' }}>
              No tasks in this scope yet. Click "Add Task" to get started.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {tasks.map((task, idx) => (
              <div
                key={task.id || idx}
                style={{
                  padding: '1.25rem',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-lg)',
                  background: '#F8FAFC',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
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
                      className="icon-btn"
                      onClick={() => handleMoveTask(idx, -1)}
                      disabled={idx === 0}
                      title="Move Up"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleMoveTask(idx, 1)}
                      disabled={idx === tasks.length - 1}
                      title="Move Down"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-danger"
                      onClick={() => handleRemoveTask(idx)}
                      title="Remove Task"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Task Form Inputs */}
                <div className="plan-task-fields-grid">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Task Title <span className="required-star">*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Confirm IT asset return"
                      value={task.title}
                      onChange={(e) => handleTaskChange(idx, 'title', e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Activity Type</label>
                    <Select
                      variant="form"
                      value={task.activityTypeId}
                      onChange={(e) => handleTaskChange(idx, 'activityTypeId', e.target.value)}
                      options={activityTypes.map((at) => ({ value: at.id, label: at.name }))}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Relative Offset (Days)</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="e.g. -7, 0, 1"
                      value={task.relativeOffsetDays}
                      onChange={(e) => handleTaskChange(idx, 'relativeOffsetDays', e.target.value)}
                    />
                    <div className="relative-offset-help">
                      <span><strong>0</strong> = Final Working Date</span>
                      <span><strong>+ value</strong> = After Final Working Date</span>
                      <span><strong>− value</strong> = Before Final Working Date</span>
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Task Description</label>
                  <textarea
                    className="form-textarea form-textarea-md"
                    placeholder="Task description / notes..."
                    value={task.description}
                    onChange={(e) => handleTaskChange(idx, 'description', e.target.value)}
                  />
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

        {/* Bottom Save Actions — the only Cancel/Save Tasks controls on this page */}
        <div className="plan-editor-bottom-actions">
          <Link to="/offboarding/plans" state={{ personType }} className="btn-secondary" style={{ textDecoration: 'none' }}>
            Cancel
          </Link>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Save size={15} />
            <span>{saving ? 'Saving...' : 'Save Tasks'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
