import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Palette } from 'lucide-react';
import {
  formatCompactDate,
  getTodayLocalDateString,
  calculateTimelineRange,
  generateTimelineMonthTicks,
  calculateTimelineBarPosition,
} from '../../utils/dateUtils.js';
import { resolveDepartmentColor, buildDepartmentLegend } from '../../domain/departmentDomain.js';
import { departmentService } from '../../services/departmentService.js';
import DepartmentColorsModal from './DepartmentColorsModal.jsx';

const TYPE_BADGE_STYLES = {
  Employee: { bg: '#F1F5F9', color: '#475569' },
  Intern: { bg: '#E0F2FE', color: '#0369A1' },
};

export default function EmployeeTimelineView({ employees = [] }) {
  const [hoveredId, setHoveredId] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [isColorsModalOpen, setIsColorsModalOpen] = useState(false);
  const today = getTodayLocalDateString();

  // Timeline reads Department color configuration through departmentService only (the app's
  // existing data-access boundary for Departments — never a lower-level storage layer touched
  // directly from a component), and re-reads it (via refreshDepartments) right after Department
  // Colors is saved, so bars reflect the new color immediately without needing a page refresh,
  // even though the `employees` prop's own embedded `.department` snapshots don't change until
  // Personnel's own data next reloads.
  const refreshDepartments = useCallback(() => {
    departmentService.getAll({ withCount: false }).then(setDepartments).catch((err) => {
      console.error('Failed to load department color configuration:', err);
    });
  }, []);

  useEffect(() => {
    refreshDepartments();
  }, [refreshDepartments]);

  // Employees with their `.department` swapped for the freshly-fetched department record (which
  // carries the latest configured `color`) — the single source both the bars and the legend
  // resolve color from below, so they can never disagree with each other or show a stale color.
  const employeesWithFreshDepartments = useMemo(() => {
    if (departments.length === 0) return employees;
    const departmentById = new Map(departments.map((d) => [d.id, d]));
    return employees.map((e) => (e.department ? { ...e, department: departmentById.get(e.department.id) || e.department } : e));
  }, [employees, departments]);

  const range = useMemo(
    () => calculateTimelineRange(
      employeesWithFreshDepartments.map((e) => ({ startDate: e.startDate, contractEndDate: e.contractEndDate })),
      today
    ),
    [employeesWithFreshDepartments, today]
  );

  const spansMultipleYears = Boolean(range && range.rangeStart.slice(0, 4) !== range.rangeEnd.slice(0, 4));

  const axisTicks = useMemo(
    () => (range ? generateTimelineMonthTicks(range.rangeStart, range.rangeEnd) : []),
    [range]
  );

  const legend = useMemo(() => buildDepartmentLegend(employeesWithFreshDepartments), [employeesWithFreshDepartments]);

  if (!range) {
    return (
      <div className="timeline-card">
        <p className="timeline-no-range-note">
          Unable to render a Timeline — no employee in the current result set has a Start Date on record.
        </p>
      </div>
    );
  }

  const canvasMinWidth = Math.max(760, axisTicks.length * 90);

  return (
    <div className="timeline-card">
      <div className="timeline-header-row">
        {legend.length > 0 ? (
          <div className="timeline-legend">
            {legend.map((d) => (
              <span key={d.id} className="timeline-legend-item">
                <span className="timeline-legend-dot" style={{ backgroundColor: d.color }} />
                <span>{d.name}</span>
              </span>
            ))}
          </div>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="btn-compact-override timeline-colors-btn"
          onClick={() => setIsColorsModalOpen(true)}
        >
          <Palette size={12} />
          <span>Department Colors</span>
        </button>
      </div>

      <div className="timeline-scroll-area">
        <div className="timeline-canvas" style={{ minWidth: `${canvasMinWidth}px` }}>
          {/* Axis */}
          <div className="timeline-axis-row">
            <div className="timeline-name-col-spacer" />
            <div className="timeline-track-area">
              <div className="timeline-plot-area">
                {axisTicks.map((tick, idx) => (
                  <span key={idx} className="timeline-axis-tick" style={{ left: `${tick.ratio * 100}%` }}>
                    {tick.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Rows */}
          {employeesWithFreshDepartments.map((emp) => {
            const typeBadge = TYPE_BADGE_STYLES[emp.directoryType] || TYPE_BADGE_STYLES.Employee;

            if (!emp.startDate) {
              return (
                <div key={emp.id} className="timeline-row">
                  <div className="timeline-name-col">
                    <div className="timeline-name-row">
                      <span className="timeline-emp-name">{emp.fullName}</span>
                      <span className="type-badge-mini" style={{ backgroundColor: typeBadge.bg, color: typeBadge.color }}>
                        {emp.directoryType}
                      </span>
                    </div>
                    <span className="timeline-emp-id">{emp.employeeId}</span>
                  </div>
                  <div className="timeline-track-area">
                    <span className="timeline-missing-date-note">No Start Date on record</span>
                  </div>
                </div>
              );
            }

            const pos = calculateTimelineBarPosition(emp.startDate, emp.contractEndDate, range.rangeStart, range.rangeEnd, today);
            const color = resolveDepartmentColor(emp.department);
            const isHovered = hoveredId === emp.id;

            return (
              <div key={emp.id} className="timeline-row">
                <div className="timeline-name-col">
                  <div className="timeline-name-row">
                    <span className="timeline-emp-name">{emp.fullName}</span>
                    <span className="type-badge-mini" style={{ backgroundColor: typeBadge.bg, color: typeBadge.color }}>
                      {emp.directoryType}
                    </span>
                  </div>
                  <span className="timeline-emp-id">{emp.employeeId}</span>
                </div>

                <div className="timeline-track-area">
                  <div className="timeline-plot-area">
                    {pos && (
                      <div
                        className="timeline-bar"
                        style={{ left: `${pos.leftPercent}%`, width: `${pos.widthPercent}%`, backgroundColor: color }}
                        onMouseEnter={() => setHoveredId(emp.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        onFocus={() => setHoveredId(emp.id)}
                        onBlur={() => setHoveredId(null)}
                        tabIndex={0}
                        role="img"
                        aria-label={`${emp.fullName}, ${emp.department ? emp.department.name : 'Unassigned'}, ${formatCompactDate(emp.startDate, spansMultipleYears)} to ${emp.contractEndDate ? formatCompactDate(emp.contractEndDate, spansMultipleYears) : 'Ongoing'}`}
                      >
                        {/* Start Date label — anchored to the bar's own left edge (right: 100%,
                            so the text grows leftward), never to the timeline's data range. This
                            is what keeps it correctly positioned per-person and never clipped:
                            .timeline-plot-area reserves a small horizontal gutter inside
                            .timeline-track-area (see index.css) purely so this label has room to
                            render even for the very first bar, without changing the bar's actual
                            plotted position within the real data domain. */}
                        <span className="timeline-start-label">{formatCompactDate(emp.startDate, spansMultipleYears)}</span>

                        {pos.isOngoing ? (
                          <span className="timeline-end-label timeline-ongoing-label">Ongoing</span>
                        ) : (
                          <span className="timeline-end-label">{formatCompactDate(emp.contractEndDate, spansMultipleYears)}</span>
                        )}

                        {isHovered && (
                          <div className="timeline-tooltip">
                            <div className="timeline-tooltip-title">
                              {emp.fullName} <span>({emp.employeeId})</span>
                            </div>
                            <div>{emp.department ? emp.department.name : 'Unassigned'}</div>
                            <div>{emp.directoryType}</div>
                            <div>
                              {formatCompactDate(emp.startDate, true)} &rarr; {emp.contractEndDate ? formatCompactDate(emp.contractEndDate, true) : 'Ongoing'}
                            </div>
                            <div>{emp.status}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <DepartmentColorsModal
        isOpen={isColorsModalOpen}
        onClose={() => setIsColorsModalOpen(false)}
        onSaved={refreshDepartments}
      />
    </div>
  );
}
