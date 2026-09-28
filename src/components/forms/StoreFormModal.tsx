'use client';
import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Icon from '@/components/ui/AppIcon';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import { useApp, StoreHub } from '@/context/AppContext';
import { toast } from 'sonner';

interface StoreFormModalProps {
  open: boolean;
  onClose: () => void;
  store?: StoreHub | null;
  onSuccess?: (store: StoreHub) => void;
  zIndex?: number;
}

export default function StoreFormModal({
  open,
  onClose,
  store,
  onSuccess,
  zIndex = 100,
}: StoreFormModalProps) {
  const { storesList, addStoreHub, updateStoreHub, confirmAction } = useApp();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [owner, setOwner] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = Boolean(store);

  useEffect(() => {
    if (open) {
      if (store) {
        setCode(store.code || '');
        setName(store.name || '');
        setCity(store.city || '');
        setAddress(store.address || '');
        setOwner(store.owner || store.manager || '');
        setPhone(store.phone || '');
        setStatus((store.status as any) || 'Active');
      } else {
        setCode('');
        setName('');
        setCity('Bengaluru');
        setAddress('');
        setOwner('');
        setPhone('');
        setStatus('Active');
      }
    }
  }, [open, store]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanCode || !cleanName) {
      toast.error('Store Code and Store Name are required');
      return;
    }

    if (!isEdit) {
      const duplicate = storesList.find((s) => s.code.toUpperCase() === cleanCode);
      if (duplicate) {
        toast.error(
          `Store code "${cleanCode}" already exists. Please use a unique 3-4 character code.`
        );
        return;
      }
    }

    const confirmed = await confirmAction({
      actionType: isEdit ? 'update' : 'create',
      title: isEdit ? `Confirm Store Hub Update: ${cleanName}` : 'Confirm New Store Hub Onboarding',
      subtitle: 'Please review store branch details and operational configuration.',
      confirmLabel: isEdit ? 'Confirm & Update Store' : 'Confirm & Register Store',
      summaryItems: [
        { label: 'Store Code', value: cleanCode, highlighted: true },
        { label: 'Store Name', value: cleanName },
        { label: 'City', value: city.trim() || 'Bengaluru' },
        { label: 'Store Owner', value: owner.trim() || 'Store Owner' },
        { label: 'Initial Status', value: status },
      ],
      warningMessage: isEdit
        ? 'Changes to store configuration will update store selectors and multi-location reporting immediately.'
        : 'Once created, this store hub will be immediately selectable for inventory assignment, POS billing, and inter-store transfers.',
    });

    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      if (isEdit && store) {
        await updateStoreHub(store.id, {
          name: cleanName,
          city: city.trim() || 'Bengaluru',
          address: address.trim() || 'Commercial Hub, Main Road',
          owner: owner.trim() || 'Store Owner',
          manager: owner.trim() || 'Store Owner',
          phone: phone.trim() || '+91 99000 99000',
          status,
        });

        toast.success(`Store "${cleanName}" updated successfully!`);
        if (onSuccess) {
          onSuccess({
            ...store,
            code: cleanCode,
            name: cleanName,
            city,
            address,
            owner,
            manager: owner,
            phone,
            status,
          });
        }
        onClose();
      } else {
        const created = await addStoreHub({
          code: cleanCode,
          name: cleanName,
          city: city.trim() || 'Bengaluru',
          address: address.trim() || 'Commercial Hub, Main Road',
          owner: owner.trim() || 'Store Owner',
          manager: owner.trim() || 'Store Owner',
          phone: phone.trim() || '+91 99000 99000',
          status,
        });

        toast.success(`Store "${cleanName}" (${cleanCode}) registered!`);
        if (onSuccess && created) onSuccess(created);
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save store');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      zIndex={zIndex}
      title={isEdit ? `Edit Store Hub: ${store?.name}` : 'Provision New Store Hub'}
      subtitle={
        isEdit
          ? `Code: ${store?.code}`
          : 'Multi-store retail network & regional warehouse configuration'
      }
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        {/* Code & Name */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              Store Code <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={8}
              autoFocus
              disabled={isEdit}
              placeholder="e.g. BLR, MUM"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="input-field text-xs font-mono font-bold uppercase"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-foreground block mb-1">
              Store Name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Bengaluru Flagship Experience Store"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field text-xs"
            />
          </div>
        </div>

        {/* City & Address */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              City / Metro Region <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Bengaluru, Hyderabad, Delhi"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="input-field text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              Commercial Address
            </label>
            <input
              type="text"
              placeholder="e.g. 100ft Road, Indiranagar"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input-field text-xs"
            />
          </div>
        </div>

        {/* Owner & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Store Owner Name</label>
            <input
              type="text"
              placeholder="e.g. Ananya Rao"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="input-field text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Contact Phone</label>
            <input
              type="tel"
              placeholder="e.g. +91 99000 12345"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field text-xs font-mono"
            />
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
          <div>
            <label className="text-xs font-bold text-foreground block">
              Store Operational Status
            </label>
            <p className="text-3xs text-muted-foreground">
              Inactive stores are excluded from inventory transfers and POS checkout.
            </p>
          </div>
          <ToggleSwitch
            checked={status === 'Active'}
            onChange={(checked) => setStatus(checked ? 'Active' : 'Inactive')}
            size="sm"
            onText="ON"
            offText="OFF"
            title="Toggle store operational status"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end items-center gap-2 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary text-xs gap-1.5" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Icon name="CheckIcon" size={14} />
                {isEdit ? 'Update Store' : 'Create Store Hub'}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
