import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Users, Building2, ArrowRight } from 'lucide-react';

export default function LocationCard({ location }) {
  const count = location.currentWorkforceCount || 0;
  const depts = location.representedDepartments || [];

  return (
    <div className="location-card">
      <div className="loc-card-header">
        <div>
          <div className="loc-title-group">
            <h3 className="loc-name">{location.name}</h3>
            {location.type && <span className="loc-type-tag">{location.type}</span>}
          </div>
          <p className="loc-address">
            <MapPin size={14} className="loc-pin-icon" />
            <span>{location.address}</span>
          </p>
        </div>

        <Link
          to={`/employees?locationId=${location.id}`}
          className="loc-count-badge"
          title={`View employees assigned to ${location.name}`}
        >
          <Users size={14} />
          <span>{count} {count === 1 ? 'employee' : 'employees'}</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      <div className="loc-card-body">
        {depts.length > 0 && (
          <div className="loc-depts-group">
            <span className="loc-depts-label">Represented Departments:</span>
            <div className="loc-dept-pills">
              {depts.map((d) => (
                <span key={d.id} className="loc-dept-pill" style={{ borderColor: d.color }}>
                  <Building2 size={12} />
                  <span>{d.name}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
