import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle } from 'lucide-react';
import { validateSchedule, SUPPORTED_DAYS } from '../../domain/configurationDomain';

const PRESETS = [
  {
    label: 'Mon–Fri (5 Days)',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  },
  {
    label: 'Mon–Sat (6 Days)',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  },
  {
    label: 'Mon–Wed (3 Days)',
    days: ['Monday', 'Tuesday', 'Wednesday'],
  },
];

export function ScheduleModal({ isOpen, onClose, onSave, schedule = null, allSchedules = [] }) {
  const [name, setName] = useState('');
  const [workingDays, setWorkingDays] = useState(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [weeklyHours, setWeeklyHours] = useState('40');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (schedule) {
      setName(schedule.name || '');
      setWorkingDays(Array.isArray(schedule.workingDays) ? schedule.workingDays : []);
      setStartTime(schedule.startTime || '09:00');
      setEndTime(schedule.endTime || '18:00');
      setWeeklyHours(schedule.weeklyHours !== undefined ? String(schedule.weeklyHours) : '40');
      setActive(schedule.active !== false);
    } else {
      setName('');
      setWorkingDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
      setStartTime('09:00');
      setEndTime('18:00');
      setWeeklyHours('40');
      setActive(true);
    }
    setErrors({});
  }, [schedule, isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDayToggle = (day) => {
    if (workingDays.includes(day)) {
      setWorkingDays(workingDays.filter((d) => d !== day));
    } else {
      setWorkingDays([...workingDays, day]);
    }
  };

  const handleApplyPreset = (presetDays) => {
    setWorkingDays(presetDays);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const rawData = {
      name,
      workingDays,
      startTime,
      endTime,
      weeklyHours: parseFloat(weeklyHours),
      active,
    };
    const { isValid, errors: valErrors, cleanData } = validateSchedule(rawData, allSchedules, schedule?.id);

    if (!isValid) {
      setErrors(valErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(cleanData);
      onClose();
    } catch (err) {
      setErrors({ form: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="config-modal-backdrop">
      <div className="config-modal-card" style={{ maxWidth: '560px' }}>
        <div className="config-modal-header">
          <h3 className="config-modal-title">
            {schedule ? 'Edit Work Schedule' : 'Create New Work Schedule'}
          </h3>
          <button type="button" onClick={onClose} className="config-modal-close">
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="config-modal-body">
          {errors.form && (
            <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: '#dc2626' }}>
              <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
              <span>{errors.form}</span>
            </div>
          )}

          <div className="config-form-group">
            <label className="config-form-label">
              Schedule Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard Shift (Mon-Fri 9-6)"
              className={`config-form-control ${errors.name ? 'error' : ''}`}
            />
            {errors.name && <div className="config-form-error">{errors.name}</div>}
          </div>

          <div className="config-form-group">
            <label className="config-form-label">Quick Day Presets</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleApplyPreset(preset.days)}
                  style={{
                    padding: '0.375rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    color: '#334155',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#e2e8f0';
                    e.currentTarget.style.borderColor = '#94a3b8';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="config-form-group">
            <label className="config-form-label">
              Working Days <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.5rem', marginTop: '0.25rem' }}>
              {SUPPORTED_DAYS.map((day) => {
                const isSelected = workingDays.includes(day);
                return (
                  <label
                    key={day}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      padding: '0.375rem 0.5rem',
                      borderRadius: '6px',
                      border: isSelected ? '1px solid #129FA9' : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? '#f0fdfa' : '#ffffff',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      color: isSelected ? '#0f766e' : '#475569',
                      fontWeight: isSelected ? 500 : 400,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleDayToggle(day)}
                      style={{ accentColor: '#129FA9' }}
                    />
                    <span>{day.substring(0, 3)}</span>
                  </label>
                );
              })}
            </div>
            {errors.workingDays && <div className="config-form-error">{errors.workingDays}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="config-form-group">
              <label className="config-form-label">
                Start Time <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={`config-form-control ${errors.startTime ? 'error' : ''}`}
              />
              {errors.startTime && <div className="config-form-error">{errors.startTime}</div>}
            </div>

            <div className="config-form-group">
              <label className="config-form-label">
                End Time <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={`config-form-control ${errors.endTime ? 'error' : ''}`}
              />
              {errors.endTime && <div className="config-form-error">{errors.endTime}</div>}
            </div>
          </div>

          <div className="config-form-group">
            <label className="config-form-label">
              Weekly Contracted Hours <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="168"
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(e.target.value)}
              placeholder="e.g. 40"
              className={`config-form-control ${errors.weeklyHours ? 'error' : ''}`}
            />
            {errors.weeklyHours && <div className="config-form-error">{errors.weeklyHours}</div>}
          </div>

          <label className="config-form-checkbox-group">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="config-form-checkbox"
            />
            <span style={{ fontSize: '0.8125rem', color: '#1e293b' }}>
              Active Status (Selectable for new employment schedules)
            </span>
          </label>

          <div className="config-modal-footer" style={{ borderTop: 'none', padding: '1rem 0 0 0', backgroundColor: 'transparent' }}>
            <button type="button" onClick={onClose} className="btn-secondary-cancel">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary-teal">
              {isSubmitting ? 'Saving...' : schedule ? 'Update Schedule' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
