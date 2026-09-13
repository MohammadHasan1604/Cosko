'use client';
import React, { useEffect, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 overflow-y-auto backdrop-blur-sm bg-slate-950/45 transition-all"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={`relative bg-card rounded-2xl shadow-modal border border-border/80 w-full max-w-[calc(100vw-24px)] ${sizeClasses[size]} fade-in flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[88vh] my-auto overflow-hidden`}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 sm:px-6 sm:py-4.5 border-b border-border/80 bg-card flex-shrink-0 gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="modal-title" className="text-sm sm:text-base font-bold text-foreground tracking-tight">{title}</h2>
            {subtitle && <p className="text-2xs sm:text-xs text-muted-foreground mt-0.5 leading-normal">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all duration-150 cursor-pointer flex-shrink-0 -mr-1"
            aria-label="Close modal"
          >
            <Icon name="XMarkIcon" size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 sm:px-6 sm:py-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-border/80 px-5 py-3.5 sm:px-6 sm:py-4 bg-muted/20 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}