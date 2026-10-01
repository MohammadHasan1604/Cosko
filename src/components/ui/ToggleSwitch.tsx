'use client';
import React, { useId } from 'react';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  sublabel?: string;
  onText?: string;
  offText?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'success' | 'brand';
  disabled?: boolean;
  loading?: boolean;
  id?: string;
  name?: string;
  className?: string;
  title?: string;
  'aria-label'?: string;
}

export default function ToggleSwitch({
  checked,
  onChange,
  label,
  sublabel,
  onText = 'ON',
  offText = 'OFF',
  size = 'md',
  variant = 'success',
  disabled = false,
  loading = false,
  id,
  name,
  className = '',
  title,
  'aria-label': ariaLabel,
}: ToggleSwitchProps) {
  const generatedId = useId();
  const switchId = id || generatedId;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || loading) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  // Precisely proportioned dimensions ensuring zero text clipping & comfortable thumb clearance
  const sizeConfig = {
    sm: {
      container: 'w-16 h-7',
      thumb: 'w-5 h-5',
      thumbTranslate: 'translate-x-9', // 36px offset
      thumbRest: 'translate-x-1', // 4px offset
      textChecked: 'left-2.5 text-[10px]',
      textUnchecked: 'right-2.5 text-[10px]',
      spinner: 'w-3 h-3',
    },
    md: {
      container: 'w-20 h-8',
      thumb: 'w-6 h-6',
      thumbTranslate: 'translate-x-12', // 48px offset
      thumbRest: 'translate-x-1',
      textChecked: 'left-3 text-2xs',
      textUnchecked: 'right-3 text-2xs',
      spinner: 'w-3.5 h-3.5',
    },
    lg: {
      container: 'w-24 h-9',
      thumb: 'w-7 h-7',
      thumbTranslate: 'translate-x-[60px]',
      thumbRest: 'translate-x-1',
      textChecked: 'left-3.5 text-xs',
      textUnchecked: 'right-3.5 text-xs',
      spinner: 'w-4 h-4',
    },
  }[size];

  // Active track color
  const activeBg =
    variant === 'brand'
      ? 'bg-[#002E86] dark:bg-[#009ADF] border-[#002E86] dark:border-[#009ADF] text-white shadow-xs hover:brightness-105'
      : 'bg-emerald-600 dark:bg-emerald-500 border-emerald-600 dark:border-emerald-500 text-white shadow-xs hover:bg-emerald-500 dark:hover:bg-emerald-400';

  const inactiveBg =
    'bg-slate-200 dark:bg-slate-700/90 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 shadow-inner hover:bg-slate-300/80 dark:hover:bg-slate-600/90';

  const isInteractive = !disabled && !loading;

  return (
    <div
      className={`inline-flex items-center justify-between gap-3 flex-shrink-0 select-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : loading ? 'cursor-wait' : 'cursor-pointer'
      } ${className}`}
      title={title}
    >
      {(label || sublabel) && (
        <label
          htmlFor={switchId}
          className={`select-none text-left ${isInteractive ? 'cursor-pointer' : ''}`}
        >
          {label && <p className="text-xs font-bold text-foreground leading-tight">{label}</p>}
          {sublabel && (
            <p className="text-2xs text-muted-foreground mt-0.5 leading-tight">{sublabel}</p>
          )}
        </label>
      )}

      <button
        type="button"
        id={switchId}
        name={name}
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled}
        aria-label={ariaLabel || label || (checked ? onText : offText)}
        disabled={disabled || loading}
        onClick={(e) => {
          e.stopPropagation();
          if (isInteractive) {
            onChange(!checked);
          }
        }}
        onKeyDown={handleKeyDown}
        className={`relative inline-flex items-center flex-shrink-0 rounded-full transition-all duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 border ${
          sizeConfig.container
        } ${checked ? activeBg : inactiveBg} ${
          isInteractive ? 'cursor-pointer active:scale-95' : 'cursor-not-allowed'
        }`}
      >
        {/* Crisp ON / OFF Indicator Label Inside Track */}
        <span
          className={`absolute select-none font-mono font-black tracking-wider uppercase transition-opacity duration-150 whitespace-nowrap pointer-events-none ${
            checked
              ? `${sizeConfig.textChecked} text-white drop-shadow-xs`
              : `${sizeConfig.textUnchecked} text-slate-700 dark:text-slate-200`
          }`}
        >
          {checked ? (onText.length > 3 ? 'ON' : onText) : offText.length > 3 ? 'OFF' : offText}
        </span>

        {/* Crisp Smooth Sliding Thumb */}
        <span
          className={`inline-flex items-center justify-center rounded-full bg-white dark:bg-slate-100 shadow-md border border-slate-300/40 transform transition-transform duration-200 ease-out flex-shrink-0 ${
            sizeConfig.thumb
          } ${checked ? sizeConfig.thumbTranslate : sizeConfig.thumbRest}`}
        >
          {loading && (
            <svg
              className={`animate-spin text-primary ${sizeConfig.spinner}`}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
        </span>
      </button>
    </div>
  );
}
