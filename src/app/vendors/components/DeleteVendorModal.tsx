'use client';

import React from 'react';
import Modal from '@/components/ui/Modal';
import Icon from '@/components/ui/AppIcon';
import { Vendor } from '@/context/AppContext';

interface DeleteVendorModalProps {
  vendor: Vendor | null;
  onClose: () => void;
  onDelete: (id: string, hard: boolean) => Promise<void>;
  currentUser: any;
}

export const DeleteVendorModal: React.FC<DeleteVendorModalProps> = ({
  vendor,
  onClose,
  onDelete,
  currentUser,
}) => {
  if (!vendor) return null;

  const poCount = (vendor as any).totalBillsCount || (vendor.outstandingPayable > 0 ? 1 : 0);

  return (
    <Modal
      open={!!vendor}
      onClose={onClose}
      title={`Archive / Delete "${vendor.name}"`}
      subtitle="Relational validation against purchase orders and financial history"
      size="md"
    >
      <div className="space-y-4 py-2 text-xs">
        <div
          className={`p-4 rounded-xl border ${
            poCount > 0
              ? 'bg-warning/10 border-warning/30 text-foreground'
              : 'bg-muted/40 border-border text-foreground'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <Icon
              name={poCount > 0 ? 'ExclamationTriangleIcon' : 'InformationCircleIcon'}
              size={18}
              className={
                poCount > 0 ? 'text-warning shrink-0 mt-0.5' : 'text-primary shrink-0 mt-0.5'
              }
            />
            <div>
              <p className="font-bold text-sm">
                {poCount > 0
                  ? 'Linked Procurement & Financial Records Found'
                  : 'Unused Supplier Profile'}
              </p>
              <p className="text-muted-foreground mt-1">
                {poCount > 0
                  ? `This vendor has purchase bills or an outstanding balance of ₹${vendor.outstandingPayable.toLocaleString(
                      'en-IN'
                    )}. To protect warehouse inventory ledgers, tax records, and accounting history, it will be safely Archived.`
                  : `This vendor has no linked purchase orders. You can safely archive it or permanently delete it.`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <button onClick={onClose} className="btn-secondary text-xs cursor-pointer">
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              await onDelete(vendor.id, false);
              onClose();
            }}
            className="btn-primary bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 cursor-pointer"
          >
            Safe Archive
          </button>
          {poCount === 0 && currentUser?.role === 'Super Admin' && (
            <button
              type="button"
              onClick={async () => {
                await onDelete(vendor.id, true);
                onClose();
              }}
              className="btn-danger text-xs font-bold px-4 cursor-pointer"
            >
              Permanent Delete
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
