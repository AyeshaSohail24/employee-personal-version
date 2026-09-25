import React, { useEffect, useState } from 'react';
import { X, UserCheck, AlertCircle } from 'lucide-react';
import { apiClient, ApiError } from '../../services/apiClient.js';
import { upcomingCandidateService } from '../../services/upcomingCandidateService.js';
import { Select } from '../common/Select.jsx';

const MODE_OPTIONS = ['On-site', 'Remote', 'Hybrid'].map((m) => ({ value: m, label: m }));
const ALLOWANCE_OPTIONS = ['Paid', 'Unpaid'].map((a) => ({ value: a, label: a }));

function initialForm(candidate) {
  const start = candidate?.proposedStartDate ? String(candidate.proposedStartDate).slice(0, 10) : '';
  return {
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : '',
    internshipEndDate: '',
    icPassportNumber: '',
    phone: candidate?.phone || '',
    homeAddress: '',
    departmentId: candidate?.department?.id || '',
    mode: 'On-site',
    allowance: candidate?.offerType === 'Unpaid' ? 'Unpaid' : 'Paid',
  };
}

/**
 * Accepting a candidate makes them an intern: this collects the details the Interns database
 * requires that a job application doesn't carry (IC/passport, home address, internship dates…),
 * then POST /applicants/{id}/convert creates them as an Onboarding intern, links their
 * Personnel record, and removes them from Upcoming (server/db/applicantConversion.js).
 */
export default function AcceptCandidateModal({ candidate, onClose, onAccepted }) {
  const [form, setForm] = useState(() => initialForm(candidate));
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    apiClient.get('/departments')
      .then(({ departments: list }) => setDepartments(list))
      .catch(() => setError('Could not load departments. Close and try again.'));
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape' && !isSubmitting) onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, isSubmitting]);

  const setField = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const missing = [
    !form.startDate && 'start date',
    !form.internshipEndDate && 'end date',
    !form.icPassportNumber.trim() && 'IC / passport number',
    !form.phone.trim() && 'phone number',
    !form.homeAddress.trim() && 'home address',
    !form.departmentId && 'department',
  ].filter(Boolean);
  const datesInvalid = form.startDate && form.internshipEndDate && form.internshipEndDate < form.startDate;

  const handleSubmit = async () => {
    setError('');
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.join(', ')}.`);
      return;
    }
    if (datesInvalid) {
      setError('The internship end date must be on or after the start date.');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await upcomingCandidateService.acceptAndConvert(candidate.id, form);
      onAccepted(result);
    } catch (err) {
      setError(err instanceof ApiError && err.message ? err.message : 'Could not accept this candidate. Please try again.');
      setIsSubmitting(false);
    }
  };

  const required = <span className="required-star">*</span>;

  return (
    <div className="modal-backdrop" onClick={() => !isSubmitting && onClose()}>
      <div className="modal-card wide-modal modal-scroll-shell" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <UserCheck size={20} />
            </div>
            <div>
              <h3 className="modal-title">Accept {candidate.fullName}</h3>
              <p className="modal-subtitle">
                Adds them to the Interns database as Onboarding, moves them to Onboarding and Personnel, and removes them from Upcoming.
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} disabled={isSubmitting}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="modal-error-alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="dept-card-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Email</label>
              <input type="text" className="form-input" value={candidate.email || ''} disabled />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Position</label>
              <input type="text" className="form-input" value={candidate.positionName || ''} disabled />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Internship start date {required}</label>
              <input type="date" className="form-input" value={form.startDate} onChange={setField('startDate')} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Internship end date {required}</label>
              <input type="date" className="form-input" value={form.internshipEndDate} min={form.startDate || undefined} onChange={setField('internshipEndDate')} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">IC / passport number {required}</label>
              <input type="text" className="form-input" value={form.icPassportNumber} onChange={setField('icPassportNumber')} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Phone number {required}</label>
              <input type="text" className="form-input" value={form.phone} onChange={setField('phone')} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Department {required}</label>
              <Select
                variant="filter"
                value={form.departmentId}
                onChange={setField('departmentId')}
                placeholder="Choose a department..."
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Work mode {required}</label>
              <Select variant="filter" value={form.mode} onChange={setField('mode')} options={MODE_OPTIONS} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Allowance {required}</label>
              <Select variant="filter" value={form.allowance} onChange={setField('allowance')} options={ALLOWANCE_OPTIONS} />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
            <label className="form-label">Home address {required}</label>
            <textarea className="form-textarea" rows={2} value={form.homeAddress} onChange={setField('homeAddress')} />
            <span className="form-hint">These details usually come from the candidate’s reply to the offer email.</span>
          </div>
        </div>

        <div className="modal-footer" style={{ padding: '1rem 1.5rem', backgroundColor: 'var(--bg-subtle)', marginTop: 0 }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Adding intern...' : 'Accept & Add as Intern'}
          </button>
        </div>
      </div>
    </div>
  );
}
