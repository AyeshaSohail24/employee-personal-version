import React, { useState, useEffect } from 'react';
import { positionService } from '../../services/positionService';
import { departmentService } from '../../services/departmentService';
import PositionCard from '../../components/organization/PositionCard';
import OrganizationSkeleton from '../../components/organization/OrganizationSkeleton';
import { Search } from 'lucide-react';

export default function JobPositionsPage() {
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [posList, deptList] = await Promise.all([
          positionService.getAll(),
          departmentService.getAll({ withCount: false }),
        ]);
        setPositions(posList);
        setDepartments(deptList);
      } catch (err) {
        console.error('Failed to load position data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredPositions = positions.filter((pos) => {
    if (selectedDept && pos.departmentId !== selectedDept) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const nameMatch = pos.name.toLowerCase().includes(q);
      const deptMatch = pos.departmentName.toLowerCase().includes(q);
      return nameMatch || deptMatch;
    }
    return true;
  });

  return (
    <div className="organization-page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">Job Positions</h1>
          <p className="page-description">
            Rizurf position structure, default schedules, locations, and current occupants
          </p>
        </div>
        <div className="directory-count-badge">{positions.length} Job Positions</div>
      </div>

      {/* Toolbar */}
      <div className="directory-toolbar-card" style={{ marginBottom: '1.25rem' }}>
        <div className="toolbar-top-row">
          <div className="toolbar-search-box">
            <Search size={18} className="toolbar-search-icon" />
            <input
              type="text"
              className="toolbar-search-input"
              placeholder="Search by position title or department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filter-item">
            <label htmlFor="dept-filter">Department:</label>
            <select
              id="dept-filter"
              className="filter-select"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <OrganizationSkeleton />
      ) : (
        <div className="position-card-grid">
          {filteredPositions.map((pos) => (
            <PositionCard key={pos.id} position={pos} />
          ))}
        </div>
      )}
    </div>
  );
}
