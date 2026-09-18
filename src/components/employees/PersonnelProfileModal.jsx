import React, { useState, useEffect } from 'react';
import { X, User, AlertTriangle } from 'lucide-react';
import { employeeService } from '../../services/employeeService.js';
import { formatDateDisplay } from '../../utils/dateUtils.js';

/**
 * Read-only Personnel Profile modal — the entry point for "View Profile" from List/Card view.
 * Sourced entirely through employeeService.getProfile(personnelId), never directly from
 * localStorage/storageEngine, so a future application/shortlisting microapp integration only
 * needs to change that one service method, never this UI. The profile is keyed by the person's
 * own internal id (their Personnel ID stays constant across lifecycle status changes), so this
 * modal shows the same structure and data regardless of whether the person is currently Active,
 * Departing, Former, etc.
 *
 * Organized into the 4 sections HR needs: Personal Information, Education & Application, Links &
 * Documents, and Employment/Internship Details. Fields the current PoC data model does not yet
 * collect (nationality, university, LinkedIn, resume, ...) are never fabricated — they render as
 * a plain "—" until a later integration actually supplies them.
 */
function ProfileField({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>{value || '—'}</div>
    </div>
  );
}

function ProfileLinkField({ label, url }) {
  return (
    <div>
      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{label}</div>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-primary)' }}>
          {url}
        </a>
      ) : (
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>—</div>
      )}
    </div>
  );
}

function ProfileSection({ title, children }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '1px solid var(--border-light)' }}>
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {children}
      </div>
    </div>
  );
}

export default function PersonnelProfileModal({ isOpen, onClose, employeeId }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && employeeId) {
      loadProfile();
    } else if (!isOpen) {
      setProfile(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, employeeId]);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await employeeService.getProfile(employeeId);
      setProfile(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card xl-modal modal-scroll-shell" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <User size={20} />
            </div>
            <div>
              <h3 className="modal-title">{profile ? profile.fullName : 'Personnel Profile'}</h3>
              <p className="modal-subtitle">{profile ? `Personnel ID: ${profile.personnelId}` : 'Loading profile...'}</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close profile">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body modal-body-spacious">
          {error && (
            <div className="modal-error-alert" style={{ marginBottom: '1.25rem' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading profile...
            </div>
          )}

          {!loading && profile && (
            <div>
              <ProfileSection title="Personal Information">
                <ProfileField label="First Name" value={profile.personal.firstName} />
                <ProfileField label="Last Name" value={profile.personal.lastName} />
                <ProfileField label="Email" value={profile.personal.email} />
                <ProfileField label="Contact Number" value={profile.personal.contactNumber} />
                <ProfileField label="IC / Passport Number" value={profile.personal.icPassportNumber} />
                <ProfileField label="Home Address" value={profile.personal.homeAddress} />
                <ProfileField label="Nationality" value={profile.personal.nationality} />
              </ProfileSection>

              <ProfileSection title="Education & Application">
                <ProfileField label="Highest Level of Education" value={profile.educationApplication.highestEducation} />
                <ProfileField label="University" value={profile.educationApplication.university} />
                <ProfileField label="Interested Position" value={profile.educationApplication.interestedPosition} />
                <ProfileField label="Acquisition Channel" value={profile.educationApplication.acquisitionChannel} />
                <ProfileField label="Original Start Date" value={profile.educationApplication.originalStartDate ? formatDateDisplay(profile.educationApplication.originalStartDate) : null} />
                <ProfileField label="Original End Date" value={profile.educationApplication.originalEndDate ? formatDateDisplay(profile.educationApplication.originalEndDate) : null} />
                <ProfileField label="Anything Else" value={profile.educationApplication.anythingElse} />
              </ProfileSection>

              <ProfileSection title="Links & Documents">
                <ProfileLinkField label="LinkedIn" url={profile.links.linkedIn} />
                <ProfileLinkField label="GitHub" url={profile.links.github} />
                <ProfileLinkField label="Resume / CV" url={profile.links.resume} />
                <ProfileLinkField label="Portfolio" url={profile.links.portfolio} />
              </ProfileSection>

              <ProfileSection title="Employment / Internship Details">
                <ProfileField label="Personnel ID" value={profile.employment.personnelId} />
                <ProfileField label="Type" value={profile.employment.type} />
                <ProfileField label="Position" value={profile.employment.position} />
                <ProfileField label="Department" value={profile.employment.department} />
                <ProfileField label="Work Mode" value={profile.employment.workMode} />
                <ProfileField label="Salary" value={profile.employment.salaryStatus} />
                <ProfileField label="Actual Start Date" value={profile.employment.actualStartDate ? formatDateDisplay(profile.employment.actualStartDate) : null} />
                <ProfileField label="Actual End Date" value={profile.employment.actualEndDate ? formatDateDisplay(profile.employment.actualEndDate) : null} />
                <ProfileField label="Current Lifecycle Status" value={profile.employment.status} />
              </ProfileSection>
            </div>
          )}
        </div>

        <div className="modal-footer modal-footer-spacious">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
