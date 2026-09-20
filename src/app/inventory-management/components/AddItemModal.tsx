'use client';

import React from 'react';
import { InventoryItem } from '@/context/AppContext';
import ProductFormModal from '@/components/forms/ProductFormModal';

interface AddItemModalProps {
  open: boolean;
  onClose: () => void;
  editItem?: InventoryItem | null;
  onSuccess?: (item: InventoryItem) => void;
}

export default function AddItemModal({ open, onClose, editItem, onSuccess }: AddItemModalProps) {
  return (
    <ProductFormModal
      open={open}
      onClose={onClose}
      editItem={editItem}
      onSuccess={onSuccess}
    />
  );
}
