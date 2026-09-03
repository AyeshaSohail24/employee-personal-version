import React from 'react';
import { UserCheck, Laptop, Calendar, AlertTriangle, Clock, HelpCircle } from 'lucide-react';
import { PRESENCE_STATES } from '../../domain/presenceDomain';

export default function PresenceSummaryCards({ summary, selectedFilter, onSelectFilter }) {
  if (!summary) return null;

  const cards = [
    {
      state: PRESENCE_STATES.PRESENT,
      label: 'Present',
      count: summary[PRESENCE_STATES.PRESENT] || 0,
      icon: UserCheck,
      bgColor: '#ECFDF5',
      color: '#059669',
    },
    {
      state: PRESENCE_STATES.REMOTE,
      label: 'Remote',
      count: summary[PRESENCE_STATES.REMOTE] || 0,
      icon: Laptop,
      bgColor: 'var(--color-primary-light)',
      color: 'var(--color-primary)',
    },
    {
      state: PRESENCE_STATES.ON_LEAVE,
      label: 'On Leave',
      count: summary[PRESENCE_STATES.ON_LEAVE] || 0,
      icon: Calendar,
      bgColor: '#EFF6FF',
      color: '#2563EB',
    },
    {
      state: PRESENCE_STATES.ABSENT,
      label: 'Absent',
      count: summary[PRESENCE_STATES.ABSENT] || 0,
      icon: AlertTriangle,
      bgColor: '#FEF2F2',
      color: '#DC2626',
    },
    {
      state: PRESENCE_STATES.NOT_SCHEDULED,
      label: 'Not Scheduled',
      count: summary[PRESENCE_STATES.NOT_SCHEDULED] || 0,
      icon: Clock,
      bgColor: '#F1F5F9',
      color: '#64748B',
    },
    {
      state: PRESENCE_STATES.UNKNOWN,
      label: 'Unknown',
      count: summary[PRESENCE_STATES.UNKNOWN] || 0,
      icon: HelpCircle,
      bgColor: '#FFFBEB',
      color: '#D97706',
    },
  ];

  return (
    <div className="presence-summary-grid">
      {cards.map((c) => {
        const Icon = c.icon;
        const isSelected = selectedFilter === c.state;

        return (
          <button
            key={c.state}
            type="button"
            className={`presence-summary-card ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelectFilter(isSelected ? 'All' : c.state)}
          >
            <div className="presence-card-top">
              <div className="presence-icon-badge" style={{ backgroundColor: c.bgColor, color: c.color }}>
                <Icon size={18} />
              </div>
              <span className="presence-card-val" style={{ color: c.color }}>
                {c.count}
              </span>
            </div>
            <div className="presence-card-label">{c.label}</div>
          </button>
        );
      })}
    </div>
  );
}
