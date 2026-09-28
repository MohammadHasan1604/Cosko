'use client';

import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import Icon from '@/components/ui/AppIcon';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  icon?: string;
  disabled?: boolean;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  searchable?: boolean;
  size?: 'sm' | 'md';
  required?: boolean;
  addNewLabel?: string;
  onAddNew?: (initialSearch?: string) => void;
  allowClear?: boolean;
  error?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search options...',
  label,
  disabled = false,
  className = '',
  searchable = true,
  size = 'md',
  required = false,
  addNewLabel,
  onAddNew,
  allowClear = false,
  error,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerId = useId();
  const listboxId = useId();

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = searchable && search.trim()
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase()) ||
        opt.sublabel?.toLowerCase().includes(search.toLowerCase()) ||
        opt.value.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  // Focus search when opened
  useEffect(() => {
    if (open && searchable && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (!open) {
      setSearch('');
      setActiveIndex(-1);
    }
  }, [open, searchable]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => {
          const next = prev + 1;
          return next >= filteredOptions.length ? 0 : next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => {
          const next = prev - 1;
          return next < 0 ? filteredOptions.length - 1 : next;
        });
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(filteredOptions.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
          const opt = filteredOptions[activeIndex];
          if (!opt.disabled) {
            onChange(opt.value);
            setOpen(false);
          }
        }
        break;
    }
  }, [open, filteredOptions, activeIndex, onChange]);

  // Scroll active option into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const heightClass = size === 'sm' ? 'text-xs' : 'text-sm';
  const minH = size === 'sm' ? '32px' : '38px';

  const handleAddNewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const term = search.trim() || undefined;
    setOpen(false);
    if (onAddNew) {
      onAddNew(term);
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label htmlFor={triggerId} className="label-text">
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        id={triggerId}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
        aria-invalid={error ? 'true' : undefined}
        className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border bg-card text-foreground font-medium shadow-2xs cursor-pointer ${heightClass} ${
          error ? 'border-danger ring-1 ring-danger/20' : open ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-slate-300'
        } focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary disabled:opacity-50 disabled:cursor-not-allowed`}
        style={{ minHeight: minH }}
      >
        <span className="truncate text-left flex items-center gap-1.5 min-w-0">
          {selectedOption?.icon && (
            <Icon name={selectedOption.icon as any} size={14} className="text-muted-foreground flex-shrink-0" />
          )}
          <span className={selectedOption ? 'text-foreground font-medium truncate' : 'text-muted-foreground truncate'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="text-3xs bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded-full">
              {selectedOption.badge}
            </span>
          )}
        </span>

        <div className="flex items-center gap-1 flex-shrink-0">
          {allowClear && value && !disabled && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              title="Clear selection"
              role="button"
              aria-label="Clear selection"
            >
              <Icon name="XMarkIcon" size={12} />
            </span>
          )}
          <Icon
            name="ChevronDownIcon"
            size={14}
            className={`text-muted-foreground transition-transform duration-150 ${
              open ? 'rotate-180 text-primary' : ''
            }`}
          />
        </div>
      </button>

      {/* Error text */}
      {error && <p className="error-text" role="alert">{error}</p>}

      {/* Dropdown Menu */}
      {open && (
        <div
          className="absolute left-0 right-0 z-[70] mt-1 bg-card rounded-xl border border-border shadow-dropdown p-1 fade-in max-h-72 overflow-hidden flex flex-col min-w-[200px]"
          role="presentation"
        >
          {/* Search Header */}
          {searchable && (
            <div className="p-1 border-b border-border/60 mb-0.5">
              <div className="relative">
                <Icon
                  name="MagnifyingGlassIcon"
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setActiveIndex(-1); }}
                  onKeyDown={handleKeyDown}
                  className="w-full h-8 pl-7 pr-2 text-xs rounded-lg border border-border bg-muted/30 focus:outline-none focus:border-primary focus:bg-card text-foreground"
                  aria-label="Search options"
                />
              </div>
            </div>
          )}

          {/* Add New button */}
          {onAddNew && (
            <div className="p-0.5 border-b border-border/50 mb-0.5">
              <button
                type="button"
                onClick={handleAddNewClick}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold text-primary hover:bg-primary/8 transition-colors text-left cursor-pointer"
              >
                <Icon name="PlusCircleIcon" size={15} className="text-primary flex-shrink-0" />
                <span className="truncate">{addNewLabel || '+ Add New Record'}</span>
              </button>
            </div>
          )}

          {/* Options List */}
          <div ref={listRef} className="overflow-y-auto scrollbar-thin space-y-0.5 max-h-52 pr-0.5" role="listbox" id={listboxId}>
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground space-y-2">
                <p>No matching records</p>
                {onAddNew && search.trim() && (
                  <button
                    type="button"
                    onClick={handleAddNewClick}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline cursor-pointer"
                  >
                    <Icon name="PlusCircleIcon" size={13} />
                    {addNewLabel || `+ Add "${search}"`}
                  </button>
                )}
              </div>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === value;
                const isActive = index === activeIndex;
                return (
                  <button
                    key={option.value}
                    id={`${listboxId}-opt-${index}`}
                    data-index={index}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled}
                    disabled={option.disabled}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                      isActive
                        ? 'bg-primary/8 text-foreground'
                        : isSelected
                        ? 'bg-primary/8 text-primary font-semibold'
                        : 'text-foreground hover:bg-muted font-normal'
                    } ${option.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {option.icon && (
                        <Icon name={option.icon as any} size={14} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate leading-tight font-medium">{option.label}</p>
                        {option.sublabel && (
                          <p className="text-3xs text-muted-foreground truncate leading-tight mt-0.5">{option.sublabel}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {option.badge && (
                        <span className="text-3xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">
                          {option.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Icon name="CheckIcon" size={13} className="text-primary stroke-[2.5]" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { CustomSelect as SearchableDynamicSelect };
