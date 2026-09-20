'use client';
import React from 'react';
import VendorFormModal from '@/components/forms/VendorFormModal';

interface QuickVendorModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (vendorName: string) => void;
}

export default function QuickVendorModal({ open, onClose, onSuccess }: QuickVendorModalProps) {
  return (
    <VendorFormModal
      open={open}
      onClose={onClose}
      onSuccess={(name) => {
        if (onSuccess) onSuccess(name);
      }}
    />
  );
}
