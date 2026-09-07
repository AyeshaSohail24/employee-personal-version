import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, ShieldAlert } from 'lucide-react';

export function DeleteConfirmModal({ isOpen, onClose, onConfirmDelete, onConfirmDeactivate, item = null, itemType = 'record' }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !item) return null;

  const canDelete = item.canDelete || item.totalReferences === 0;
  const itemName = item.name || item.title || 'Selected Item';

  const handleAction = async () => {
    setIsSubmitting(true);
    try {
      if (canDelete) {
        await onConfirmDelete(item.id);
      } else {
        await onConfirmDeactivate(item.id);
      }
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 my-auto max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-2">
            {canDelete ? (
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            )}
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {canDelete ? `Delete ${itemType}` : `Deletion Blocked — Deactivate Instead`}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            Target Record: <span className="font-semibold text-slate-900 dark:text-white">"{itemName}"</span>
          </div>

          {canDelete ? (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300 space-y-1">
              <p className="font-semibold">This record is permanently deletable because it is not referenced by any historical or active HR data.</p>
              <p className="text-red-600 dark:text-red-400">This action cannot be undone.</p>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 space-y-2">
              <p className="font-semibold">
                This record is referenced by existing HR data ({item.referenceSummary || `${item.totalReferences} references`}) and cannot be deleted.
              </p>
              <p>
                Deactivating it will remove it from future creation dropdowns while preserving full historical accuracy for past records and reporting analytics.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>

            {canDelete ? (
              <button
                type="button"
                onClick={handleAction}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAction}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Deactivating...' : 'Deactivate Record'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
