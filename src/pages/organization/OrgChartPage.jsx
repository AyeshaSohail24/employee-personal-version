import React, { useState, useEffect } from 'react';
import { orgChartService } from '../../services/orgChartService';
import OrgTreeNode from '../../components/organization/OrgTreeNode';
import OrganizationSkeleton from '../../components/organization/OrganizationSkeleton';

export default function OrgChartPage() {
  const [roots, setRoots] = useState([]);
  const [totalAssignedCount, setTotalAssignedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrgChart() {
      setLoading(true);
      try {
        const res = await orgChartService.getOrgChart();
        setRoots(res.roots);
        setTotalAssignedCount(res.totalAssignedCount);
      } catch (err) {
        console.error('Failed to load org chart:', err);
      } finally {
        setLoading(false);
      }
    }
    loadOrgChart();
  }, []);

  return (
    <div className="organization-page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">Employee Org Chart</h1>
          <p className="page-description">
            Interactive employee reporting hierarchy and direct report relationships
          </p>
        </div>
        <div className="directory-count-badge">Current Workforce: {totalAssignedCount} employees</div>
      </div>

      {loading ? (
        <OrganizationSkeleton />
      ) : roots.length === 0 ? (
        <p className="empty-widget-text">No active employee reporting relationships found.</p>
      ) : (
        <div className="org-chart-forest">
          {roots.map((rootNode) => (
            <OrgTreeNode key={rootNode.employee.id} node={rootNode} level={0} />
          ))}
        </div>
      )}
    </div>
  );
}
