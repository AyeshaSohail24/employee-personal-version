import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, User, FilePlus, NotebookPen, PencilLine, ClipboardCheck, FileText, History } from 'lucide-react';
import { formerService } from '../../services/formerService.js';
import { resolveExitTypeDisplay } from '../../domain/formerDomain.js';
import { formatDateDisplay } from '../../utils/dateUtils.js';
import AddDocumentModal from '../../components/former/AddDocumentModal.jsx';
import AddNoteModal from '../../components/former/AddNoteModal.jsx';
import EditExitInfoModal from '../../components/former/EditExitInfoModal.jsx';

function ProfileField({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', overflowWrap: 'break-word' }}>{value || '—'}</div>
    </div>
  );
}

function ProfileSection({ title, action, children }) {
  return (
    <div className="table-container-card" style={{ padding: '1.25rem', marginBottom: '1.25rem', background: '#FFF' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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
        <span>{title}</span>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

const LIFECYCLE_STAGE_LABELS = {
  Upcoming: 'Upcoming',
  Onboarding: 'Onboarding',
  Active: 'Became Active',
  Offboarding: 'Offboarding Started',
  Former: 'Former Since',
};

export default function HistoricalRecordPage() {
  const { employeeId } = useParams();
  const [record, setRecord] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [isAddDocumentOpen, setIsAddDocumentOpen] = useState(false);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [isEditExitOpen, setIsEditExitOpen] = useState(false);

  const loadRecord = useCallback(async () => {
    setLoading(true);
    try {
      const [result, docs, personNotes] = await Promise.all([
        formerService.getHistoricalRecord(employeeId),
        formerService.getDocuments(employeeId),
        formerService.getNotesForPersonnel(employeeId),
      ]);
      if (!result) {
        setNotFound(true);
      } else {
        setRecord(result);
        setDocuments(docs);
        setNotes(personNotes);
        setNotFound(false);
      }
    } catch (err) {
      console.error('Failed to load Historical Record:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  // Refreshes only the sub-resource affected by each modal's success, rather than the whole
  // page, so Add Document/Add Note/Edit Exit Information all feel immediate.
  const refreshDocuments = () => formerService.getDocuments(employeeId).then(setDocuments);
  const refreshNotes = () => formerService.getNotesForPersonnel(employeeId).then(setNotes);

  if (loading) {
    return (
      <div className="page-layout-container">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading historical record...
        </div>
      </div>
    );
  }

  if (notFound || !record) {
    return (
      <div className="page-layout-container">
        <div className="table-container-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <h2>Former Record Not Found</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            This personnel record either does not exist or is not currently a Former record.
          </p>
          <Link to="/former" className="btn-secondary" style={{ marginTop: '1rem', display: 'inline-block' }}>
            Back to Former
          </Link>
        </div>
      </div>
    );
  }

  const { employee, exitInfo, offboardingInstance, tenure, lifecycleHistory } = record;
  const isIntern = employee.directoryType === 'Intern';
  const isOffboardingCompleted = offboardingInstance?.derivedStatus === 'Completed';

  return (
    <div className="page-layout-container">
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <Link
          to="/former"
          style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}
        >
          <ArrowLeft size={14} /> Back to Former
        </Link>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link to={`/employees/${employee.id}`} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}>
            <User size={14} />
            <span>View Personnel Details</span>
          </Link>
          <button type="button" className="btn-secondary" onClick={() => setIsAddDocumentOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <FilePlus size={14} />
            <span>Add Document</span>
          </button>
          <button type="button" className="btn-primary" onClick={() => setIsAddNoteOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <NotebookPen size={14} />
            <span>Add Note</span>
          </button>
        </div>
      </div>

      {/* Identity Header */}
      <div className="table-container-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: '#FFF' }}>
        <div className="emp-identity-block" style={{ gap: '1rem' }}>
          <div className="emp-avatar-circle" style={{ width: '52px', height: '52px', fontSize: '1.2rem', background: '#64748B' }}>
            {employee.photo}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Historical Record</h2>
              <span className="emp-status-sub-pill former">FORMER</span>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.3rem' }}>
              {employee.fullName}
            </div>
            <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {employee.employeeId} · {employee.directoryType}
              {employee.position ? ` · ${employee.position.name}` : ''}
              {employee.department ? ` · ${employee.department.name}` : ''}
            </div>
            <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {formatDateDisplay(employee.startDate)} &rarr; {employee.contractEndDate ? formatDateDisplay(employee.contractEndDate) : '—'}
              {tenure ? ` · Total Tenure: ${tenure}` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* 1. Former Personnel Summary */}
      <ProfileSection title="Former Personnel Summary">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          <ProfileField label="Full Name" value={employee.fullName} />
          <ProfileField label="Personnel ID" value={employee.employeeId} />
          <ProfileField label="Type" value={employee.directoryType} />
          <ProfileField label="Status" value="Former" />
          <ProfileField label={isIntern ? 'Former Internship Role' : 'Former Position'} value={employee.position ? employee.position.name : null} />
          <ProfileField label="Former Department" value={employee.department ? employee.department.name : null} />
        </div>
      </ProfileSection>

      {/* 2. Employment / Internship Record */}
      <ProfileSection title={isIntern ? 'Internship Record' : 'Employment Record'}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          <ProfileField label={isIntern ? 'Internship Role' : 'Former Position'} value={employee.position ? employee.position.name : null} />
          <ProfileField label="Department" value={employee.department ? employee.department.name : null} />
          <ProfileField label="Supervisor" value={employee.supervisor?.fullName || employee.manager?.fullName} />
          <ProfileField label="Work Mode" value={employee.workMode} />
          <ProfileField label="Start Date" value={employee.startDate ? formatDateDisplay(employee.startDate) : null} />
          <ProfileField label="Final Working Date" value={employee.contractEndDate ? formatDateDisplay(employee.contractEndDate) : null} />
          <ProfileField label="Total Tenure" value={tenure} />
          <ProfileField label="Salary" value={employee.allowance} />
        </div>
      </ProfileSection>

      {/* 3. Exit Information */}
      <ProfileSection
        title="Exit Information"
        action={
          <button
            type="button"
            className="btn-compact-override"
            onClick={() => setIsEditExitOpen(true)}
            style={{ textTransform: 'none', letterSpacing: 'normal', fontWeight: 600 }}
          >
            <PencilLine size={12} />
            <span>Edit</span>
          </button>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          <ProfileField label="Exit Type" value={resolveExitTypeDisplay(exitInfo)} />
          <ProfileField label="Final Working Date" value={employee.contractEndDate ? formatDateDisplay(employee.contractEndDate) : null} />
          <ProfileField label="Offboarding Started" value={offboardingInstance?.startedAt ? formatDateDisplay(offboardingInstance.startedAt) : null} />
          <ProfileField label="Offboarding Completed" value={offboardingInstance?.completedAt ? formatDateDisplay(offboardingInstance.completedAt) : null} />
          <ProfileField
            label="Former Since"
            value={(() => {
              const stage = lifecycleHistory.find((s) => s.stage === 'Former');
              return stage?.date ? formatDateDisplay(stage.date) : null;
            })()}
          />
          <div style={{ gridColumn: '1 / -1' }}>
            <ProfileField label="Exit Remarks" value={exitInfo?.exitRemarks} />
          </div>
        </div>
      </ProfileSection>

      {/* 4. Offboarding Record — reuses the EXISTING offboarding system, never a duplicate. */}
      <ProfileSection title="Offboarding Record">
        {!offboardingInstance ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            No offboarding plan is on record for this person.
          </p>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1rem' }}>
              <ProfileField label="Plan Status" value={offboardingInstance.derivedStatus} />
              <ProfileField label="Tasks Completed" value={`${offboardingInstance.progress.completedTasksCount} of ${offboardingInstance.progress.totalTasks}`} />
              <ProfileField label="Final Working Date" value={offboardingInstance.startedAt ? formatDateDisplay(offboardingInstance.startedAt) : null} />
              <ProfileField label="Completed Date" value={offboardingInstance.completedAt ? formatDateDisplay(offboardingInstance.completedAt) : null} />
            </div>
            {isOffboardingCompleted && (
              <Link to={`/offboarding/employees/${employee.id}`} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}>
                <ClipboardCheck size={14} />
                <span>View Completed Offboarding</span>
              </Link>
            )}
          </div>
        )}
      </ProfileSection>

      {/* 5. Documents */}
      <ProfileSection
        title="Documents"
        action={
          <button
            type="button"
            className="btn-compact-override"
            onClick={() => setIsAddDocumentOpen(true)}
            style={{ textTransform: 'none', letterSpacing: 'normal', fontWeight: 600 }}
          >
            <FilePlus size={12} />
            <span>Add Document</span>
          </button>
        }
      >
        {documents.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>No documents have been added yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {documents.map((doc) => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
                <FileText size={18} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: '0.1rem' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>{doc.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    {doc.documentType} · {doc.fileName}
                    {doc.documentDate ? ` · ${formatDateDisplay(doc.documentDate)}` : ''}
                  </div>
                  {doc.description && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '0.35rem' }}>{doc.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ProfileSection>

      {/* 6. HR Notes — reuses the EXISTING Notes module; also visible on /notes. */}
      <ProfileSection
        title="HR Notes"
        action={
          <button
            type="button"
            className="btn-compact-override"
            onClick={() => setIsAddNoteOpen(true)}
            style={{ textTransform: 'none', letterSpacing: 'normal', fontWeight: 600 }}
          >
            <NotebookPen size={12} />
            <span>Add Note</span>
          </button>
        }
      >
        {notes.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>No notes have been added yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {notes.map((note) => (
              <div key={note.id} style={{ padding: '0.75rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>{note.title}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {note.category} · {formatDateDisplay(note.createdAt ? note.createdAt.slice(0, 10) : null)}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '0.35rem', whiteSpace: 'pre-wrap' }}>{note.content}</div>
              </div>
            ))}
          </div>
        )}
      </ProfileSection>

      {/* 7. Lifecycle History — only genuinely-available dates are shown; never invented, never
          defaulted to today. */}
      <ProfileSection title="Lifecycle History">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {lifecycleHistory.map((stage) => (
            <div key={stage.stage} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <History size={14} style={{ color: stage.date ? 'var(--color-primary)' : 'var(--border-dark)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main)', minWidth: '160px' }}>
                {LIFECYCLE_STAGE_LABELS[stage.stage] || stage.stage}
              </span>
              <span style={{ fontSize: '0.825rem', color: stage.date ? 'var(--text-main)' : 'var(--text-muted)' }}>
                {stage.date ? formatDateDisplay(stage.date) : '—'}
              </span>
            </div>
          ))}
        </div>
      </ProfileSection>

      <AddDocumentModal
        isOpen={isAddDocumentOpen}
        onClose={() => setIsAddDocumentOpen(false)}
        employeeId={employee.id}
        onSuccess={refreshDocuments}
      />
      <AddNoteModal
        isOpen={isAddNoteOpen}
        onClose={() => setIsAddNoteOpen(false)}
        employeeId={employee.id}
        onSuccess={refreshNotes}
      />
      <EditExitInfoModal
        isOpen={isEditExitOpen}
        onClose={() => setIsEditExitOpen(false)}
        employeeId={employee.id}
        currentExitInfo={exitInfo}
        onSuccess={loadRecord}
      />
    </div>
  );
}
