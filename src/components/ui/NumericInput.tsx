'use client';

import React, { forwardRef } from 'react';

export interface NumericInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> {
  value: number | string | null | undefined;
  onChange: (value: number | '') => void;
  allowDecimals?: boolean;
  allowNegative?: boolean;
  prefix?: string;
  suffix?: string;
  containerClassName?: string;
}

/**
 * Enterprise NumericInput Component
 * - Displays completely blank when value is null, undefined, or empty string ''
 * - Preserves and displays '0' ONLY when value is explicitly 0 (number) or '0' (string)
 * - On input change, if input is cleared, emits '' (NEVER silently converts to 0)
 * - If valid number is entered, emits parsed number
 */
const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  (
    {
      value,
      onChange,
      allowDecimals = true,
      allowNegative = false,
      prefix,
      suffix,
      containerClassName = '',
      className = '',
      min,
      max,
      step,
      placeholder,
      disabled,
      required,
      ...restProps
    },
    ref
  ) => {
    // Normalize display value
    const displayValue = React.useMemo(() => {
      if (value === null || value === undefined || value === '') {
        return '';
      }
      if (typeof value === 'number') {
        if (isNaN(value)) return '';
        return String(value);
      }
      return String(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawVal = e.target.value;

      if (rawVal === '') {
        onChange('');
        return;
      }

      // Allow user to type '-' if negative numbers are allowed
      if (allowNegative && rawVal === '-') {
        onChange('' as any);
        return;
      }

      const parsed = allowDecimals ? parseFloat(rawVal) : parseInt(rawVal, 10);
      if (!isNaN(parsed)) {
        onChange(parsed);
      } else {
        onChange('');
      }
    };

    const inputEl = (
      <input
        ref={ref}
        type="number"
        value={displayValue}
        onChange={handleChange}
        min={min}
        max={max}
        step={step ?? (allowDecimals ? '0.01' : '1')}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        inputMode={allowDecimals ? 'decimal' : 'numeric'}
        className={`input-field font-tabular ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-8' : ''} ${className}`}
        {...restProps}
      />
    );

    if (!prefix && !suffix) {
      return inputEl;
    }

    return (
      <div className={`relative flex items-center ${containerClassName}`}>
        {prefix && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-semibold pointer-events-none select-none">
            {prefix}
          </span>
        )}
        {inputEl}
        {suffix && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-semibold pointer-events-none select-none">
            {suffix}
          </span>
        )}
      </div>
    );
  }
);

NumericInput.displayName = 'NumericInput';

export default NumericInput;
