import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/**
 * CustomDropdown component providing consistent, bordered, rounded,
 * bounded, and theme-adaptive dropdowns for light and dark modes.
 *
 * Replaces unstyled native <select> elements across the entire app.
 */
export default function CustomDropdown({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  icon: Icon,
  className = 'relative w-full',
  buttonClassName = '',
  menuClassName = '',
  align = 'left',
  disabled = false,
  footerAction = null,
  id,
  ariaLabel
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key press
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Normalize options into [{ label, value, icon? }]
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      return {
        label: opt.label !== undefined ? opt.label : (opt.name || String(opt.value)),
        value: opt.value !== undefined ? opt.value : opt.id,
        icon: opt.icon
      };
    }
    return { label: String(opt), value: opt };
  });

  // Find currently selected item
  const selectedOption = normalizedOptions.find((opt) => {
    if (opt.value === value) return true;
    if (typeof opt.value === 'string' && typeof value === 'string') {
      return opt.value.toLowerCase() === value.toLowerCase();
    }
    return false;
  });

  const displayLabel = selectedOption ? selectedOption.label : (value || placeholder);

  const handleSelect = (optionVal) => {
    if (onChange) {
      onChange(optionVal);
    }
    setIsOpen(false);
  };

  const alignClass = align === 'right' ? 'right-0' : 'left-0';
  const widthClass = menuClassName.includes('w-') ? '' : 'w-full';

  return (
    <div className={`relative ${className}`} ref={containerRef} id={id}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || displayLabel}
        className={`w-full px-3 py-2.5 bg-[#F3F5F9] dark:bg-[#0B1220] border border-slate-200/80 dark:border-gray-700 hover:border-[#2F6FED] dark:hover:border-[#2F6FED] focus:border-[#2F6FED] rounded-[10px] text-[13px] sm:text-[14px] text-[#0B1B3F] dark:text-white flex items-center justify-between gap-2 transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2F6FED]/20 cursor-pointer min-touch disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {Icon && <Icon className="w-3.5 h-3.5 text-[#2F6FED] shrink-0" />}
          <span className="truncate font-medium">{displayLabel}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-[#6B7280] dark:text-gray-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#2F6FED]' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className={`custom-dropdown-menu ${alignClass} ${widthClass} ${menuClassName}`}
        >
          {normalizedOptions.map((opt) => {
            const isSelected = selectedOption ? selectedOption.value === opt.value : false;
            const OptIcon = opt.icon;
            return (
              <div
                key={String(opt.value)}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt.value)}
                className={`custom-dropdown-option ${
                  isSelected
                    ? 'selected font-semibold text-white bg-[#2F6FED]'
                    : 'text-[#0B1B3F] dark:text-white'
                }`}
              >
                <div className="flex items-center gap-2 truncate min-w-0">
                  {OptIcon && <OptIcon className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{opt.label}</span>
                </div>
                {isSelected && <Check className="w-4 h-4 shrink-0 text-white ml-2" />}
              </div>
            );
          })}

          {footerAction && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setIsOpen(false);
                if (footerAction.onClick) footerAction.onClick();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setIsOpen(false);
                  if (footerAction.onClick) footerAction.onClick();
                }
              }}
              className="custom-dropdown-option border-t border-slate-100 dark:border-gray-700/80 text-[#2F6FED] dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
            >
              <div className="flex items-center gap-1.5 truncate">
                {footerAction.icon && <footerAction.icon className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">{footerAction.label}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
