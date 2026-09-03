import React, { useState, useEffect } from 'react';
import { locationService } from '../../services/locationService';
import LocationCard from '../../components/organization/LocationCard';
import OrganizationSkeleton from '../../components/organization/OrganizationSkeleton';

export default function WorkLocationsPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const locs = await locationService.getAll();
        setLocations(locs);
      } catch (err) {
        console.error('Failed to load location data:', err);
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
          <h1 className="page-title">Work Locations</h1>
          <p className="page-description">
            Rizurf office locations, branches, remote hubs, and assigned workforce
          </p>
        </div>
        <div className="directory-count-badge">{locations.length} Locations</div>
      </div>

      {loading ? (
        <OrganizationSkeleton />
      ) : (
        <div className="location-card-grid">
          {locations.map((loc) => (
            <LocationCard key={loc.id} location={loc} />
          ))}
        </div>
      )}
    </div>
  );
}
