import React from 'react';
import { AlertCircle, Clock, CalendarCheck, CheckCircle2 } from 'lucide-react';

export default function ActivitySummaryCards({ stats = {}, loading = false }) {
  const cards = [
    {
      id: 'overdue',
      title: 'Overdue Tasks',
      value: stats.overdueCount || 0,
      subtext: 'Requires immediate action',
      icon: AlertCircle,
      bgColor: '#FEF2F2',
      iconColor: '#DC2626',
      borderColor: '#FECACA',
    },
    {
      id: 'dueToday',
      title: 'Due Today',
      value: stats.dueTodayCount || 0,
      subtext: 'Scheduled for today',
      icon: Clock,
      bgColor: '#FFFBEB',
      iconColor: '#D97706',
      borderColor: '#FDE68A',
    },
    {
      id: 'upcoming',
      title: 'Upcoming Tasks',
      value: stats.upcomingCount || 0,
      subtext: 'Scheduled for future dates',
      icon: CalendarCheck,
      bgColor: 'var(--color-primary-light)',
      iconColor: 'var(--color-primary-active)',
      borderColor: '#99E6EB',
    },
    {
      id: 'completed',
      title: 'Completed Tasks',
      value: stats.completedCount || 0,
      subtext: 'Finished activities',
      icon: CheckCircle2,
      bgColor: '#ECFDF5',
      iconColor: '#059669',
      borderColor: '#A7F3D0',
    },
  ];

  if (loading) {
    return (
      <div className="summary-cards-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="summary-card skeleton-card" style={{ height: '90px' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="summary-cards-grid">
      {cards.map((card) => {
        const IconComponent = card.icon;
        return (
          <div key={card.id} className="summary-card">
            <div className="summary-card-header">
              <span className="summary-card-title">{card.title}</span>
              <div
                className="summary-card-icon"
                style={{
                  backgroundColor: card.bgColor,
                  color: card.iconColor,
                  borderColor: card.borderColor,
                }}
              >
                <IconComponent size={17} />
              </div>
            </div>
            <div className="summary-card-value">{card.value}</div>
            <div className="summary-card-subtext">{card.subtext}</div>
          </div>
        );
      })}
    </div>
  );
}
