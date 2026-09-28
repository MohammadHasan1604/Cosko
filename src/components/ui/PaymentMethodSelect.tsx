'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import CustomSelect, { SelectOption } from '@/components/ui/CustomSelect';
import PaymentMethodModal from '@/components/forms/PaymentMethodModal';
import Icon from '@/components/ui/AppIcon';

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

export default function PaymentMethodSelect({
  value,
  onChange,
  label,
  required = false,
  disabled = false,
  placeholder = 'Select Payment Method',
  searchPlaceholder = 'Search payment methods...',
  layout = 'dropdown',
  allowAddNew = true,
  size = 'md',
  className = '',
  modalZIndex = 1100,
}: PaymentMethodSelectProps) {
  const { paymentMethods } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [initialSearchTerm, setInitialSearchTerm] = useState('');

  // Generate dynamic options from master list
  const { activeMethods, selectOptions } = useMemo(() => {
    // Sort active methods by sortOrder ascending, then name
    const active = paymentMethods
      .filter((pm) => pm.status === 'Active')
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));

    const options: SelectOption[] = active.map((pm) => ({
      value: pm.name,
      label: pm.name,
      sublabel: pm.description || `${pm.type} Instrument`,
      badge: pm.type,
    }));

    // Data Integrity: If current value is set but inactive or not in active methods, preserve it!
    if (value && !active.some((pm) => pm.name.toLowerCase() === value.toLowerCase())) {
      const existingInactive = paymentMethods.find(
        (pm) => pm.name.toLowerCase() === value.toLowerCase()
      );
      options.unshift({
        value,
        label: value,
        sublabel: existingInactive?.description || 'Historical Instrument',
        badge: 'Inactive',
      });
    }

    return { activeMethods: active, selectOptions: options };
  }, [paymentMethods, value]);

  const handleOpenAddModal = (term?: string) => {
    setInitialSearchTerm(term || '');
    setModalOpen(true);
  };

  const handleModalSuccess = (newMethodName: string) => {
    onChange(newMethodName);
    setModalOpen(false);
  };

  if (layout === 'pills') {
    // Pill layout for high-speed POS checkout
    const hasInactiveSelected =
      value && !activeMethods.some((pm) => pm.name.toLowerCase() === value.toLowerCase());

    return (
      <div className={`space-y-1.5 ${className}`}>
        {label && (
          <div className="flex items-center justify-between">
            <label className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">
              {label} {required && <span className="text-danger">*</span>}
            </label>
            {allowAddNew && !disabled && (
              <button
                type="button"
                onClick={() => handleOpenAddModal()}
                className="text-3xs font-bold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Icon name="PlusIcon" size={11} />
                <span>+ Add New</span>
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {activeMethods.map((m) => {
            const isSelected = value?.toLowerCase() === m.name.toLowerCase();
            return (
              <button
                key={`pm-pill-${m.id || m.name}`}
                type="button"
                disabled={disabled}
                onClick={() => onChange(m.name)}
                className={`h-9 px-3 rounded-xl text-xs font-bold border transition-all duration-150 flex items-center justify-center cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-muted/40 text-muted-foreground border-border/80 hover:border-border hover:text-foreground'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {m.name}
              </button>
            );
          })}

          {/* Historical Inactive pill if currently selected */}
          {hasInactiveSelected && (
            <button
              type="button"
              disabled={disabled}
              className="h-9 px-3 rounded-xl text-xs font-bold border border-warning/50 bg-warning/10 text-warning flex items-center gap-1.5"
            >
              <span>{value}</span>
              <span className="text-4xs px-1.5 py-0.2 rounded bg-warning/20 font-mono">
                Inactive
              </span>
            </button>
          )}

          {allowAddNew && !label && !disabled && (
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="h-9 px-2.5 rounded-xl text-xs font-semibold border border-dashed border-border/80 text-muted-foreground hover:text-primary hover:border-primary/50 transition-all flex items-center gap-1 cursor-pointer"
              title="Add New Payment Method"
            >
              <Icon name="PlusIcon" size={12} />
              <span>Add</span>
            </button>
          )}
        </div>

        {/* Embedded Reusable Modal */}
        <PaymentMethodModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          initialName={initialSearchTerm}
          onSuccess={handleModalSuccess}
          zIndex={modalZIndex}
          quickMode
        />
      </div>
    );
  }

  // Default: Dropdown layout with Search & Add New
  return (
    <>
      <CustomSelect
        options={selectOptions}
        value={value}
        onChange={onChange}
        label={label}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        searchable={true}
        size={size}
        className={className}
        addNewLabel={allowAddNew ? '+ Add New Payment Method' : undefined}
        onAddNew={allowAddNew ? (term) => handleOpenAddModal(term) : undefined}
      />

      {/* Embedded Reusable Modal */}
      <PaymentMethodModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialName={initialSearchTerm}
        onSuccess={handleModalSuccess}
        zIndex={modalZIndex}
        quickMode
      />
    </>
  );
}
