'use client';

import React, { memo, useMemo } from 'react';
import AppIcon from './AppIcon';
import AppImage from './AppImage';
import { useApp } from '@/context/AppContext';

import CoskoLogo from './CoskoLogo';

interface AppLogoProps {
  src?: string;
  iconName?: string;
  size?: number;
  variant?: 'default' | 'dark-bg' | 'blue-bg' | 'mono-white';
  showText?: boolean;
  className?: string;
  onClick?: () => void;
}

const AppLogo = memo(function AppLogo({
  src,
  size = 32,
  variant = 'default',
  showText = false,
  className = '',
  onClick,
}: AppLogoProps) {
  const { branding } = useApp();

  const activeSrc = src || branding.logoUrl;

  const containerClassName = useMemo(() => {
    const classes = ['flex items-center justify-center'];
    if (onClick) classes.push('cursor-pointer hover:opacity-80 transition-opacity');
    if (className) classes.push(className);
    return classes.join(' ');
  }, [onClick, className]);

  return (
    <div className={containerClassName} onClick={onClick}>
      {activeSrc ? (
        <img
          src={activeSrc}
          alt={branding.appName || 'App Logo'}
          style={{ height: size, objectFit: 'contain' }}
          className="rounded-lg flex-shrink-0"
        />
      ) : (
        <CoskoLogo size={size} variant={variant} showText={showText} />
      )}
    </div>
  );
});

export default AppLogo;
