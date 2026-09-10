import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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

export default function OnboardingPlansPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const data = await onboardingService.getScopesSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load onboarding task scope summary:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-layout-container">
      <div className="page-header-container">
        <div className="onboarding-plans-header">
          <h1 className="page-title">Onboarding Plans</h1>
          <p className="page-subtitle">
            Configure reusable onboarding tasks by scope. Universal, employee/intern, and department tasks are combined automatically when onboarding is launched.
          </p>
        </div>
      </div>

      {loading || !summary ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading onboarding task scopes...
        </div>
      ) : (
        <div className="onboarding-scope-sections">
          {/* Universal Tasks — full width */}
          <section>
            <ScopeCard
              emphasized
              icon={<Globe2 size={20} />}
              title="Universal Tasks"
              description="Included in every onboarding plan."
              tasks={summary.universal.tasks}
              emptyStateMessage="No universal tasks configured yet. Add tasks here to include them in every onboarding plan."
              taskCount={summary.universal.taskCount}
              to="/onboarding/plans/universal"
            />
          </section>

          {/* Employee / Intern — side by side */}
          <section>
            <h2 className="onboarding-scope-section-title">Type-Specific Tasks</h2>
            <div className="onboarding-scope-grid-2">
              <ScopeCard
                icon={<UsersRound size={20} />}
                title="Employee Tasks"
                description="Included for employees in addition to Universal Tasks."
                tasks={summary.employee.tasks}
                emptyStateMessage="No employee-specific tasks configured yet."
                taskCount={summary.employee.taskCount}
                to="/onboarding/plans/employee"
              />
              <ScopeCard
                icon={<GraduationCap size={20} />}
                title="Intern Tasks"
                description="Included for interns and apprentices in addition to Universal Tasks."
                tasks={summary.intern.tasks}
                emptyStateMessage="No intern-specific tasks configured yet."
                taskCount={summary.intern.taskCount}
                to="/onboarding/plans/intern"
              />
            </div>
          </section>

          {/* Department Tasks — compact scalable grid, rendered dynamically */}
          <section>
            <h2 className="onboarding-scope-section-title">Department Tasks</h2>
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
                    description="Configure department-specific onboarding tasks."
                    tasks={row.tasks}
                    emptyStateMessage="No department-specific tasks configured. Universal and type-specific tasks will still apply."
                    taskCount={row.taskCount}
                    to={`/onboarding/plans/department/${row.department.id}`}
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
