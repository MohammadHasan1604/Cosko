'use client';

import React, { useEffect, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function BottomSheet({ open, onClose, title, children, footer }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="sheet-overlay" onClick={() => onCloseRef.current?.()} aria-hidden="true" />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="sheet-content"
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Bottom sheet'}
      >
        {/* Handle */}
        <div className="sheet-handle" />

        {/* Header */}
        {title && (
          <div className="sheet-header">
            <h3 className="text-sm font-bold text-foreground">{title}</h3>
            <button
              onClick={() => onCloseRef.current?.()}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label="Close"
            >
              <Icon name="XMarkIcon" size={16} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="sheet-body">{children}</div>

        {/* Footer */}
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </>
  );
}
