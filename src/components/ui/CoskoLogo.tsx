'use client';

import React, { memo } from 'react';

export interface CoskoLogoProps {
  size?: number; // Total height in px (default 32)
  variant?: 'default' | 'dark-bg' | 'blue-bg' | 'mono-white';
  showText?: boolean;
  className?: string;
}

/**
 * Official COSKO Brand Logo Component
 * Strict adherence to official COSKO Typography & Color Guidelines.
 * Wordmark: COSK (General Sans SemiBold) + Custom Circular Icon containing downward chevron (v).
 */
export const CoskoLogo = memo(function CoskoLogo({
  size = 32,
  variant = 'default',
  showText = true,
  className = '',
}: CoskoLogoProps) {
  // Official Color specifications from User Image & PDF Brand Guideline
  // Air Force Blue: #002E86 | Blue Cola: #009ADF | White: #FFFFFF
  let textColor = '#002E86';
  let iconRingColor = '#009ADF';
  let iconChevronColor = '#009ADF';

  if (variant === 'dark-bg') {
    textColor = '#FFFFFF';
    iconRingColor = '#009ADF';
    iconChevronColor = '#009ADF';
  } else if (variant === 'blue-bg' || variant === 'mono-white') {
    textColor = '#FFFFFF';
    iconRingColor = '#FFFFFF';
    iconChevronColor = '#FFFFFF';
  }

  const fontSize = Math.round(size * 0.78);
  const iconSize = Math.round(size * 0.88);

  return (
    <div className={`inline-flex items-center select-none flex-shrink-0 ${className}`} style={{ height: size }}>
      {showText ? (
        <div className="inline-flex items-center leading-none">
          <span
            className="font-bold tracking-tight font-sans"
            style={{
              color: textColor,
              fontSize: `${fontSize}px`,
              letterSpacing: '-0.025em',
              marginRight: `${Math.round(size * 0.04)}px`,
              lineHeight: 1,
            }}
          >
            COSK
          </span>
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="COSKO Icon"
            className="flex-shrink-0"
          >
            <circle cx="16" cy="16" r="12.8" fill="none" stroke={iconRingColor} strokeWidth="3.6" />
            <path
              d="M 10.5 13.5 L 16 19 L 21.5 13.5"
              stroke={iconChevronColor}
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
      ) : (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="COSKO Icon"
          className="flex-shrink-0"
        >
          <circle cx="16" cy="16" r="12.8" fill="none" stroke={iconRingColor} strokeWidth="3.6" />
          <path
            d="M 10.5 13.5 L 16 19 L 21.5 13.5"
            stroke={iconChevronColor}
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      )}
    </div>
  );
});

export default CoskoLogo;
