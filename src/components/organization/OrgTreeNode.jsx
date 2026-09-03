import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Users, MapPin, Building2 } from 'lucide-react';

export default function OrgTreeNode({ node, level = 0 }) {
  const [expanded, setExpanded] = useState(true);

  if (!node || !node.employee) return null;

  const { employee, directReports = [], totalReportCount = 0 } = node;
  const hasReports = directReports.length > 0;
  const isTopRoot = level === 0;

  return (
    <div className="org-tree-branch">
      <div className={`org-node-card ${isTopRoot ? 'root-node' : ''}`}>
        <div className="org-node-header">
          <div className="org-node-user">
            <div className="org-avatar">{employee.photo}</div>
            <div>
              <div className="org-user-name">{employee.fullName}</div>
              <div className="org-user-code">{employee.employeeId}</div>
            </div>
          </div>

          {hasReports && (
            <button
              className="org-toggle-btn"
              onClick={() => setExpanded(!expanded)}
              type="button"
              title={expanded ? 'Collapse Direct Reports' : 'Expand Direct Reports'}
            >
              <Users size={14} />
              <span>{directReports.length} {directReports.length === 1 ? 'report' : 'reports'}</span>
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
        </div>

        <div className="org-node-body">
          <div className="org-node-position">
            {employee.position ? employee.position.name : 'Unassigned'}
          </div>

          <div className="org-node-meta">
            {employee.department && (
              <div className="org-meta-item">
                <Building2 size={13} />
                <span>{employee.department.name}</span>
              </div>
            )}

            {employee.location && (
              <div className="org-meta-item">
                <MapPin size={13} />
                <span>{employee.location.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Render Direct Report Children */}
      {hasReports && expanded && (
        <div className="org-children-container">
          {directReports.map((childNode) => (
            <OrgTreeNode key={childNode.employee.id} node={childNode} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
