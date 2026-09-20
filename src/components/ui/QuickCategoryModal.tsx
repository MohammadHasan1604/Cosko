'use client';
import React from 'react';
import CategoryFormModal from '@/components/forms/CategoryFormModal';

interface QuickCategoryModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (categoryName: string) => void;
}

export default function QuickCategoryModal({ open, onClose, onSuccess }: QuickCategoryModalProps) {
  return (
    <CategoryFormModal
      open={open}
      onClose={onClose}
      onSuccess={(catName) => {
        if (onSuccess) onSuccess(catName);
      }}
    />
  );
}
