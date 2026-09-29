'use client';

import React, { useMemo } from 'react';
import CustomSelect, { SelectOption } from '@/components/ui/CustomSelect';

export interface PaymentMethodSelectProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  layout?: 'dropdown' | 'pills';
  allowAddNew?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  modalZIndex?: number;
}

// Requirement 12: Across POS and other applicable payment forms show exactly: Cash, UPI, Other
const EXACT_PAYMENT_METHODS = [
  { name: 'Cash', label: 'Cash', sublabel: 'Cash Currency Payment', badge: 'Cash' },
  { name: 'UPI', label: 'UPI', sublabel: 'UPI QR / Digital Payment', badge: 'Digital' },
  { name: 'Other', label: 'Other', sublabel: 'Other Payment Method', badge: 'Other' },
];

export default function PaymentMethodSelect({
  value,
  onChange,
  label,
  required = false,
  disabled = false,
  placeholder = 'Select Payment Method',
  searchPlaceholder = 'Search payment methods...',
  layout = 'dropdown',
  size = 'md',
  className = '',
}: PaymentMethodSelectProps) {
  // Generate options for the exact 3 payment methods
  const selectOptions: SelectOption[] = useMemo(() => {
    const list: SelectOption[] = EXACT_PAYMENT_METHODS.map((pm) => ({
      value: pm.name,
      label: pm.label,
      sublabel: pm.sublabel,
      badge: pm.badge,
    }));

    // Data Integrity: If current value is historical/different (e.g. Card, Net Banking), preserve it!
    if (value && !list.some((pm) => pm.value.toLowerCase() === value.toLowerCase())) {
      list.unshift({
        value,
        label: value,
        sublabel: 'Historical Instrument',
        badge: 'Historical',
      });
    }

    return list;
  }, [value]);

  if (layout === 'pills') {
    return (
      <div className={`space-y-1.5 ${className}`}>
        {label && (
          <label className="text-3xs font-bold uppercase tracking-wider text-muted-foreground block">
            {label} {required && <span className="text-danger">*</span>}
          </label>
        )}

        <div className="grid grid-cols-3 gap-2">
          {EXACT_PAYMENT_METHODS.map((m) => {
            const isSelected = value?.toLowerCase() === m.name.toLowerCase();
            return (
              <button
                key={`pm-pill-${m.name}`}
                type="button"
                disabled={disabled}
                onClick={() => onChange(m.name)}
                className={`h-11 px-3 rounded-xl text-xs font-bold border transition-all duration-150 flex items-center justify-center cursor-pointer min-h-[44px] ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20'
                    : 'bg-muted/30 text-foreground border-border/80 hover:border-border hover:bg-muted/60'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {m.name}
              </button>
            );
          })}

          {/* Historical fallback pill if currently selected */}
          {value &&
            !EXACT_PAYMENT_METHODS.some((m) => m.name.toLowerCase() === value.toLowerCase()) && (
              <button
                type="button"
                disabled={disabled}
                className="h-11 px-3 rounded-xl text-xs font-bold border border-warning/50 bg-warning/10 text-warning flex items-center justify-center gap-1.5 col-span-3 min-h-[44px]"
              >
                <span>{value}</span>
                <span className="text-4xs px-1.5 py-0.5 rounded bg-warning/20 font-mono">
                  Historical
                </span>
              </button>
            )}
        </div>
      </div>
    );
  }

  // Default: Dropdown layout with responsive BottomSheet on mobile
  return (
    <CustomSelect
      options={selectOptions}
      value={value}
      onChange={onChange}
      label={label}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      searchable={false}
      size={size}
      className={className}
    />
  );
}
