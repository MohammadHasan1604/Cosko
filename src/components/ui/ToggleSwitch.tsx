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

  // Dimensions based on size
  const sizeConfig = {
    sm: {
      container: 'w-12 h-6',
      thumb: 'w-4 h-4',
      thumbTranslate: 'translate-x-6',
      text: 'text-[9px]',
    },
    md: {
      container: 'w-16 h-8',
      thumb: 'w-6 h-6',
      thumbTranslate: 'translate-x-8',
      text: 'text-2xs font-extrabold',
    },
    lg: {
      container: 'w-20 h-10',
      thumb: 'w-8 h-8',
      thumbTranslate: 'translate-x-10',
      text: 'text-xs font-black',
    },
  }[size];

  return (
    <div className={`inline-flex items-center justify-between gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
      {(label || sublabel) && (
        <label htmlFor={switchId} className="cursor-pointer select-none text-left">
          {label && <p className="text-xs font-bold text-foreground">{label}</p>}
          {sublabel && <p className="text-2xs text-muted-foreground">{sublabel}</p>}
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
        className={`relative inline-flex items-center flex-shrink-0 p-1 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 border ${
          sizeConfig.container
        } ${
          checked
            ? 'bg-success border-success/80 text-white shadow-xs'
            : 'bg-muted/90 border-border text-muted-foreground'
        }`}
      >
        {/* State Label Text Inside Switch */}
        <span
          className={`absolute select-none tracking-wider uppercase transition-opacity duration-200 ${sizeConfig.text} ${
            checked ? 'left-2 opacity-100 text-white' : 'right-2 opacity-100 text-muted-foreground dark:text-gray-400 font-bold'
          }`}
        >
          {checked ? onText : offText}
        </span>

        {/* Sliding Thumb Indicator */}
        <span
          className={`inline-block rounded-full bg-white dark:bg-card shadow-md transform transition-transform duration-200 ease-in-out flex-shrink-0 ${
            sizeConfig.thumb
          } ${checked ? sizeConfig.thumbTranslate : 'translate-x-0'}`}
        />
      </button>
    </div>
  );
}
