import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, CheckSquare, PhoneCall, Calendar, FileText, ClipboardCheck, Clock } from 'lucide-react';
import {
  validateActivityType,
  SUPPORTED_ACTIVITY_CATEGORIES,
  SUPPORTED_ACTIVITY_ICONS,
} from '../../domain/configurationDomain';

const ICON_MAP = {
  CheckSquare,
  PhoneCall,
  Calendar,
  FileText,
  ClipboardCheck,
  Clock,
};

export function ActivityTypeModal({ isOpen, onClose, onSave, activityType = null, allTypes = [] }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [icon, setIcon] = useState('CheckSquare');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (activityType) {
      setName(activityType.name || '');
      setCategory(activityType.category || 'General');
      setIcon(activityType.icon || 'CheckSquare');
      setActive(activityType.active !== false);
    } else {
      setName('');
      setCategory('General');
      setIcon('CheckSquare');
      setActive(true);
    }
    setErrors({});
  }, [activityType, isOpen]);

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

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const rawData = { name, category, icon, active };
    const { isValid, errors: valErrors, cleanData } = validateActivityType(rawData, allTypes, activityType?.id);

    if (!isValid) {
      setErrors(valErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(cleanData);
      onClose();
    } catch (err) {
      setErrors({ form: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 my-auto max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {activityType ? 'Edit Activity Type' : 'Create New Activity Type'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {errors.form && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errors.form}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Activity Type Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Compliance Audit"
              className={`w-full h-10 px-3 py-2 text-sm rounded-lg border bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${
                errors.name
                  ? 'border-red-500 focus:ring-red-200'
                  : 'border-slate-300 dark:border-slate-600 focus:ring-[#129FA9]/30 focus:border-[#129FA9]'
              }`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`w-full h-10 px-3 py-2 text-sm rounded-lg border bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${
                errors.category
                  ? 'border-red-500 focus:ring-red-200'
                  : 'border-slate-300 dark:border-slate-600 focus:ring-[#129FA9]/30 focus:border-[#129FA9]'
              }`}
            >
              {SUPPORTED_ACTIVITY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              Select Icon <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-6 gap-2">
              {SUPPORTED_ACTIVITY_ICONS.map((iconName) => {
                const IconComp = ICON_MAP[iconName] || CheckSquare;
                const isSelected = icon === iconName;
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setIcon(iconName)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-[#129FA9] bg-teal-50 dark:bg-teal-950/40 text-[#129FA9] dark:text-teal-300 ring-2 ring-[#129FA9]/20 font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <IconComp className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-medium truncate w-full text-center">{iconName}</span>
                  </button>
                );
              })}
            </div>
            {errors.icon && <p className="text-xs text-red-500 mt-1">{errors.icon}</p>}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="type-active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 rounded text-[#129FA9] focus:ring-[#129FA9] border-slate-300"
            />
            <label htmlFor="type-active" className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Active Status (Selectable for new activities & templates)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#129FA9] hover:bg-[#0e7c85] rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : activityType ? 'Update Activity Type' : 'Create Activity Type'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
