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

  // Calculate proportional dimensions (aspect ratio 135:32)
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
            d="M 22.5 7.5 C 17 7.5 12.5 11.5 12.5 16 C 12.5 20.5 17 24.5 22.5 24.5 C 26.5 24.5 29.5 22.5 31 20.5 L 27 18 C 26 19.3 24.5 20.5 22.5 20.5 C 19.7 20.5 17 18.5 17 16 C 17 13.5 19.7 11.5 22.5 11.5 C 24.5 11.5 26 12.7 27 14 L 31 11.5 C 29.5 9.5 26.5 7.5 22.5 7.5 Z"
            fill={textColor}
          />

          {/* O (first letter) */}
          <path
            d="M 46 7.5 C 40 7.5 35 11.3 35 16 C 35 20.7 40 24.5 46 24.5 C 52 24.5 57 20.7 57 16 C 57 11.3 52 7.5 46 7.5 Z M 46 11.8 C 49.5 11.8 52.2 13.6 52.2 16 C 52.2 18.4 49.5 20.2 46 20.2 C 42.5 20.2 39.8 18.4 39.8 16 C 39.8 13.6 42.5 11.8 46 11.8 Z"
            fill={textColor}
          />

          {/* S */}
          <path
            d="M 67.5 12.5 C 66 11.5 64.3 11.2 62.5 11.2 C 60.5 11.2 59 12 59 13.2 C 59 14.5 60.5 15 63 15.5 C 66.5 16.2 69.5 17.2 69.5 20.2 C 69.5 23.2 66.3 24.8 62 24.8 C 59 24.8 56.3 23.8 54.5 22.2 L 56.7 18.8 C 58.2 20.2 60.3 21 62.3 21 C 64.3 21 65.5 20.2 65.5 19 C 65.5 17.8 64 17.2 61.5 16.7 C 58 16 55 15 55 12 C 55 9 58.3 7.5 62.5 7.5 C 65.3 7.5 67.7 8.3 69.5 9.8 L 67.5 12.5 Z"
            fill={textColor}
          />

          {/* K */}
          <path
            d="M 74.5 8 H 79 V 14.2 L 85 8 H 91 L 83.5 15.2 L 91.5 24 H 85.5 L 80 17.5 L 79 V 24 H 74.5 V 8 Z"
            fill={textColor}
          />

          {/* O Branded Icon Treatment (Cyan Ring + Inner Cyan Downward Chevron) */}
          <g transform="translate(97, 0)">
            <circle cx="16" cy="16" r="13" fill="none" stroke={iconRingColor} strokeWidth="3.8" />
            <path
              d="M 10.5 13.5 L 16 19 L 21.5 13.5"
              stroke={iconChevronColor}
              strokeWidth="3.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
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
          <circle cx="16" cy="16" r="13" fill="none" stroke={iconRingColor} strokeWidth="3.8" />
          <path
            d="M 10.5 13.5 L 16 19 L 21.5 13.5"
            stroke={iconChevronColor}
            strokeWidth="3.6"
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
