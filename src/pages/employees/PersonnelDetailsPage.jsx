import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { employeeService } from '../../services/employeeService.js';
import { formatDateDisplay } from '../../utils/dateUtils.js';

/**
 * Dedicated Personnel Details page — replaces PersonnelProfileModal as the destination for the
 * Personnel directory's "View Details" action (per direct user request: a person's record can
 * grow to include CV/resume PDFs and other documents, which don't fit comfortably in a modal).
 * Sourced entirely through employeeService.getProfile(id) — the same service method
 * PersonnelProfileModal already used — so this page and the modal never diverge in what data they
 * show, and a future application/shortlisting microapp integration only ever needs to change that
 * one service method. Field labels/sections below are a direct port of PersonnelProfileModal's
 * layout, just laid out as a normal scrolling page instead of a fixed-height modal shell.
 */
function ProfileField({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', overflowWrap: 'break-word' }}>{value || '—'}</div>
    </div>
  );
}

// Documents/links render as a short "View <label>" action rather than the raw URL — future
// backend-provided CV/resume/support-letter URLs stay legible instead of overflowing a card,
// and the same convention works for any additional document field added later. Never fabricated:
// when the underlying field is null (true of every field today — see employeeService.getProfile's
// own doc comment), this renders the existing "—" empty-state convention, not a fake link.
function ProfileLinkField({ label, url }) {
  return (
    <div>
      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{label}</div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-primary)', wordBreak: 'break-word' }}
        >
          View {label}
        </a>
      ) : (
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>—</div>
      )}
    </div>
  );
}

function ProfileSection({ title, children }) {
  return (
    <div className="table-container-card" style={{ padding: '1.25rem', marginBottom: '1.25rem', background: '#FFF' }}>
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: 'var(--color-primary)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginBottom: '0.9rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid var(--border-light)',
        }}
      >
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
        {children}
      </div>
    </div>
  );
}

export default function PersonnelDetailsPage() {
  const { employeeId } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    employeeService
      .getProfile(employeeId)
      .then((result) => {
        if (!cancelled) setProfile(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  if (loading) {
    return (
      <div className="page-layout-container">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading personnel details...
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page-layout-container">
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <h2>Personnel Record Not Found</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            No personnel record matches this ID.
          </p>
          <Link to="/employees" className="btn-secondary" style={{ marginTop: '1rem', display: 'inline-block' }}>
            Back to Personnel
          </Link>
        </div>
      </div>
    );
  }

  const isFormer = profile.status === 'Former';

  return (
    <div className="page-layout-container">
      <div style={{ marginBottom: '1rem' }}>
        <Link
          to="/employees"
          style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}
        >
          <ArrowLeft size={14} /> Back to Personnel
        </Link>
      </div>

      {/* Personnel Header — avatar, name, lifecycle status, Personnel ID (dynamic, never
          hardcoded), plus type/position/department when available from the hydrated record. */}
      <div className="table-container-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: '#FFF' }}>
        <div className="emp-identity-block" style={{ gap: '1rem' }}>
          <div className="emp-avatar-circle" style={{ width: '52px', height: '52px', fontSize: '1.2rem', background: isFormer ? '#64748B' : undefined }}>
            {profile.photo || 'EM'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {profile.fullName}
              </h2>
              <span className={`emp-status-sub-pill ${profile.status.toLowerCase()}`}>
                {profile.status.toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Personnel ID: <strong>{profile.personnelId}</strong>
              {profile.employment.type ? ` · ${profile.employment.type}` : ''}
              {profile.employment.position ? ` · ${profile.employment.position}` : ''}
              {profile.employment.department ? ` · ${profile.employment.department}` : ''}
            </div>
          </div>
        </div>
      </div>

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
        <ProfileField
          label="Original Start Date"
          value={profile.educationApplication.originalStartDate ? formatDateDisplay(profile.educationApplication.originalStartDate) : null}
        />
        <ProfileField
          label="Original End Date"
          value={profile.educationApplication.originalEndDate ? formatDateDisplay(profile.educationApplication.originalEndDate) : null}
        />
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
        <ProfileField
          label="Actual Start Date"
          value={profile.employment.actualStartDate ? formatDateDisplay(profile.employment.actualStartDate) : null}
        />
        <ProfileField
          label="Actual End Date"
          value={profile.employment.actualEndDate ? formatDateDisplay(profile.employment.actualEndDate) : null}
        />
        <ProfileField label="Current Lifecycle Status" value={profile.employment.status} />
      </ProfileSection>
    </div>
  );
}
