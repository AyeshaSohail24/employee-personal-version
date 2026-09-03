import React from 'react';
import { Building2, Clock, MapPin, Users, Calendar } from 'lucide-react';

export default function PositionCard({ position }) {
  const currentOccupants = position.currentOccupantsCount || 0;
  const upcomingCount = position.upcomingCount || 0;
  const occupants = position.occupants || [];

  return (
    <div className="position-card">
      <div className="pos-card-header">
        <div>
          <h3 className="pos-title">{position.name}</h3>
          <span className="pos-dept-tag" style={{ backgroundColor: position.departmentColor + '20', color: position.departmentColor }}>
            <Building2 size={13} />
            <span>{position.departmentName}</span>
          </span>
        </div>

        <div className="pos-count-badge">
          <Users size={14} />
          <span>{currentOccupants} {currentOccupants === 1 ? 'occupant' : 'occupants'}</span>
        </div>
      </div>

      <div className="pos-card-body">
        <div className="pos-meta-row">
          <Clock size={15} className="pos-icon" />
          <span>Schedule: {position.scheduleName}</span>
        </div>

        <div className="pos-meta-row">
          <MapPin size={15} className="pos-icon" />
          <span>Location: {position.locationName}</span>
        </div>

        {/* Scheduled Upcoming Hire Badge */}
        {upcomingCount > 0 && (
          <div className="pos-upcoming-badge">
            <Calendar size={14} />
            <span>{upcomingCount} Scheduled Upcoming Hire (Starts Oct 1, 2026)</span>
          </div>
        )}

        {/* Occupant Avatars List */}
        {occupants.length > 0 && (
          <div className="pos-occupants-list">
            <span className="occupants-label">Current Occupants:</span>
            <div className="occupant-avatars-group">
              {occupants.map((occ) => (
                <div key={occ.id} className="occupant-avatar" title={`${occ.fullName} (${occ.employeeId})`}>
                  {occ.photo}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
