'use client';

import React, { memo, useMemo } from 'react';
import AppIcon from './AppIcon';
import AppImage from './AppImage';
import { useApp } from '@/context/AppContext';

interface AppLogoProps {
  src?: string; // Optional override image source
  iconName?: string; // Icon name when no image
  size?: number; // Size for icon/image
  className?: string; // Additional classes
  onClick?: () => void; // Click handler
}

const AppLogo = memo(function AppLogo({
  src,
  iconName = 'SparklesIcon',
  size = 32,
  className = '',
  onClick,
}: AppLogoProps) {
  const { branding } = useApp();

  // Determine active logo source: explicit prop > branding.logoUrl > null
  const activeSrc = src || branding.logoUrl;

  const containerClassName = useMemo(() => {
    const classes = ['flex items-center justify-center'];
    if (onClick) classes.push('cursor-pointer hover:opacity-80 transition-opacity');
    if (className) classes.push(className);
    return classes.join(' ');
  }, [onClick, className]);

  return (
    <div className={containerClassName} onClick={onClick} style={{ width: size, height: size }}>
      {activeSrc ? (
        <img
          src={activeSrc}
          alt={branding.appName || 'App Logo'}
          style={{ width: size, height: size, objectFit: 'contain' }}
          className="rounded-lg flex-shrink-0"
        />
      ) : (
        <div
          className="gradient-primary text-white flex items-center justify-center rounded-xl font-extrabold shadow-sm flex-shrink-0"
          style={{ width: size, height: size, fontSize: Math.max(12, size * 0.45) }}
        >
          {branding.appName ? branding.appName.substring(0, 2).toUpperCase() : 'CO'}
        </div>
      )}
    </div>
  );
});

export default AppLogo;
