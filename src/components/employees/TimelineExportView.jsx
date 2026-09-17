import React, { forwardRef } from 'react';
import { formatCompactDate, formatDateDisplay, calculateTimelineBarPosition } from '../../utils/dateUtils.js';
import { resolveDepartmentColor } from '../../domain/departmentDomain.js';

const EXPORT_MIN_WIDTH = 1400;
// Matches the on-screen Timeline's own `canvasMinWidth = Math.max(760, axisTicks.length * 90)`
// per-tick spacing (see EmployeeTimelineView.jsx) — the live view keeps its axis readable at ANY
// number of ticks by making its canvas wider (scrolling internally if needed). The export
// template has no scroll region by design (so the full chart is always captured, never clipped
// by a scrollport), so instead of scrolling it must widen itself outright for a long date range
// with many axis ticks — otherwise tick labels for a many-year Timeline would overlap.
const EXPORT_TICK_SPACING = 90;
const EXPORT_NAME_COL_WIDTH = 240;
const EXPORT_GUTTER = 80;

const TYPE_BADGE_STYLES = {
  Employee: { bg: '#F1F5F9', color: '#475569' },
  Intern: { bg: '#E0F2FE', color: '#0369A1' },
};

/**
 * Derives a truthful, non-fabricated scope label for the export title from the ACTUAL displayed
 * personnel only — never from raw filter state (this component never receives Search/Department/
 * Type filter values, only the already-filtered `employees` array Personnel already computed).
 * "Interns · Software Engineering" when every displayed person shares both a single directory
 * type and a single department; a plainer label when either varies; "All Personnel" when both do.
 */
function deriveScopeLabel(employees) {
  if (employees.length === 0) return 'No personnel';

  const types = new Set(employees.map((e) => e.directoryType));
  const typeLabel = types.size === 1 ? (types.has('Intern') ? 'Interns' : 'Employees') : null;

  const deptIds = new Set(employees.map((e) => (e.department ? e.department.id : 'unassigned')));
  const deptLabel = deptIds.size === 1 && employees[0].department ? employees[0].department.name : null;

  if (typeLabel && deptLabel) return `${typeLabel} · ${deptLabel}`;
  if (typeLabel) return typeLabel;
  if (deptLabel) return deptLabel;
  return 'All Personnel';
}

/**
 * The dedicated, export-ONLY DOM boundary for Personnel -> Timeline (see
 * src/utils/timelineExport.js). Rendered off-screen (see EmployeeTimelineView.jsx) and captured
 * via html-to-image — never the live, interactive on-screen Timeline. Contains ONLY report
 * content: title/scope, legend, axis, and rows/bars/labels. Deliberately excludes every
 * interactive control (Department Colors, Export, dropdowns, filters, view switcher, sidebar,
 * app header) by construction — those simply don't exist anywhere in this component's markup.
 *
 * Reuses the EXACT SAME computed range/axisTicks/legend/employees (with fresh department colors
 * already merged in) that the on-screen Timeline renders from, and the exact same
 * calculateTimelineBarPosition()/formatCompactDate() functions — this view only re-presents that
 * data with export-appropriate (fixed desktop width, plain white report background, no hover/
 * focus/tooltip affordances) styling. It never recalculates the date domain or re-fetches data.
 */
const TimelineExportView = forwardRef(function TimelineExportView(
  { employees, range, axisTicks, legend, today, spansMultipleYears },
  ref
) {
  const scopeLabel = deriveScopeLabel(employees);
  const exportWidth = Math.max(
    EXPORT_MIN_WIDTH,
    EXPORT_NAME_COL_WIDTH + EXPORT_GUTTER * 2 + axisTicks.length * EXPORT_TICK_SPACING
  );

  return (
    <div
      ref={ref}
      className="timeline-export-root"
      style={{ width: `${exportWidth}px` }}
      aria-hidden="true"
    >
      <div className="timeline-export-title-block">
        <div className="timeline-export-title">Personnel Timeline</div>
        <div className="timeline-export-subtitle">
          {scopeLabel} &middot; {employees.length} {employees.length === 1 ? 'personnel' : 'personnel'} shown
        </div>
        <div className="timeline-export-generated">Exported {formatDateDisplay(today)}</div>
      </div>

      {legend.length > 0 && (
        <div className="timeline-export-legend">
          {legend.map((d) => (
            <span key={d.id} className="timeline-export-legend-item">
              <span className="timeline-export-legend-dot" style={{ backgroundColor: d.color }} />
              <span>{d.name}</span>
            </span>
          ))}
        </div>
      )}

      <div className="timeline-export-chart">
        <div className="timeline-export-axis-row">
          <div className="timeline-export-name-col-spacer" />
          <div className="timeline-export-track-area">
            <div className="timeline-export-plot-area">
              {axisTicks.map((tick, idx) => (
                <span key={idx} className="timeline-export-axis-tick" style={{ left: `${tick.ratio * 100}%` }}>
                  {tick.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {employees.map((emp) => {
          const typeBadge = TYPE_BADGE_STYLES[emp.directoryType] || TYPE_BADGE_STYLES.Employee;

          if (!emp.startDate) {
            return (
              <div key={emp.id} className="timeline-export-row">
                <div className="timeline-export-name-col">
                  <div className="timeline-export-name-row">
                    <span className="timeline-export-emp-name">{emp.fullName}</span>
                    <span className="timeline-export-type-badge" style={{ backgroundColor: typeBadge.bg, color: typeBadge.color }}>
                      {emp.directoryType}
                    </span>
                  </div>
                  <span className="timeline-export-emp-id">{emp.employeeId}</span>
                </div>
                <div className="timeline-export-track-area">
                  <span className="timeline-export-missing-note">No Start Date on record</span>
                </div>
              </div>
            );
          }

          const pos = calculateTimelineBarPosition(emp.startDate, emp.contractEndDate, range.rangeStart, range.rangeEnd, today);
          const color = resolveDepartmentColor(emp.department);

          return (
            <div key={emp.id} className="timeline-export-row">
              <div className="timeline-export-name-col">
                <div className="timeline-export-name-row">
                  <span className="timeline-export-emp-name">{emp.fullName}</span>
                  <span className="timeline-export-type-badge" style={{ backgroundColor: typeBadge.bg, color: typeBadge.color }}>
                    {emp.directoryType}
                  </span>
                </div>
                <span className="timeline-export-emp-id">{emp.employeeId}</span>
              </div>

              <div className="timeline-export-track-area">
                <div className="timeline-export-plot-area">
                  {pos && (
                    <div
                      className="timeline-export-bar"
                      style={{ left: `${pos.leftPercent}%`, width: `${pos.widthPercent}%`, backgroundColor: color }}
                    >
                      <span className="timeline-export-start-label">{formatCompactDate(emp.startDate, spansMultipleYears)}</span>
                      {pos.isOngoing ? (
                        <span className="timeline-export-end-label timeline-export-ongoing-label">Ongoing</span>
                      ) : (
                        <span className="timeline-export-end-label">{formatCompactDate(emp.contractEndDate, spansMultipleYears)}</span>
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
  );
});

export default TimelineExportView;
