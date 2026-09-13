import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Globe2, UsersRound, GraduationCap, Building2, Settings2 } from 'lucide-react';
import { onboardingService } from '../../services/onboardingService.js';

function formatRelativeOffset(days) {
  const value = days || 0;
  if (value === 0) return 'Day 0';
  return value > 0 ? `Day +${value}` : `Day ${value}`;
}

// Read-only preview of a scope's configured tasks, in their existing configured sequence order
// (never re-sorted here — the order already comes pre-sorted by sequence from
// onboardingService.getScopesSummary()). No Edit/Delete/Move controls live here; those only
// exist in the "Manage Tasks" editor this card links to.
function ScopeTaskList({ tasks, emptyStateMessage }) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="onboarding-scope-task-list-empty">
        {emptyStateMessage}
      </div>
    );
  }

  return (
    <div className="onboarding-scope-task-list app-scroll-area">
      {tasks.map((task) => (
        <div key={task.id} className="onboarding-scope-task-row">
          <span className="onboarding-scope-task-title">{task.title}</span>
          {task.description && (
            <p className="onboarding-scope-task-description">{task.description}</p>
          )}
          <span className="onboarding-scope-task-timing">{formatRelativeOffset(task.relativeOffsetDays)}</span>
        </div>
      ))}
    </div>
  );
}

function ScopeCard({ icon, title, description, tasks, emptyStateMessage, taskCount, to, compact = false, emphasized = false }) {
  const cardClassName = [
    'table-container-card',
    'onboarding-scope-card',
    compact ? 'onboarding-scope-card--compact' : '',
    emphasized ? 'onboarding-scope-card--emphasized' : '',
  ].filter(Boolean).join(' ');

  const iconClassName = [
    'onboarding-scope-card-icon',
    compact ? 'onboarding-scope-card-icon--compact' : '',
    emphasized ? 'onboarding-scope-card-icon--emphasized' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClassName}>
      <div className="onboarding-scope-card-header">
        <div className={iconClassName}>
          {icon}
        </div>
        <div>
          <h3 className={`onboarding-scope-card-title ${compact ? 'onboarding-scope-card-title--compact' : ''}`}>
            {title}
          </h3>
          {description && (
            <p className="onboarding-scope-card-description">{description}</p>
          )}
        </div>
      </div>

      <ScopeTaskList tasks={tasks} emptyStateMessage={emptyStateMessage} />

      <div className="onboarding-scope-card-footer">
        <div className="onboarding-scope-card-counts">
          <strong className="onboarding-scope-card-count-main">{taskCount}</strong> task{taskCount === 1 ? '' : 's'}
        </div>
        <Link to={to} className="btn-secondary onboarding-scope-card-action">
          <Settings2 size={13} />
          <span>Manage Tasks</span>
        </Link>
      </div>
    </div>
  );
}

// Single source of truth for every piece of copy that depends on which person type is
// currently selected — the Universal card's subtitle/empty-state and each Department card's
// description/empty-state all read from here, so Employees vs Interns wording can never drift
// between the two card types.
const PERSON_TYPE_META = {
  employee: {
    label: 'Employees',
    icon: <UsersRound size={15} />,
    universalSubtitle: 'Included for every employee regardless of department.',
    universalEmptyState: "No universal tasks configured yet. Add tasks here to include them in every employee's onboarding plan.",
    departmentCardDescription: 'Tasks added specifically for Employees in this department.',
    departmentEmptyState: 'No employee-specific tasks configured for this department. Employee Universal Tasks will still apply.',
  },
  intern: {
    label: 'Interns',
    icon: <GraduationCap size={15} />,
    universalSubtitle: 'Included for every intern or apprentice regardless of department.',
    universalEmptyState: "No universal tasks configured yet. Add tasks here to include them in every intern's onboarding plan.",
    departmentCardDescription: 'Tasks added specifically for Interns in this department.',
    departmentEmptyState: 'No intern-specific tasks configured for this department. Intern Universal Tasks will still apply.',
  },
};

export default function OnboardingPlansPage() {
  const location = useLocation();

  // The selected filter is local component state only (per design — not over-engineered into
  // a persisted preference). It does default sensibly though: arriving back here from the
  // "Manage Tasks" editor (via its Cancel/Back link or after Save Tasks) carries the personType
  // that was just being edited via router state, so the filter doesn't silently reset to
  // Employees mid-workflow. A normal/fresh visit (no state) defaults to Employees.
  const [personType, setPersonType] = useState(location.state?.personType === 'intern' ? 'intern' : 'employee');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personType]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const data = await onboardingService.getScopesSummary(personType);
      setSummary(data);
    } catch (err) {
      console.error('Failed to load onboarding task scope summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const meta = PERSON_TYPE_META[personType];

  return (
    <div className="page-layout-container">
      <div className="page-header-container">
        <div className="onboarding-plans-header">
          <h1 className="page-title">Onboarding Plans</h1>
          <p className="page-subtitle">
            Configure reusable onboarding tasks for employees and interns. Universal and department-specific tasks are combined automatically when onboarding is launched.
          </p>
        </div>
      </div>

      {/* Employees / Interns filter — represents the PERSON TYPE whose onboarding
          configuration is being viewed below. Reuses the existing .view-switcher-group/
          .view-btn segmented-control pattern (already used for Notes' Card/Document View and
          inside LaunchPlanModal) rather than introducing a new control or a dropdown. */}
      <div className="view-switcher-group onboarding-person-type-switcher" role="tablist" aria-label="Onboarding plan person type">
        <button
          type="button"
          role="tab"
          aria-selected={personType === 'employee'}
          className={`view-btn ${personType === 'employee' ? 'active' : ''}`}
          onClick={() => setPersonType('employee')}
        >
          <UsersRound size={15} />
          <span>Employees</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={personType === 'intern'}
          className={`view-btn ${personType === 'intern' ? 'active' : ''}`}
          onClick={() => setPersonType('intern')}
        >
          <GraduationCap size={15} />
          <span>Interns</span>
        </button>
      </div>

      {loading || !summary ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading onboarding task scopes...
        </div>
      ) : (
        <div className="onboarding-scope-sections">
          {/* Universal Tasks — full width. Content depends entirely on the selected filter:
              Employee Universal and Intern Universal are two separate, non-overlapping task
              sets, even though the card title itself stays the generic "Universal Tasks" (the
              active filter already provides the person-type context). */}
          <section>
            <ScopeCard
              emphasized
              icon={<Globe2 size={20} />}
              title="Universal Tasks"
              description={meta.universalSubtitle}
              tasks={summary.universal.tasks}
              emptyStateMessage={meta.universalEmptyState}
              taskCount={summary.universal.taskCount}
              to={`/onboarding/plans/${personType}/universal`}
            />
          </section>

          {/* Department-Specific Tasks — compact scalable grid, rendered dynamically. Each
              card means "tasks added specifically for the selected person type in this
              department" — never a mix of Employee and Intern tasks for the same department. */}
          <section>
            <h2 className="onboarding-scope-section-title">Department-Specific Tasks</h2>
            {summary.departments.length === 0 ? (
              <div className="table-container-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No departments configured yet.
              </div>
            ) : (
              <div className="onboarding-scope-grid-dept">
                {summary.departments.map((row) => (
                  <ScopeCard
                    key={row.department.id}
                    compact
                    icon={<Building2 size={16} />}
                    title={row.department.name}
                    description={meta.departmentCardDescription}
                    tasks={row.tasks}
                    emptyStateMessage={meta.departmentEmptyState}
                    taskCount={row.taskCount}
                    to={`/onboarding/plans/${personType}/department/${row.department.id}`}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
