import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, User, FilePlus, NotebookPen, PencilLine, ClipboardCheck, FileText, History, Check, X, Trash2 } from 'lucide-react';
import { formerService } from '../../services/formerService.js';
import { resolveExitTypeDisplay, EXIT_TYPES, DEFAULT_EXIT_TYPE } from '../../domain/formerDomain.js';
import { formatDateDisplay } from '../../utils/dateUtils.js';
import { Select } from '../../components/common/Select.jsx';

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
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Documents are added in place (no popup): Document Title, File and Description only.
  const [isAddingDocument, setIsAddingDocument] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docFile, setDocFile] = useState(null);
  const [docDescription, setDocDescription] = useState('');
  const [docErrors, setDocErrors] = useState({});
  const [isSavingDocument, setIsSavingDocument] = useState(false);
  const documentsSectionRef = useRef(null);
  const docTitleRef = useRef(null);
  // HR Notes are added in place (no popup): Title + Note only, saved as a "General" note.
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteErrors, setNoteErrors] = useState({});
  const [isSavingNote, setIsSavingNote] = useState(false);
  const notesSectionRef = useRef(null);
  const noteTitleRef = useRef(null);
  // Exit Type is edited in place (no popup): Edit swaps the value for a dropdown with Save/Cancel.
  const [isEditingExit, setIsEditingExit] = useState(false);
  const [draftExitType, setDraftExitType] = useState(DEFAULT_EXIT_TYPE);
  const [isSavingExit, setIsSavingExit] = useState(false);
  const [exitError, setExitError] = useState('');

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

  const openDocumentForm = () => {
    setEditingDocId(null); // one document form open at a time
    setDocTitle('');
    setDocFile(null);
    setDocDescription('');
    setDocErrors({});
    setIsAddingDocument(true);
    setTimeout(() => {
      documentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      docTitleRef.current?.focus();
    }, 0);
  };

  const cancelDocumentForm = () => {
    setIsAddingDocument(false);
    setDocErrors({});
  };

  const saveDocument = async () => {
    const errors = {};
    if (!docTitle.trim()) errors.title = 'Document Title is required';
    if (!docFile) errors.file = 'Please select a file';
    if (Object.keys(errors).length > 0) {
      setDocErrors(errors);
      return;
    }
    setIsSavingDocument(true);
    try {
      await formerService.addDocument(record.employee.id, {
        title: docTitle.trim(),
        fileName: docFile.name,
        fileSize: docFile.size,
        file: docFile,
        description: docDescription.trim(),
      });
      await refreshDocuments();
      setIsAddingDocument(false);
      setDocErrors({});
    } catch (err) {
      setDocErrors({ form: err.message || 'Failed to add document.' });
    } finally {
      setIsSavingDocument(false);
    }
  };

  // Opens a document's stored file: PDFs, images and text in a new tab; anything else (e.g. Word)
  // downloads under its original name. The tab is opened synchronously on the click (then pointed
  // at the file once it's read) so pop-up blockers don't stop it.
  const openDocument = async (doc) => {
    if (!doc.hasFile) return;
    const type = doc.fileType || '';
    const viewable = type.startsWith('image/') || type === 'application/pdf' || type.startsWith('text/');
    const tab = viewable ? window.open('', '_blank') : null;
    const file = await formerService.getDocumentFile(doc.id);
    if (!file) {
      if (tab) tab.close();
      alert("This document's file isn't available in this browser.");
      return;
    }
    const url = URL.createObjectURL(file);
    if (tab) {
      tab.location.href = url;
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName || 'document';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  // Editing a document in place (no popup): Title, Description and an optional replacement file.
  const [editingDocId, setEditingDocId] = useState(null);
  const [editDocTitle, setEditDocTitle] = useState('');
  const [editDocDescription, setEditDocDescription] = useState('');
  const [editDocFile, setEditDocFile] = useState(null);
  const [editDocErrors, setEditDocErrors] = useState({});
  const [isSavingDocEdit, setIsSavingDocEdit] = useState(false);

  const startEditingDocument = (doc) => {
    setIsAddingDocument(false);
    setEditingDocId(doc.id);
    setEditDocTitle(doc.title || '');
    setEditDocDescription(doc.description || '');
    setEditDocFile(null);
    setEditDocErrors({});
  };

  const cancelEditingDocument = () => {
    setEditingDocId(null);
    setEditDocErrors({});
  };

  const saveDocumentEdit = async () => {
    if (!editDocTitle.trim()) {
      setEditDocErrors({ title: 'Document Title is required' });
      return;
    }
    setIsSavingDocEdit(true);
    try {
      await formerService.updateDocument(record.employee.id, editingDocId, {
        title: editDocTitle.trim(),
        description: editDocDescription.trim(),
        file: editDocFile,
      });
      await refreshDocuments();
      setEditingDocId(null);
      setEditDocErrors({});
    } catch (err) {
      setEditDocErrors({ form: err.message || 'Failed to save the document.' });
    } finally {
      setIsSavingDocEdit(false);
    }
  };

  const [deletingDocumentId, setDeletingDocumentId] = useState(null);
  const deleteDocument = async (doc) => {
    if (!window.confirm(`Delete the document "${doc.title}"?\n\nThis removes it from ${record.employee.fullName}'s record. This can't be undone.`)) return;
    setDeletingDocumentId(doc.id);
    try {
      await formerService.deleteDocument(record.employee.id, doc.id);
      await refreshDocuments();
    } catch (err) {
      alert(`Failed to delete the document: ${err.message}`);
    } finally {
      setDeletingDocumentId(null);
    }
  };

  // Editing an HR note in place (Title + Note), and deleting one — both through the Notes module.
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editNoteTitle, setEditNoteTitle] = useState('');
  const [editNoteContent, setEditNoteContent] = useState('');
  const [editNoteErrors, setEditNoteErrors] = useState({});
  const [isSavingNoteEdit, setIsSavingNoteEdit] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState(null);

  const startEditingNote = (note) => {
    setIsAddingNote(false);
    setEditingNoteId(note.id);
    setEditNoteTitle(note.title || '');
    setEditNoteContent(note.content || '');
    setEditNoteErrors({});
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setEditNoteErrors({});
  };

  const saveNoteEdit = async () => {
    const errors = {};
    if (!editNoteTitle.trim()) errors.title = 'Title is required';
    if (!editNoteContent.trim()) errors.content = 'Note is required';
    if (Object.keys(errors).length > 0) {
      setEditNoteErrors(errors);
      return;
    }
    setIsSavingNoteEdit(true);
    try {
      await formerService.updateNoteForPersonnel(editingNoteId, { title: editNoteTitle.trim(), content: editNoteContent.trim() });
      await refreshNotes();
      setEditingNoteId(null);
      setEditNoteErrors({});
    } catch (err) {
      setEditNoteErrors({ form: err.message || 'Failed to save the note.' });
    } finally {
      setIsSavingNoteEdit(false);
    }
  };

  const deleteNote = async (note) => {
    if (!window.confirm(`Delete the note "${note.title}"?\n\nIt's also removed from the Notes module. This can't be undone.`)) return;
    setDeletingNoteId(note.id);
    try {
      await formerService.deleteNoteForPersonnel(note.id);
      await refreshNotes();
    } catch (err) {
      alert(`Failed to delete the note: ${err.message}`);
    } finally {
      setDeletingNoteId(null);
    }
  };

  const openNoteForm = () => {
    setEditingNoteId(null); // one note form open at a time
    setNoteTitle('');
    setNoteContent('');
    setNoteErrors({});
    setIsAddingNote(true);
    // Bring the HR Notes section into view (the top "Add Note" button is far from it) and focus Title.
    setTimeout(() => {
      notesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      noteTitleRef.current?.focus();
    }, 0);
  };

  const cancelNoteForm = () => {
    setIsAddingNote(false);
    setNoteErrors({});
  };

  const saveNote = async () => {
    const errors = {};
    if (!noteTitle.trim()) errors.title = 'Title is required';
    if (!noteContent.trim()) errors.content = 'Note is required';
    if (Object.keys(errors).length > 0) {
      setNoteErrors(errors);
      return;
    }
    setIsSavingNote(true);
    try {
      await formerService.addNoteForPersonnel(record.employee.id, { title: noteTitle.trim(), content: noteContent.trim(), category: 'General' });
      await refreshNotes();
      setIsAddingNote(false);
      setNoteErrors({});
    } catch (err) {
      setNoteErrors({ form: err.message || 'Failed to add note.' });
    } finally {
      setIsSavingNote(false);
    }
  };

  const startEditingExit = () => {
    const current = record?.exitInfo?.exitType;
    setDraftExitType(EXIT_TYPES.includes(current) ? current : DEFAULT_EXIT_TYPE);
    setExitError('');
    setIsEditingExit(true);
  };

  const cancelEditingExit = () => {
    setIsEditingExit(false);
    setExitError('');
  };

  // Saves only the Exit Type; any Exit Remarks recorded earlier are passed back unchanged, so a save
  // never wipes them. Refreshes just the exit info (no full-page reload).
  const saveExitType = async () => {
    setIsSavingExit(true);
    setExitError('');
    try {
      await formerService.setExitInfo(record.employee.id, {
        exitType: draftExitType,
        exitRemarks: record.exitInfo?.exitRemarks || '',
      });
      const exitInfo = await formerService.getExitInfo(record.employee.id);
      setRecord((prev) => ({ ...prev, exitInfo }));
      setIsEditingExit(false);
    } catch (err) {
      setExitError(err.message || 'Could not save the Exit Type.');
    } finally {
      setIsSavingExit(false);
    }
  };

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
      <ProfileSection
        title="Former Personnel Summary"
        action={
          <button
            type="button"
            className="former-section-action"
            onClick={() => navigate(`/employees/${employee.id}`)}
          >
            <User size={14} />
            <span>View Personnel Details</span>
          </button>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          <ProfileField label="Full Name" value={employee.fullName} />
          <ProfileField label="Personnel ID" value={employee.employeeId} />
          <ProfileField label="Type" value={employee.directoryType} />
          <ProfileField label="Status" value="Former" />
          {/* Interns have no role here (this app's positions table isn't used for them), so only an
              employee's former position is shown. */}
          {!isIntern && <ProfileField label="Former Position" value={employee.position ? employee.position.name : null} />}
          <ProfileField label="Former Department" value={employee.department ? employee.department.name : null} />
        </div>
      </ProfileSection>

      {/* 2. Employment / Internship Record */}
      <ProfileSection title={isIntern ? 'Internship Record' : 'Employment Record'}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          {!isIntern && <ProfileField label="Former Position" value={employee.position ? employee.position.name : null} />}
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
          isEditingExit ? (
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                className="btn-secondary email-drafts-toolbar-btn"
                onClick={cancelEditingExit}
                disabled={isSavingExit}
                style={{ textTransform: 'none', letterSpacing: 'normal', padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}
              >
                <X size={13} />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                className="btn-primary email-drafts-toolbar-btn"
                onClick={saveExitType}
                disabled={isSavingExit}
                style={{ textTransform: 'none', letterSpacing: 'normal', padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}
              >
                <Check size={13} />
                <span>{isSavingExit ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="former-section-action"
              onClick={startEditingExit}
            >
              <PencilLine size={14} />
              <span>Edit</span>
            </button>
          )
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          {isEditingExit ? (
            <div onKeyDown={(e) => { if (e.key === 'Escape' && !isSavingExit) cancelEditingExit(); }}>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Exit Type</div>
              <Select
                id="former-exit-type-inline"
                variant="form"
                value={draftExitType}
                onChange={(e) => setDraftExitType(e.target.value)}
                options={EXIT_TYPES.map((t) => ({ value: t, label: t }))}
              />
              {exitError && <div style={{ fontSize: '0.76rem', color: '#B91C1C', marginTop: '0.3rem' }}>{exitError}</div>}
            </div>
          ) : (
            <ProfileField label="Exit Type" value={resolveExitTypeDisplay(exitInfo)} />
          )}
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
              <ProfileField label="Final Working Date" value={offboardingInstance.anchorDate ? formatDateDisplay(offboardingInstance.anchorDate) : null} />
              <ProfileField label="Completed Date" value={offboardingInstance.completedAt ? formatDateDisplay(offboardingInstance.completedAt) : null} />
            </div>
            {isOffboardingCompleted && (
              <Link to={`/offboarding/employees/${employee.id}?from=history`} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}>
                <ClipboardCheck size={14} />
                <span>View Completed Offboarding</span>
              </Link>
            )}
          </div>
        )}
      </ProfileSection>

      {/* 5. Documents — added in place: Document Title, File, Description. */}
      <div ref={documentsSectionRef}>
      <ProfileSection
        title="Documents"
        action={
          isAddingDocument ? null : (
            <button
              type="button"
              className="former-section-action"
              onClick={openDocumentForm}
            >
              <FilePlus size={14} />
              <span>Add Document</span>
            </button>
          )
        }
      >
        {isAddingDocument && (
          <div
            className="former-document-inline-form"
            onKeyDown={(e) => { if (e.key === 'Escape' && !isSavingDocument) cancelDocumentForm(); }}
            style={{ padding: '0.75rem', marginBottom: '0.9rem', border: '1px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-primary-light)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
          >
            {docErrors.form && <div style={{ fontSize: '0.78rem', color: '#B91C1C' }}>{docErrors.form}</div>}
            <div>
              <label htmlFor="former-doc-title" className="form-label">Document Title <span className="required-star">*</span></label>
              <input
                id="former-doc-title"
                ref={docTitleRef}
                type="text"
                className="form-input"
                value={docTitle}
                maxLength={255}
                disabled={isSavingDocument}
                onChange={(e) => { setDocTitle(e.target.value); if (docErrors.title) setDocErrors((p) => ({ ...p, title: null })); }}
              />
              {docErrors.title && <span className="form-hint" style={{ color: '#DC2626' }}>{docErrors.title}</span>}
            </div>
            <div>
              <label htmlFor="former-doc-file" className="form-label">File <span className="required-star">*</span></label>
              <input
                id="former-doc-file"
                type="file"
                className="form-input"
                disabled={isSavingDocument}
                onChange={(e) => { setDocFile(e.target.files && e.target.files[0] ? e.target.files[0] : null); if (docErrors.file) setDocErrors((p) => ({ ...p, file: null })); }}
              />
              {docFile && <span className="form-hint" style={{ color: 'var(--text-muted)' }}>Selected: {docFile.name} ({Math.max(1, Math.round(docFile.size / 1024))} KB)</span>}
              {docErrors.file && <span className="form-hint" style={{ color: '#DC2626' }}>{docErrors.file}</span>}
            </div>
            <div>
              <label htmlFor="former-doc-description" className="form-label">Description <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
              <textarea
                id="former-doc-description"
                className="form-textarea"
                rows={3}
                value={docDescription}
                disabled={isSavingDocument}
                onChange={(e) => setDocDescription(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
              <button type="button" className="btn-secondary email-drafts-toolbar-btn" onClick={cancelDocumentForm} disabled={isSavingDocument} style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>
                <X size={13} />
                <span>Cancel</span>
              </button>
              <button type="button" className="btn-primary email-drafts-toolbar-btn" onClick={saveDocument} disabled={isSavingDocument} style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>
                <Check size={13} />
                <span>{isSavingDocument ? 'Adding...' : 'Add Document'}</span>
              </button>
            </div>
          </div>
        )}
        {documents.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>No documents have been added yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {documents.map((doc) => (editingDocId === doc.id ? (
              <div
                key={doc.id}
                className="former-document-edit-form"
                onKeyDown={(e) => { if (e.key === 'Escape' && !isSavingDocEdit) cancelEditingDocument(); }}
                style={{ padding: '0.75rem', border: '1px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-primary-light)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
              >
                {editDocErrors.form && <div style={{ fontSize: '0.78rem', color: '#B91C1C' }}>{editDocErrors.form}</div>}
                <div>
                  <label htmlFor="former-doc-edit-title" className="form-label">Document Title <span className="required-star">*</span></label>
                  <input
                    id="former-doc-edit-title"
                    type="text"
                    className="form-input"
                    value={editDocTitle}
                    maxLength={255}
                    autoFocus
                    disabled={isSavingDocEdit}
                    onChange={(e) => { setEditDocTitle(e.target.value); if (editDocErrors.title) setEditDocErrors((p) => ({ ...p, title: null })); }}
                  />
                  {editDocErrors.title && <span className="form-hint" style={{ color: '#DC2626' }}>{editDocErrors.title}</span>}
                </div>
                <div>
                  <label htmlFor="former-doc-edit-file" className="form-label">Replace file <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                  <input
                    id="former-doc-edit-file"
                    type="file"
                    className="form-input"
                    disabled={isSavingDocEdit}
                    onChange={(e) => setEditDocFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                  />
                  <span className="form-hint" style={{ color: 'var(--text-muted)' }}>
                    {editDocFile
                      ? `New file: ${editDocFile.name} (${Math.max(1, Math.round(editDocFile.size / 1024))} KB)`
                      : `Current file: ${doc.fileName || '—'} — leave empty to keep it.`}
                  </span>
                </div>
                <div>
                  <label htmlFor="former-doc-edit-description" className="form-label">Description <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                  <textarea
                    id="former-doc-edit-description"
                    className="form-textarea"
                    rows={3}
                    value={editDocDescription}
                    disabled={isSavingDocEdit}
                    onChange={(e) => setEditDocDescription(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                  <button type="button" className="btn-secondary email-drafts-toolbar-btn" onClick={cancelEditingDocument} disabled={isSavingDocEdit} style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>
                    <X size={13} />
                    <span>Cancel</span>
                  </button>
                  <button type="button" className="btn-primary email-drafts-toolbar-btn" onClick={saveDocumentEdit} disabled={isSavingDocEdit} style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>
                    <Check size={13} />
                    <span>{isSavingDocEdit ? 'Saving...' : 'Save'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={doc.id}
                className={doc.hasFile ? 'directory-table-row' : undefined}
                role={doc.hasFile ? 'button' : undefined}
                tabIndex={doc.hasFile ? 0 : undefined}
                title={doc.hasFile ? `Open ${doc.fileName}` : undefined}
                onClick={() => openDocument(doc)}
                onKeyDown={(e) => { if (doc.hasFile && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); openDocument(doc); } }}
                style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}
              >
                <FileText size={18} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: '0.1rem' }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>{doc.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    {/* Type/date only on older documents that recorded them. */}
                    {[doc.documentType, doc.fileName, doc.documentDate ? formatDateDisplay(doc.documentDate) : null].filter(Boolean).join(' · ')}
                  </div>
                  {doc.description && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '0.35rem' }}>{doc.description}</div>
                  )}
                  {!doc.hasFile && (
                    <div style={{ fontSize: '0.72rem', color: '#B45309', marginTop: '0.35rem' }}>
                      File not saved (added before files were stored) — add it again to open it.
                    </div>
                  )}
                </div>
                <div className="plan-task-actions" style={{ flexShrink: 0 }}>
                  <button
                    type="button"
                    className="plan-task-icon-btn"
                    title="Edit this document"
                    aria-label={`Edit ${doc.title}`}
                    onClick={(e) => { e.stopPropagation(); startEditingDocument(doc); }}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <PencilLine size={14} />
                  </button>
                  <button
                    type="button"
                    className="plan-task-icon-btn plan-task-icon-btn-danger"
                    title="Delete this document"
                    aria-label={`Delete ${doc.title}`}
                    disabled={deletingDocumentId === doc.id}
                    onClick={(e) => { e.stopPropagation(); deleteDocument(doc); }}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )))}
          </div>
        )}
      </ProfileSection>
      </div>

      {/* 6. HR Notes — reuses the EXISTING Notes module; also visible on /notes. Added in place. */}
      <div ref={notesSectionRef}>
      <ProfileSection
        title="HR Notes"
        action={
          isAddingNote ? null : (
            <button
              type="button"
              className="former-section-action"
              onClick={openNoteForm}
            >
              <NotebookPen size={14} />
              <span>Add Note</span>
            </button>
          )
        }
      >
        {isAddingNote && (
          <div
            className="former-note-inline-form"
            onKeyDown={(e) => { if (e.key === 'Escape' && !isSavingNote) cancelNoteForm(); }}
            style={{ padding: '0.75rem', marginBottom: '0.9rem', border: '1px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-primary-light)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
          >
            {noteErrors.form && <div style={{ fontSize: '0.78rem', color: '#B91C1C' }}>{noteErrors.form}</div>}
            <div>
              <label htmlFor="former-note-title" className="form-label">Title <span className="required-star">*</span></label>
              <input
                id="former-note-title"
                ref={noteTitleRef}
                type="text"
                className="form-input"
                value={noteTitle}
                maxLength={255}
                disabled={isSavingNote}
                onChange={(e) => { setNoteTitle(e.target.value); if (noteErrors.title) setNoteErrors((p) => ({ ...p, title: null })); }}
              />
              {noteErrors.title && <span className="form-hint" style={{ color: '#DC2626' }}>{noteErrors.title}</span>}
            </div>
            <div>
              <label htmlFor="former-note-content" className="form-label">Note <span className="required-star">*</span></label>
              <textarea
                id="former-note-content"
                className="form-textarea"
                rows={4}
                value={noteContent}
                disabled={isSavingNote}
                onChange={(e) => { setNoteContent(e.target.value); if (noteErrors.content) setNoteErrors((p) => ({ ...p, content: null })); }}
              />
              {noteErrors.content && <span className="form-hint" style={{ color: '#DC2626' }}>{noteErrors.content}</span>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
              <button type="button" className="btn-secondary email-drafts-toolbar-btn" onClick={cancelNoteForm} disabled={isSavingNote} style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>
                <X size={13} />
                <span>Cancel</span>
              </button>
              <button type="button" className="btn-primary email-drafts-toolbar-btn" onClick={saveNote} disabled={isSavingNote} style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>
                <Check size={13} />
                <span>{isSavingNote ? 'Adding...' : 'Add Note'}</span>
              </button>
            </div>
          </div>
        )}
        {notes.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>No notes have been added yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {notes.map((note) => (editingNoteId === note.id ? (
              <div
                key={note.id}
                className="former-note-edit-form"
                onKeyDown={(e) => { if (e.key === 'Escape' && !isSavingNoteEdit) cancelEditingNote(); }}
                style={{ padding: '0.75rem', border: '1px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-primary-light)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
              >
                {editNoteErrors.form && <div style={{ fontSize: '0.78rem', color: '#B91C1C' }}>{editNoteErrors.form}</div>}
                <div>
                  <label htmlFor="former-note-edit-title" className="form-label">Title <span className="required-star">*</span></label>
                  <input
                    id="former-note-edit-title"
                    type="text"
                    className="form-input"
                    value={editNoteTitle}
                    maxLength={255}
                    autoFocus
                    disabled={isSavingNoteEdit}
                    onChange={(e) => { setEditNoteTitle(e.target.value); if (editNoteErrors.title) setEditNoteErrors((p) => ({ ...p, title: null })); }}
                  />
                  {editNoteErrors.title && <span className="form-hint" style={{ color: '#DC2626' }}>{editNoteErrors.title}</span>}
                </div>
                <div>
                  <label htmlFor="former-note-edit-content" className="form-label">Note <span className="required-star">*</span></label>
                  <textarea
                    id="former-note-edit-content"
                    className="form-textarea"
                    rows={4}
                    value={editNoteContent}
                    disabled={isSavingNoteEdit}
                    onChange={(e) => { setEditNoteContent(e.target.value); if (editNoteErrors.content) setEditNoteErrors((p) => ({ ...p, content: null })); }}
                  />
                  {editNoteErrors.content && <span className="form-hint" style={{ color: '#DC2626' }}>{editNoteErrors.content}</span>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                  <button type="button" className="btn-secondary email-drafts-toolbar-btn" onClick={cancelEditingNote} disabled={isSavingNoteEdit} style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>
                    <X size={13} />
                    <span>Cancel</span>
                  </button>
                  <button type="button" className="btn-primary email-drafts-toolbar-btn" onClick={saveNoteEdit} disabled={isSavingNoteEdit} style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>
                    <Check size={13} />
                    <span>{isSavingNoteEdit ? 'Saving...' : 'Save'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div key={note.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>{note.title}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {formatDateDisplay(note.createdAt ? note.createdAt.slice(0, 10) : null)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '0.35rem', whiteSpace: 'pre-wrap' }}>{note.content}</div>
                </div>
                <div className="plan-task-actions" style={{ flexShrink: 0 }}>
                  <button
                    type="button"
                    className="plan-task-icon-btn"
                    title="Edit this note"
                    aria-label={`Edit note ${note.title}`}
                    onClick={() => startEditingNote(note)}
                  >
                    <PencilLine size={14} />
                  </button>
                  <button
                    type="button"
                    className="plan-task-icon-btn plan-task-icon-btn-danger"
                    title="Delete this note"
                    aria-label={`Delete note ${note.title}`}
                    disabled={deletingNoteId === note.id}
                    onClick={() => deleteNote(note)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )))}
          </div>
        )}
      </ProfileSection>
      </div>

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

    </div>
  );
}
