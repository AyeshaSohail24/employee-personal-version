import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Palette, Download, ChevronDown, FileText, ImageDown } from 'lucide-react';
import {
  formatCompactDate,
  getTodayLocalDateString,
  calculateTimelineRange,
  generateTimelineMonthTicks,
  calculateTimelineBarPosition,
} from '../../utils/dateUtils.js';
import { resolveDepartmentColor, buildDepartmentLegend } from '../../domain/departmentDomain.js';
import { apiClient } from '../../services/apiClient.js';
import { departmentColorStore } from '../../services/departmentColorStore.js';
import DepartmentColorsModal from './DepartmentColorsModal.jsx';
import TimelineExportView from './TimelineExportView.jsx';
import { exportTimelineAsPdf, exportTimelineAsPng } from '../../utils/timelineExport.js';

const TYPE_BADGE_STYLES = {
  Employee: { bg: '#F1F5F9', color: '#475569' },
  Intern: { bg: '#E0F2FE', color: '#0369A1' },
};

export default function EmployeeTimelineView({ employees = [] }) {
  const [hoveredId, setHoveredId] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [isColorsModalOpen, setIsColorsModalOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportMenuRef = useRef(null);
  const exportTemplateRef = useRef(null);
  const today = getTodayLocalDateString();

  // Standard click-outside-to-close for the Export menu, mirroring the app's existing dropdown
  // pattern (see NotificationPanel.jsx).
  useEffect(() => {
    if (!isExportMenuOpen) return undefined;
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExportMenuOpen]);

  // Timeline reads real Departments (GET /departments) for identity, merged with locally-stored
  // color preferences (departmentColorStore.js — colors are a pure UI preference, never real
  // department data), and re-reads it (via refreshDepartments) right after Department Colors is
  // saved, so bars reflect the new color immediately without needing a page refresh, even though
  // the `employees` prop's own embedded `.department` snapshots don't change until Personnel's
  // own data next reloads.
  const refreshDepartments = useCallback(() => {
    apiClient.get('/departments').then(({ departments: depts }) => {
      const colorMap = departmentColorStore.getAll();
      setDepartments(depts.map((d) => ({ ...d, color: colorMap[d.id] || null })));
    }).catch((err) => {
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

  // Rasterizes the dedicated off-screen export template (TimelineExportView, always mounted
  // below regardless of scroll position/viewport) — never the live interactive Timeline DOM.
  // Disabled while `!range` (the Export button doesn't even render in that case, via the early
  // return above) and while a previous export is still in flight, so HR can never trigger
  // multiple simultaneous exports.
  const handleExport = (format) => {
    if (isExporting) return;
    setIsExportMenuOpen(false);
    setIsExporting(true);

    const node = exportTemplateRef.current;
    const generate = !node
      ? Promise.reject(new Error('Export template is not ready.'))
      : format === 'pdf'
      ? exportTimelineAsPdf(node)
      : exportTimelineAsPng(node);

    generate
      .catch((err) => {
        console.error('Timeline export failed:', err);
        alert('Unable to export timeline. Please try again.');
      })
      .finally(() => setIsExporting(false));
  };

  return (
    <div className="timeline-card">
      <div className="timeline-header-row">
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

        {/* Right-aligned via its own row (justify-content: flex-end), never sharing a row with
            the legend — this is what keeps the actions pinned to the right regardless of how
            many lines the legend itself wraps to at a given width (a shared flex-wrap row with
            justify-content: space-between only right-aligns the LAST line's items when that line
            has more than one item; once the legend alone fills the first line, the actions group
            would otherwise land back at the left edge on its own line — the exact bug this
            structure avoids). */}
        <div className="timeline-actions-row">
          <div className="timeline-actions">
            <button
              type="button"
              className="timeline-action-btn timeline-action-icon-btn"
              onClick={() => setIsColorsModalOpen(true)}
              title="Department Colors"
              aria-label="Department Colors"
            >
              <Palette size={16} />
            </button>

            <div className="export-menu-wrapper" ref={exportMenuRef}>
              <button
                type="button"
                className={`timeline-action-btn timeline-export-trigger ${isExportMenuOpen ? 'is-open' : ''}`}
                onClick={() => setIsExportMenuOpen((open) => !open)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsExportMenuOpen(false);
                }}
                disabled={isExporting}
                aria-haspopup="menu"
                aria-expanded={isExportMenuOpen}
                aria-label="Export Timeline"
              >
                <Download size={14} />
                <span>{isExporting ? 'Exporting...' : 'Export'}</span>
                <ChevronDown size={14} />
              </button>

              {isExportMenuOpen && (
                <div className="export-menu" role="menu" onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsExportMenuOpen(false);
                }}>
                  <button type="button" role="menuitem" className="export-menu-item" onClick={() => handleExport('pdf')} disabled={isExporting}>
                    <FileText size={14} />
                    <span>Export as PDF</span>
                  </button>
                  <button type="button" role="menuitem" className="export-menu-item" onClick={() => handleExport('png')} disabled={isExporting}>
                    <ImageDown size={14} />
                    <span>Export as PNG</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
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

      {/* Dedicated, export-ONLY render — positioned off-screen (never visible, never affects
          layout/scroll of the page above) and always reflects the exact same filtered
          `employees`/range/axisTicks/legend the live Timeline renders from. Rasterized by
          handleExport() above; see TimelineExportView.jsx for exactly what it does/doesn't
          include. Mounting it unconditionally (rather than only during export) avoids any
          mount-then-wait-for-paint race condition when the Export button is clicked. */}
      <div className="timeline-export-offscreen-host" aria-hidden="true">
        <TimelineExportView
          ref={exportTemplateRef}
          employees={employeesWithFreshDepartments}
          range={range}
          axisTicks={axisTicks}
          legend={legend}
          today={today}
          spansMultipleYears={spansMultipleYears}
        />
      </div>
    </div>
  );
}
