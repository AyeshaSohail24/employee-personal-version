import React, { useState, useEffect } from 'react';
import { X, UserPlus, AlertCircle } from 'lucide-react';
import { employeeService } from '../../services/employeeService.js';
import { departmentService } from '../../services/departmentService.js';
import { validateEmployeeCreation } from '../../domain/employmentDomain.js';
import { getTodayLocalDateString } from '../../utils/dateUtils.js';
import { Select } from '../common/Select.jsx';

const TYPE_OPTIONS = [
  { value: 'Employee', label: 'Employee' },
  { value: 'Intern', label: 'Intern' },
];

const MODE_OPTIONS = [
  { value: 'On-site', label: 'On-site' },
  { value: 'Remote', label: 'Remote' },
  { value: 'Hybrid', label: 'Hybrid' },
];

const SALARY_OPTIONS = [
  { value: 'Paid', label: 'Paid' },
  { value: 'Unpaid', label: 'Unpaid' },
];

const STATUS_OPTIONS = [
  { value: 'Upcoming', label: 'Upcoming' },
  { value: 'Onboarding', label: 'Onboarding' },
  { value: 'Active', label: 'Active' },
  { value: 'Departing', label: 'Departing' },
  { value: 'Former', label: 'Former' },
];

const buildInitialFormState = () => ({
  firstName: '',
  lastName: '',
  workEmail: '',
  icPassportNumber: '',
  workPhone: '',
  departmentId: '',
  homeAddress: '',
  directoryType: '',
  startDate: getTodayLocalDateString(),
  contractEndDate: '',
  allowance: '',
  workMode: '',
  managerId: '',
  status: '',
  notes: '',
});

export default function CreateEmployeeModal({ isOpen, onClose, onSubmit }) {
  const [formData, setFormData] = useState(buildInitialFormState());
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [existingEmployees, setExistingEmployees] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(buildInitialFormState());
      setErrors({});
      setIsSubmitting(false);
      loadReferenceOptions();
    }
  }, [isOpen]);

  const loadReferenceOptions = async () => {
    setLoadingOptions(true);
    try {
      const [depts, emps] = await Promise.all([
        departmentService.getAll({ withCount: false }),
        employeeService.getAll(),
      ]);
      setDepartments(depts);
      // Supervisor candidates: existing employees only (a not-yet-created record can
      // never appear here), excluding Former employees as sensible supervisors.
      setExistingEmployees(emps.filter((e) => e.status !== 'Former'));
    } catch (err) {
      console.error('Failed to load Create Employee reference data:', err);
    } finally {
      setLoadingOptions(false);
    }
  };

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();

    const { isValid, errors: validationErrors } = validateEmployeeCreation(formData, existingEmployees);
    if (!isValid) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData, {
        departmentId: formData.departmentId,
        managerId: formData.managerId || null,
      });
      onClose();
    } catch (err) {
      setErrors({ form: err.message || 'Failed to create personnel record.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const supervisorOptions = [
    { value: '', label: 'None' },
    ...existingEmployees.map((emp) => ({ value: emp.id, label: `${emp.fullName} (${emp.employeeId})` })),
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide-modal" style={{ maxWidth: '760px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="modal-title">Create Personnel</h3>
              <p className="modal-subtitle">Add a new employee or intern to the Rizurf personnel directory</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmitForm}>
          <div className="modal-body">
            {errors.form && (
              <div className="modal-error-alert">
                <AlertCircle size={16} />
                <span>{errors.form}</span>
              </div>
            )}

            {/* First / Last Name */}
            <div className="dept-card-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">First Name <span className="required-star">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                />
                {errors.firstName && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.firstName}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Last Name <span className="required-star">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                />
                {errors.lastName && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.lastName}</span>}
              </div>
            </div>

            {/* Email / Phone */}
            <div className="dept-card-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Email <span className="required-star">*</span></label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="name@rizurf.example"
                  value={formData.workEmail}
                  onChange={(e) => handleChange('workEmail', e.target.value)}
                />
                {errors.workEmail && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.workEmail}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="+60 3-8000 1000"
                  value={formData.workPhone}
                  onChange={(e) => handleChange('workPhone', e.target.value)}
                />
              </div>
            </div>

            {/* IC/Passport / Department */}
            <div className="dept-card-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">IC / Passport Number</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 990101-14-5678"
                  value={formData.icPassportNumber}
                  onChange={(e) => handleChange('icPassportNumber', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Department <span className="required-star">*</span></label>
                <Select
                  variant="form"
                  placeholder={loadingOptions ? 'Loading departments...' : 'Select Department...'}
                  value={formData.departmentId}
                  onChange={(e) => handleChange('departmentId', e.target.value)}
                  options={departments.map((d) => ({ value: d.id, label: d.name }))}
                />
                {errors.departmentId && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.departmentId}</span>}
              </div>
            </div>

            {/* Type / Work Mode */}
            <div className="dept-card-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Type <span className="required-star">*</span></label>
                <Select
                  variant="form"
                  placeholder="Select..."
                  value={formData.directoryType}
                  onChange={(e) => handleChange('directoryType', e.target.value)}
                  options={TYPE_OPTIONS}
                />
                {errors.directoryType && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.directoryType}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Work Mode <span className="required-star">*</span></label>
                <Select
                  variant="form"
                  placeholder="Select Work Mode..."
                  value={formData.workMode}
                  onChange={(e) => handleChange('workMode', e.target.value)}
                  options={MODE_OPTIONS}
                />
                {errors.workMode && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.workMode}</span>}
              </div>
            </div>

            {/* Start / End Date */}
            <div className="dept-card-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Start Date <span className="required-star">*</span></label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.startDate}
                  onChange={(e) => handleChange('startDate', e.target.value)}
                />
                {errors.startDate && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.startDate}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">End Date <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.contractEndDate}
                  onChange={(e) => handleChange('contractEndDate', e.target.value)}
                />
                {errors.contractEndDate && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.contractEndDate}</span>}
              </div>
            </div>

            {/* Salary / Status */}
            <div className="dept-card-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Salary <span className="required-star">*</span></label>
                <Select
                  variant="form"
                  placeholder="Select Salary Status..."
                  value={formData.allowance}
                  onChange={(e) => handleChange('allowance', e.target.value)}
                  options={SALARY_OPTIONS}
                />
                {errors.allowance && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.allowance}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Status <span className="required-star">*</span></label>
                <Select
                  variant="form"
                  placeholder="Select Status..."
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  options={STATUS_OPTIONS}
                />
                {errors.status && <span className="form-hint" style={{ color: '#DC2626' }}>{errors.status}</span>}
              </div>
            </div>

            {/* Supervisor */}
            <div className="form-group">
              <label className="form-label">Supervisor</label>
              <Select
                variant="form"
                value={formData.managerId}
                onChange={(e) => handleChange('managerId', e.target.value)}
                options={supervisorOptions}
              />
            </div>

            {/* Home Address */}
            <div className="form-group">
              <label className="form-label">Home Address</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={formData.homeAddress}
                onChange={(e) => handleChange('homeAddress', e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Notes <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Any additional context for this employee record..."
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ padding: '1rem 1.5rem', backgroundColor: 'var(--bg-subtle)', marginTop: 0 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Personnel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
