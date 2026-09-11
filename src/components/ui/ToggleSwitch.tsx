'use client';
import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  sublabel?: string;
  onText?: string;
  offText?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'success' | 'brand';
  disabled?: boolean;
  id?: string;
  className?: string;
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
  id,
  className = '',
}: ToggleSwitchProps) {
  const switchId = id || `toggle-${Math.random().toString(36).substring(2, 9)}`;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  // Dimensions based on size for optimal proportion, touch target, and zero text clipping
  const sizeConfig = {
    sm: {
      container: 'w-14 h-7',
      thumb: 'w-5 h-5',
      thumbTranslate: 'translate-x-7',
      thumbRest: 'translate-x-1',
      textChecked: 'left-2 text-[10px]',
      textUnchecked: 'right-2 text-[10px]',
    },
    md: {
      container: 'w-16 h-8',
      thumb: 'w-6 h-6',
      thumbTranslate: 'translate-x-8',
      thumbRest: 'translate-x-1',
      textChecked: 'left-2 text-2xs',
      textUnchecked: 'right-2 text-2xs',
    },
    lg: {
      container: 'w-20 h-10',
      thumb: 'w-8 h-8',
      thumbTranslate: 'translate-x-10',
      thumbRest: 'translate-x-1',
      textChecked: 'left-2.5 text-xs',
      textUnchecked: 'right-2.5 text-xs',
    },
  }[size];

  // Active color styling using official COSKO palette
  const activeBg =
    variant === 'brand'
      ? 'bg-[#002E86] dark:bg-[#009ADF] border-[#002E86] dark:border-[#009ADF] text-white shadow-sm'
      : 'bg-emerald-600 dark:bg-emerald-500 border-emerald-700/80 dark:border-emerald-400 text-white shadow-sm';

  return (
    <div className={`inline-flex items-center justify-between gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
      {(label || sublabel) && (
        <label htmlFor={switchId} className="cursor-pointer select-none text-left">
          {label && <p className="text-xs font-bold text-foreground leading-tight">{label}</p>}
          {sublabel && <p className="text-2xs text-muted-foreground mt-0.5 leading-tight">{sublabel}</p>}
        </label>
      )}

      <button
        type="button"
        id={switchId}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        onKeyDown={handleKeyDown}
        className={`relative inline-flex items-center flex-shrink-0 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 border select-none ${
          sizeConfig.container
        } ${
          checked
            ? activeBg
            : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 shadow-inner'
        }`}
      >
        {/* Label Text Inside Switch Track */}
        <span
          className={`absolute select-none font-black tracking-wider uppercase transition-opacity duration-200 ${
            checked
              ? `${sizeConfig.textChecked} text-white`
              : `${sizeConfig.textUnchecked} text-slate-700 dark:text-slate-200`
          }`}
        >
          {checked ? (onText.length > 3 ? 'ON' : onText) : (offText.length > 3 ? 'OFF' : offText)}
        </span>

        {/* Crisp Sliding Thumb */}
        <span
          className={`inline-block rounded-full bg-white shadow-md border border-slate-300/40 transform transition-transform duration-200 ease-in-out flex-shrink-0 ${
            sizeConfig.thumb
          } ${checked ? sizeConfig.thumbTranslate : sizeConfig.thumbRest}`}
        />
      </button>
    </div>
  );
}
