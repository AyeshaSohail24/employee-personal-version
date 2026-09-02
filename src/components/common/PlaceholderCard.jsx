import React from 'react';
import { Layers } from 'lucide-react';
import { useRole } from '../../state/RoleContext';

export default function PlaceholderCard({ title, subtitle, category, icon: Icon = Layers }) {
  const { currentRole } = useRole();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-description">{subtitle}</p>}
        </div>
      </div>

      <div className="placeholder-card">
        <div className="placeholder-icon">
          <Icon size={28} />
        </div>
        <h2 className="placeholder-title">{title} Module</h2>
        <p className="placeholder-body">
          This stage 1 shell route is fully mounted and ready for business components. Current role context: <strong>{currentRole}</strong>.
        </p>
        {category && <div className="tag-badge">Category: {category}</div>}
      </div>
    </div>
  );
}
