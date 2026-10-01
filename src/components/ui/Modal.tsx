'use client';
import React, { useEffect, useRef, useId } from 'react';
import Icon from '@/components/ui/AppIcon';

export type ModalSize =
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | 'full'
  | 'compact'
  | 'standard'
  | 'large-form'
  | 'full-workflow';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  variant?: 'compact' | 'standard' | 'large-form' | 'full-workflow';
  zIndex?: number;
  /** Legacy flag preserved for compatibility; adaptive sizing is applied automatically */
  mobileFullScreen?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement>;
}

const desktopWidthClasses: Record<string, string> = {
  sm: 'md:max-w-md',
  compact: 'md:max-w-md',
  md: 'md:max-w-xl',
  standard: 'md:max-w-xl',
  lg: 'md:max-w-3xl',
  'large-form': 'md:max-w-3xl',
  xl: 'md:max-w-5xl',
  'full-workflow': 'md:max-w-5xl',
  full: 'md:max-w-7xl md:w-[96vw]',
};

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  variant,
  zIndex = 100,
  mobileFullScreen,
  closeOnBackdrop = true,
  closeOnEscape = true,
  initialFocusRef,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const subtitleId = useId();

  // Stable reference to onClose callback to avoid breaking effect dependencies
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const prevOpenRef = useRef(false);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  // Normalize size mode
  const resolvedSize = variant || size;
  const isCompact = resolvedSize === 'sm' || resolvedSize === 'compact';
  const isStandard = resolvedSize === 'md' || resolvedSize === 'standard';
  const isLarge = resolvedSize === 'lg' || resolvedSize === 'large-form';
  const isWorkflow =
    resolvedSize === 'xl' || resolvedSize === 'full-workflow' || resolvedSize === 'full';

  // 1. OPEN / CLOSE LIFECYCLE & ACCESSIBLE FOCUS TRAP INITIALIZATION
  // Runs ONLY when `open` actually transitions false -> true or true -> false.
  // NEVER runs on form keystrokes, parent re-renders, or realtime events.
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;

    if (!wasOpen && open) {
      // Remember previously focused element to restore on close
      previouslyFocusedElementRef.current =
        typeof document !== 'undefined' ? (document.activeElement as HTMLElement) : null;

      // Lock body scroll while open
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'hidden';
      }

      // Initial focus management
      const timer = requestAnimationFrame(() => {
        if (!dialogRef.current) return;

        // If an element inside the dialog is already focused (e.g. via autoFocus), DO NOT override it!
        if (
          document.activeElement &&
          dialogRef.current.contains(document.activeElement) &&
          document.activeElement !== dialogRef.current
        ) {
          return;
        }

        // If initialFocusRef is explicitly provided, focus that element
        if (initialFocusRef?.current) {
          initialFocusRef.current.focus({ preventScroll: true });
          return;
        }

        // Otherwise focus the first interactive input / button
        const focusable = dialogRef.current.querySelector<HTMLElement>(
          'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not([aria-label="Close dialog"]), [tabindex]:not([tabindex="-1"]), a[href]'
        );

        if (focusable) {
          focusable.focus({ preventScroll: true });
        } else {
          dialogRef.current.focus({ preventScroll: true });
        }
      });

      return () => cancelAnimationFrame(timer);
    } else if (wasOpen && !open) {
      // Modal closed: unlock body scroll & restore previous focus
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
      if (
        previouslyFocusedElementRef.current &&
        typeof previouslyFocusedElementRef.current.focus === 'function'
      ) {
        try {
          previouslyFocusedElementRef.current.focus({ preventScroll: true });
        } catch {
          // Element may have unmounted
        }
      }
    }
  }, [open, initialFocusRef]);

  // Cleanup scroll lock on unmount
  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  }, []);

  // 2. KEYBOARD LISTENERS: ESCAPE KEY & TAB FOCUS TRAP
  // Stable listener: NEVER re-focuses the dialog container during typing
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key to close
      if (closeOnEscape && e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }

      // Tab navigation trap
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href]'
          )
        ).filter((el) => el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0);

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (
            document.activeElement === first ||
            !dialogRef.current.contains(document.activeElement)
          ) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (
            document.activeElement === last ||
            !dialogRef.current.contains(document.activeElement)
          ) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open, closeOnEscape]);

  if (!open) return null;

  // Responsive mobile container styling:
  // - Compact: Content-sized bottom card (max 85dvh), no empty wasted screen space
  // - Standard: Adaptive height bottom sheet (up to 92dvh)
  // - Large: Near full viewport sheet (up to 95dvh)
  // - Workflow: Near-full / full-screen workflow
  let mobileClasses = 'rounded-t-2xl md:rounded-2xl max-h-[85dvh]';
  if (isStandard) {
    mobileClasses = 'rounded-t-2xl md:rounded-2xl max-h-[92dvh]';
  } else if (isLarge) {
    mobileClasses = 'rounded-t-2xl md:rounded-2xl max-h-[calc(100dvh-12px)]';
  } else if (isWorkflow || mobileFullScreen === true) {
    mobileClasses =
      'rounded-t-2xl md:rounded-2xl h-full md:h-auto max-h-[calc(100dvh-8px)] md:max-h-[92vh]';
  }

  const widthClass = desktopWidthClasses[resolvedSize] || 'md:max-w-xl';

  return (
    <div
      ref={overlayRef}
      style={{ zIndex }}
      className="fixed inset-0 flex items-end md:items-center justify-center overflow-hidden p-0 md:p-4"
      onClick={(e) => {
        if (closeOnBackdrop && e.target === overlayRef.current) {
          onCloseRef.current?.();
        }
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] animate-backdrop-in" />

      {/* Dialog Container */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={subtitle ? subtitleId : undefined}
        className={`relative bg-card flex flex-col overflow-hidden focus:outline-none shadow-modal border-t md:border border-border/80 w-full ${widthClass} ${mobileClasses} md:my-auto md:max-h-[90vh] animate-slide-up md:animate-scale-in`}
        style={{
          // Dynamic visual viewport safe sizing
          maxHeight: isCompact
            ? 'min(85dvh, 85vh)'
            : isStandard
              ? 'min(92dvh, 88vh)'
              : isLarge
                ? 'min(95dvh, 90vh)'
                : 'min(calc(100dvh - 8px), 92vh)',
        }}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-5 md:py-3.5 border-b border-border/70 bg-card sticky top-0 z-10 flex-shrink-0">
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
              type="button"
              onClick={() => onCloseRef.current?.()}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer flex-shrink-0"
              aria-label="Close dialog"
            >
              <Icon name="XMarkIcon" size={16} />
            </button>
          </div>
        )}

        {/* Scrollable Body: Single internal scroll container */}
        <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin px-4 py-4 md:px-5 md:py-5">
          {children}
        </div>

        {/* Sticky Actions / Footer */}
        {footer && (
          <div
            className="border-t border-border/70 px-4 py-3 md:px-5 md:py-3.5 bg-card/95 backdrop-blur-sm sticky bottom-0 z-10 flex-shrink-0"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
