import React, { useState, useEffect } from 'react';
import { departmentService } from '../../services/departmentService';
import DepartmentCard from '../../components/organization/DepartmentCard';
import OrganizationSkeleton from '../../components/organization/OrganizationSkeleton';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const depts = await departmentService.getAll({ withCount: true });
        setDepartments(depts);
      } catch (err) {
        console.error('Failed to load departments:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="organization-page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">Departments</h1>
          <p className="page-description">
            Rizurf organizational structure, department managers, and current headcount
          </p>
        </div>
        <div className="directory-count-badge">{departments.length} Departments</div>
      </div>

      {loading ? (
        <OrganizationSkeleton />
      ) : (
        <div className="dept-card-grid">
          {departments.map((dept) => (
            <DepartmentCard
              key={dept.id}
              department={dept}
            />
          ))}
        </div>
      )}
    </div>
  );
}
