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
 * Strict adherence to official COSKO Typography & Color Guidelines PDF.
 * Wordmark: COSK + Custom circular 'O' containing downward chevron (v).
 */
export const CoskoLogo = memo(function CoskoLogo({
  size = 32,
  variant = 'default',
  showText = true,
  className = '',
}: CoskoLogoProps) {
  // Color specifications from PDF Brand Guideline
  // Air Force Blue: #002E86 | Blue Cola: #009ADF | White: #FFFFFF
  let textColor = '#002E86';
  let iconCircleColor = '#009ADF';
  let iconChevronColor = '#FFFFFF';

  if (variant === 'dark-bg') {
    textColor = '#FFFFFF';
    iconCircleColor = '#009ADF';
    iconChevronColor = '#FFFFFF';
  } else if (variant === 'blue-bg' || variant === 'mono-white') {
    textColor = '#FFFFFF';
    iconCircleColor = '#FFFFFF';
    iconChevronColor = variant === 'blue-bg' ? '#009ADF' : '#00205D';
  }

  // Calculate proportional dimensions
  const scale = size / 32;
  const logoWidth = showText ? Math.round(135 * scale) : Math.round(32 * scale);
  const logoHeight = Math.round(32 * scale);

  return (
    <div className={`inline-flex items-center gap-1.5 flex-shrink-0 select-none ${className}`} style={{ height: logoHeight }}>
      {showText ? (
        <svg
          width={logoWidth}
          height={logoHeight}
          viewBox="0 0 135 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="COSKO Logo"
          className="flex-shrink-0"
        >
          {/* C */}
          <path
            d="M 23 7.5 C 17.5 7.5 13 11.5 13 16 C 13 20.5 17.5 24.5 23 24.5 C 27 24.5 30 22.5 31.5 20.5 L 27.5 18 C 26.5 19.3 25 20.5 23 20.5 C 20.2 20.5 17.5 18.5 17.5 16 C 17.5 13.5 20.2 11.5 23 11.5 C 25 11.5 26.5 12.7 27.5 14 L 31.5 11.5 C 30 9.5 27 7.5 23 7.5 Z"
            fill={textColor}
          />

          {/* O (first letter) */}
          <path
            d="M 46 7.5 C 40 7.5 35 11.3 35 16 C 35 20.7 40 24.5 46 24.5 C 52 24.5 57 20.7 57 16 C 57 11.3 52 7.5 46 7.5 Z M 46 11.5 C 49.5 11.5 52.5 13.5 52.5 16 C 52.5 18.5 49.5 20.5 46 20.5 C 42.5 20.5 39.5 18.5 39.5 16 C 39.5 13.5 42.5 11.5 46 11.5 Z"
            fill={textColor}
          />

          {/* S */}
          <path
            d="M 68 12.5 C 66.5 11.5 64.8 11.2 63 11.2 C 61 11.2 59.5 12 59.5 13.2 C 59.5 14.5 61 15 63.5 15.5 C 67 16.2 70 17.2 70 20.2 C 70 23.2 66.8 24.8 62.5 24.8 C 59.5 24.8 56.8 23.8 55 22.2 L 57.2 18.8 C 58.7 20.2 60.8 21 62.8 21 C 64.8 21 66 20.2 66 19 C 66 17.8 64.5 17.2 62 16.7 C 58.5 16 55.5 15 55.5 12 C 55.5 9 58.8 7.5 63 7.5 C 65.8 7.5 68.2 8.3 70 9.8 L 68 12.5 Z"
            fill={textColor}
          />

          {/* K */}
          <path
            d="M 75 8 H 79.5 V 14.2 L 85.5 8 H 91.5 L 84 15.2 L 92 24 H 86 L 80.5 17.5 L 79.5 18.5 V 24 H 75 V 8 Z"
            fill={textColor}
          />

          {/* O Branded Icon Treatment (Circle ring + inner circle + downward chevron) */}
          <g transform="translate(98, 0)">
            <circle cx="16" cy="16" r="14" fill="none" stroke={iconCircleColor} strokeWidth="3.5" />
            <circle cx="16" cy="16" r="10.5" fill={iconCircleColor} />
            {/* Downward Chevron (v) */}
            <path
              d="M 11.5 13.5 L 16 18 L 20.5 13.5"
              stroke={iconChevronColor}
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      ) : (
        <svg
          width={logoHeight}
          height={logoHeight}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="COSKO Icon"
          className="flex-shrink-0"
        >
          <circle cx="16" cy="16" r="14" fill="none" stroke={iconCircleColor} strokeWidth="3.5" />
          <circle cx="16" cy="16" r="10.5" fill={iconCircleColor} />
          <path
            d="M 11.5 13.5 L 16 18 L 20.5 13.5"
            stroke={iconChevronColor}
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
});

export default CoskoLogo;
