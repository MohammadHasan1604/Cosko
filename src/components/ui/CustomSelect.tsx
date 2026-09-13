'use client';

import React, { useState, useRef, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  icon?: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  searchable?: boolean;
  size?: 'sm' | 'md';
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select an option...',
  label,
  disabled = false,
  className = '',
  searchable = false,
  size = 'md',
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

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
    }
  }, [open, searchable]);

  // Keyboard navigation (Escape to close)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (open && e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const filteredOptions = searchable && search.trim()
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase()) ||
        opt.sublabel?.toLowerCase().includes(search.toLowerCase()) ||
        opt.value.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  const heightClass = size === 'sm' ? 'h-8 text-xs' : 'h-[38px] text-xs sm:text-sm';

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="label-text">{label}</label>}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-foreground font-medium transition-all duration-150 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${heightClass} ${
          open ? 'border-primary ring-2 ring-primary/20' : ''
        }`}
      >
        <span className="truncate text-left flex items-center gap-1.5 min-w-0">
          {selectedOption?.icon && (
            <Icon name={selectedOption.icon as any} size={14} className="text-muted-foreground flex-shrink-0" />
          )}
          <span className={selectedOption ? 'text-foreground font-medium truncate' : 'text-muted-foreground truncate'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="text-3xs bg-primary/10 text-primary font-bold px-1.5 py-0.2 rounded-full">
              {selectedOption.badge}
            </span>
          )}
        </span>

        <Icon
          name="ChevronDownIcon"
          size={14}
          className={`text-muted-foreground flex-shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180 text-primary' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 bg-card rounded-xl border border-border shadow-dropdown p-1.5 fade-in max-h-60 overflow-hidden flex flex-col min-w-[200px]">
          {searchable && (
            <div className="p-1.5 border-b border-border/80 mb-1">
              <div className="relative">
                <Icon
                  name="MagnifyingGlassIcon"
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search options..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-7 pl-7 pr-2 text-xs rounded-md border border-border bg-muted/40 focus:outline-none focus:border-primary focus:bg-card"
                />
              </div>
            </div>
          )}

          <div className="overflow-y-auto scrollbar-thin space-y-0.5 max-h-48 pr-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                No matching options
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-foreground hover:bg-muted font-normal'
                    } ${option.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {option.icon && (
                        <Icon name={option.icon as any} size={14} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate leading-tight">{option.label}</p>
                        {option.sublabel && (
                          <p className="text-3xs text-muted-foreground truncate leading-tight mt-0.5">{option.sublabel}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {option.badge && (
                        <span className="text-3xs bg-muted text-muted-foreground px-1.5 py-0.2 rounded font-medium">
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
