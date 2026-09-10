import React, { useMemo, useState } from 'react';
import {
  formatDateDisplay,
  getTodayLocalDateString,
  calculateTimelineRange,
  generateTimelineMonthTicks,
  calculateTimelineBarPosition,
} from '../../utils/dateUtils.js';
import { resolveDepartmentColor, buildDepartmentLegend } from '../../domain/departmentDomain.js';

const TYPE_BADGE_STYLES = {
  Employee: { bg: '#F1F5F9', color: '#475569' },
  Intern: { bg: '#E0F2FE', color: '#0369A1' },
};

export default function EmployeeTimelineView({ employees = [] }) {
  const [hoveredId, setHoveredId] = useState(null);
  const today = getTodayLocalDateString();

  const range = useMemo(
    () => calculateTimelineRange(
      employees.map((e) => ({ startDate: e.startDate, contractEndDate: e.contractEndDate })),
      today
    ),
    [employees, today]
  );

  const monthTicks = useMemo(
    () => (range ? generateTimelineMonthTicks(range.rangeStart, range.rangeEnd) : []),
    [range]
  );

  const legend = useMemo(() => buildDepartmentLegend(employees), [employees]);

  if (!range) {
    return (
      <div className="timeline-card">
        <p className="timeline-no-range-note">
          Unable to render a Timeline — no employee in the current result set has a Start Date on record.
        </p>
      </div>
    );
  }

  const canvasMinWidth = Math.max(760, monthTicks.length * 90);

  return (
    <div className="timeline-card">
      {legend.length > 0 && (
        <div className="timeline-legend">
          {legend.map((d) => (
            <span key={d.id} className="timeline-legend-item">
              <span className="timeline-legend-dot" style={{ backgroundColor: d.color }} />
              <span>{d.name}</span>
            </span>
          ))}
        </div>
      )}

      <div className="timeline-scroll-area">
        <div className="timeline-canvas" style={{ minWidth: `${canvasMinWidth}px` }}>
          {/* Axis */}
          <div className="timeline-axis-row">
            <div className="timeline-name-col-spacer" />
            <div className="timeline-track-area">
              {monthTicks.map((tick, idx) => (
                <span key={idx} className="timeline-axis-tick" style={{ left: `${tick.ratio * 100}%` }}>
                  {tick.label}
                </span>
              ))}
            </div>
          </div>

          {/* Rows */}
          {employees.map((emp) => {
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
                  <div className="dates-cell timeline-dates-cell">
                    <span className="dates-start">{formatDateDisplay(emp.startDate)}</span>
                    <span className="dates-arrow-end">
                      &rarr; {emp.contractEndDate ? formatDateDisplay(emp.contractEndDate) : 'Ongoing'}
                    </span>
                  </div>
                </div>

                <div className="timeline-track-area">
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
                      aria-label={`${emp.fullName}, ${emp.department ? emp.department.name : 'Unassigned'}, ${formatDateDisplay(emp.startDate)} to ${emp.contractEndDate ? formatDateDisplay(emp.contractEndDate) : 'Ongoing'}`}
                    >
                      {pos.isOngoing && (
                        <span className="timeline-ongoing-label" style={{ left: '100%' }}>Ongoing</span>
                      )}

                      {isHovered && (
                        <div className="timeline-tooltip">
                          <div className="timeline-tooltip-title">
                            {emp.fullName} <span>({emp.employeeId})</span>
                          </div>
                          <div>{emp.department ? emp.department.name : 'Unassigned'}</div>
                          <div>{emp.directoryType}</div>
                          <div>
                            {formatDateDisplay(emp.startDate)} &rarr; {emp.contractEndDate ? formatDateDisplay(emp.contractEndDate) : 'Ongoing'}
                          </div>
                          <div>{emp.status}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
