'use client';
import React, { useEffect, useRef, useCallback, useId } from 'react';
import Icon from '@/components/ui/AppIcon';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  zIndex?: number;
  /** On mobile (<768px), render as full-screen dialog instead of centered modal */
  mobileFullScreen?: boolean;
}

const sizeClasses: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-5xl',
};

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  zIndex = 100,
  mobileFullScreen = true,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const subtitleId = useId();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  // Focus trap and scroll lock
  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      // Focus the dialog
      requestAnimationFrame(() => {
        dialogRef.current?.focus();
      });
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      style={{ zIndex }}
      className="fixed inset-0 flex items-end md:items-center justify-center overflow-hidden"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-backdrop-in" />

      {/* Dialog */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        className={`relative bg-card flex flex-col overflow-hidden focus:outline-none ${
          mobileFullScreen
            ? `w-full h-full md:h-auto md:rounded-2xl md:shadow-modal md:border md:border-border/80 md:mx-4 md:my-6 md:max-h-[88vh] md:w-full ${sizeClasses[size]} animate-slide-up md:animate-scale-in`
            : `rounded-2xl shadow-modal border border-border/80 w-full max-w-[calc(100vw-24px)] ${sizeClasses[size]} animate-scale-in mx-3 my-3 max-h-[calc(100vh-24px)] md:max-h-[88vh]`
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-5 md:py-3.5 border-b border-border/60 bg-card flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-sm md:text-base font-bold text-foreground tracking-tight truncate"
            >
              {title}
            </h2>
            {subtitle && (
              <p
                id={subtitleId}
                className="text-xs text-muted-foreground mt-0.5 leading-normal truncate"
              >
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer flex-shrink-0"
            aria-label="Close dialog"
          >
            <Icon name="XMarkIcon" size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 md:px-5 md:py-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="border-t border-border/60 px-4 py-3 md:px-5 md:py-3.5 bg-muted/15 flex-shrink-0"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
