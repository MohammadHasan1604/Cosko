'use client';
import React from 'react';
import Modal from './Modal';
import Icon from '@/components/ui/AppIcon';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning';
  loading?: boolean;
}

export default function ConfirmModal({
  open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger', loading = false
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="" size="sm">
      <div className="flex flex-col items-center text-center gap-4 py-2">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${variant === 'danger' ? 'bg-danger/10' : 'bg-warning/10'}`}>
          <Icon name="ExclamationTriangleIcon" size={24} className={variant === 'danger' ? 'text-danger' : 'text-warning'} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1.5">{message}</p>
        </div>
        <div className="flex gap-3 w-full">
          <button onClick={onClose} className="btn-secondary flex-1" disabled={loading}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 active:scale-95 disabled:opacity-60 ${variant === 'danger' ? 'bg-danger text-white hover:opacity-90' : 'bg-warning text-white hover:opacity-90'}`}
          >
            {loading && (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 22 6.477 22 12h-4z" />
              </svg>
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}