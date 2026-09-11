import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/** Small color dot for options that supply a swatchColor. 'none' renders a neutral outlined
 * circle (e.g. the "Default" accent); any real CSS color renders a filled dot in that color. */
function OptionSwatch({ color }) {
  if (!color) return null;
  const isNeutral = color === 'none';
  return (
    <span
      className={`select-swatch ${isNeutral ? 'select-swatch--neutral' : ''}`}
      style={isNeutral ? undefined : { backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

/**
 * Reusable Design-System Custom Select Component for Rizurf Employees App PoC.
 * Replaces native <select> elements with fully styled closed trigger AND open menu dropdown.
 */
export function Select({
  value,
  onChange,
  options = [],
  placeholder = '',
  name = '',
  id = '',
  disabled = false,
  className = '',
  style = {},
  variant = 'form', // 'form' | 'filter' | 'role'
  'aria-label': ariaLabel,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const listboxRef = useRef(null);

  // Normalize options array into [{ value, label, swatchColor }]. `swatchColor` is optional —
  // when a caller's option objects include it (e.g. Notes' Color Accent picker), a small color
  // dot renders before the label in both the trigger and the menu; every existing consumer that
  // never passes swatchColor is completely unaffected (swatchColor stays undefined, no dot).
  const normalizedOptions = React.useMemo(() => {
    const list = [];
    if (placeholder) {
      list.push({ value: '', label: placeholder });
    }
    options.forEach((opt) => {
      if (opt === null || opt === undefined) return;
      if (typeof opt === 'string' || typeof opt === 'number') {
        list.push({ value: String(opt), label: String(opt) });
      } else if (typeof opt === 'object') {
        const val = opt.value !== undefined ? opt.value : opt.id !== undefined ? opt.id : opt.key;
        const lbl = opt.label !== undefined ? opt.label : opt.name !== undefined ? opt.name : opt.title || String(val);
        list.push({ value: String(val), label: String(lbl), swatchColor: opt.swatchColor });
      }
    });
    return list;
  }, [options, placeholder]);

  // Current selected option label
  const selectedOption = normalizedOptions.find((o) => String(o.value) === String(value)) || normalizedOptions[0];
  const displayLabel = selectedOption ? selectedOption.label : placeholder || '';

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle Option Select
  const handleSelect = (optionVal) => {
    if (disabled) return;
    setIsOpen(false);

    // Call onChange with synthetic event object for backward compatibility
    if (onChange) {
      const syntheticEvent = {
        target: {
          name,
          id,
          value: optionVal,
        },
      };
      onChange(syntheticEvent);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < normalizedOptions.length) {
        handleSelect(normalizedOptions[highlightedIndex].value);
      } else {
        setIsOpen(!isOpen);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) => (prev < normalizedOptions.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(normalizedOptions.length - 1);
      } else {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : normalizedOptions.length - 1));
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  // Class Names based on Variant
  const variantClass = variant === 'role' ? 'custom-select-role' : variant === 'filter' ? 'custom-select-filter' : 'custom-select-form';

  return (
    <div
      ref={containerRef}
      className={`custom-select-container ${variantClass} ${disabled ? 'disabled' : ''} ${isOpen ? 'is-open' : ''} ${className}`}
      style={style}
    >
      {/* Closed Trigger Control */}
      <button
        type="button"
        id={id}
        name={name}
        aria-label={ariaLabel || name || id || 'Select option'}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        className="custom-select-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
      >
        <OptionSwatch color={selectedOption?.swatchColor} />
        <span className="custom-select-value">{displayLabel}</span>
        <ChevronDown size={variant === 'role' ? 13 : 15} className={`custom-select-chevron ${isOpen ? 'chevron-up' : ''}`} />
      </button>

      {/* Opened Options Dropdown Menu */}
      {isOpen && (
        <div ref={listboxRef} className="custom-select-menu" role="listbox">
          {normalizedOptions.map((opt, index) => {
            const isSelected = String(opt.value) === String(value);
            const isHighlighted = index === highlightedIndex;

            return (
              <div
                key={`${opt.value}-${index}`}
                role="option"
                aria-selected={isSelected}
                className={`custom-select-option ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                onClick={() => handleSelect(opt.value)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <OptionSwatch color={opt.swatchColor} />
                <span className="custom-select-option-label">{opt.label}</span>
                {isSelected && <Check size={14} className="custom-select-check" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Select;
