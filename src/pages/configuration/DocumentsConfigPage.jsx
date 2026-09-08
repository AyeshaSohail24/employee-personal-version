import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  Edit2,
  Power,
  Trash2,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useRole } from '../../state/RoleContext';
import { configurationService } from '../../services/configurationService';
import { DOCUMENT_CATEGORIES } from '../../domain/documentTypeDomain';
import { DocumentTypeModal } from '../../components/configuration/DocumentTypeModal';

export default function DocumentsConfigPage() {
  const { currentRole, hasCapability } = useRole();
  const isReadOnly = !hasCapability('manage_config_docs');

  const [documentTypes, setDocumentTypes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(null);

  // Delete Prompt State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await configurationService.getDocumentConfig();
      setDocumentTypes(data.documentTypes || []);
    } catch (err) {
      console.error('Failed to load document configuration:', err);
      setError(err.message || 'Failed to load document configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Document Types
  const filteredTypes = documentTypes.filter((docType) => {
    const matchesSearch =
      docType.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      docType.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (docType.description && docType.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'All' || docType.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleOpenCreateModal = () => {
    setSelectedType(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (docType) => {
    setSelectedType(docType);
    setIsModalOpen(true);
  };

  const handleSaveDocumentType = async (formData, existingId) => {
    if (existingId) {
      await configurationService.updateDocumentType(existingId, formData, currentRole);
    } else {
      await configurationService.createDocumentType(formData, currentRole);
    }
    await loadData();
  };

  const handleToggleActive = async (docType) => {
    try {
      await configurationService.toggleDocumentTypeActive(docType.id, currentRole);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to update status.');
    }
  };

  const handleDeleteClick = (docType) => {
    setDeleteError(null);
    setDeleteTarget(docType);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await configurationService.deleteDocumentType(deleteTarget.id, currentRole);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setDeleteError(err.message);
    }
  };

  return (
    <div className="config-page-wrapper">
      {/* 1. Header Card */}
      <div className="config-header-card">
        <div className="config-header-left">
          <div className="config-header-icon teal">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="config-header-title">Documents Configuration</h1>
            <p className="config-header-desc">
              Master document types, compliance classifications, and expiry tracking rules for company records.
            </p>
          </div>
        </div>
        {!isReadOnly && (
          <button className="btn-primary-teal" onClick={handleOpenCreateModal}>
            <Plus size={18} />
            <span>Create Document Type</span>
          </button>
        )}
      </div>

      {/* 2. Search & Category Filter Toolbar */}
      <div className="documents-config-toolbar">
        {/* Search Field */}
        <div className="toolbar-search-box">
          <Search size={18} className="toolbar-search-icon" />
          <input
            type="text"
            className="toolbar-search-input"
            placeholder="Search document types by name, code, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search document types"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="documents-config-filter-row" role="tablist" aria-label="Document Category Filters">
          <button
            type="button"
            className={`documents-config-filter-btn ${selectedCategory === 'All' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('All')}
            aria-pressed={selectedCategory === 'All'}
          >
            <span>All</span>
            <span className="documents-config-filter-count">{documentTypes.length}</span>
          </button>
          {DOCUMENT_CATEGORIES.map((cat) => {
            const count = documentTypes.filter((d) => d.category === cat).length;
            return (
              <button
                key={cat}
                type="button"
                className={`documents-config-filter-btn ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
                aria-pressed={selectedCategory === cat}
              >
                <span>{cat}</span>
                <span className="documents-config-filter-count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="config-form-error-banner" style={{ marginBottom: '1rem' }}>
          <span>{error}</span>
        </div>
      )}

      {/* 3. Main Data Table */}
      <div className="config-table-card">
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading document types configuration...
          </div>
        ) : filteredTypes.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No document types found matching your criteria.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="config-table-wrapper desktop-only">
              <table className="config-table documents-config-table">
                <colgroup>
                  <col className="col-doc-type" />
                  <col className="col-code" />
                  <col className="col-category" />
                  <col className="col-expiry" />
                  <col className="col-references" />
                  <col className="col-status" />
                  <col className="col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th>DOCUMENT TYPE</th>
                    <th>CODE</th>
                    <th>CATEGORY</th>
                    <th>EXPIRY TRACKING</th>
                    <th>REFERENCES</th>
                    <th>STATUS</th>
                    <th style={{ textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTypes.map((docType) => (
                    <tr key={docType.id} className={!docType.active ? 'row-inactive' : ''}>
                      <td>
                        <div className="config-name-cell">
                          <div className="config-item-name" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{docType.name}</div>
                          {docType.description && (
                            <div className="config-item-desc" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{docType.description}</div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="config-code-badge">{docType.code}</span>
                      </td>
                      <td>
                        <span className="config-pill-category">{docType.category}</span>
                      </td>
                      <td>
                        {docType.requiresExpiry ? (
                          <span className="config-expiry-badge active">
                            <Calendar size={12} />
                            <span>Expiry Required</span>
                          </span>
                        ) : (
                          <span className="config-expiry-badge inactive">
                            <span>No Expiry</span>
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="config-pill-ref">
                          {docType.totalReferences} ref(s)
                        </span>
                      </td>
                      <td>
                        {docType.active ? (
                          <span className="config-pill-active">Active</span>
                        ) : (
                          <span className="config-pill-inactive">Inactive</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="config-actions-cell" style={{ justifyContent: 'flex-end' }}>
                          {!isReadOnly ? (
                            <>
                              <button
                                className="config-action-btn"
                                title="Edit Document Type"
                                onClick={() => handleOpenEditModal(docType)}
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                className={`config-action-btn ${docType.active ? 'active' : 'inactive'}`}
                                title={docType.active ? 'Deactivate Document Type' : 'Activate Document Type'}
                                onClick={() => handleToggleActive(docType)}
                              >
                                <Power size={15} />
                              </button>
                              <button
                                className="config-action-btn danger"
                                title="Delete Document Type"
                                onClick={() => handleDeleteClick(docType)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Read Only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="config-mobile-cards mobile-only">
              {filteredTypes.map((docType) => (
                <div key={docType.id} className="config-mobile-card">
                  <div className="config-mobile-card-header">
                    <div>
                      <div className="config-item-name">{docType.name}</div>
                      <span className="config-code-badge">{docType.code}</span>
                    </div>
                    {docType.active ? (
                      <span className="config-pill-active">Active</span>
                    ) : (
                      <span className="config-pill-inactive">Inactive</span>
                    )}
                  </div>
                  {docType.description && (
                    <p className="config-mobile-card-desc">{docType.description}</p>
                  )}
                  <div className="config-mobile-card-meta">
                    <div>Category: <strong>{docType.category}</strong></div>
                    <div>Expiry: <strong>{docType.requiresExpiry ? 'Yes' : 'No'}</strong></div>
                    <div>References: <strong>{docType.totalReferences}</strong></div>
                  </div>
                  {!isReadOnly && (
                    <div className="config-mobile-card-actions">
                      <button className="btn-secondary btn-sm" onClick={() => handleOpenEditModal(docType)}>
                        <Edit2 size={14} /> Edit
                      </button>
                      <button className="btn-secondary btn-sm" onClick={() => handleToggleActive(docType)}>
                        <Power size={14} /> {docType.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button className="btn-secondary btn-sm danger" onClick={() => handleDeleteClick(docType)}>
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal Dialog */}
      <DocumentTypeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveDocumentType}
        documentType={selectedType}
        allTypes={documentTypes}
      />

      {/* Delete / Deactivate Prompt Modal */}
      {deleteTarget && (
        <div className="config-modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="config-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="config-modal-header">
              <h3 className="config-modal-title">Delete Document Type</h3>
              <button className="config-modal-close" onClick={() => setDeleteTarget(null)}>
                <XCircle size={20} />
              </button>
            </div>
            <div style={{ padding: '1rem 0' }}>
              {deleteError ? (
                <div className="config-form-error-banner" style={{ marginBottom: '1rem' }}>
                  <AlertTriangle size={16} />
                  <span>{deleteError}</span>
                </div>
              ) : (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Are you sure you want to delete <strong>{deleteTarget.name}</strong> ({deleteTarget.code})?
                  This action cannot be undone.
                </p>
              )}
            </div>
            <div className="config-modal-actions">
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              {deleteError ? (
                <button
                  className="btn-primary-teal"
                  onClick={async () => {
                    await handleToggleActive(deleteTarget);
                    setDeleteTarget(null);
                  }}
                >
                  Deactivate Instead
                </button>
              ) : (
                <button className="btn-primary-teal danger" onClick={handleConfirmDelete}>
                  Delete Document Type
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
