'use client';
import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Icon from '@/components/ui/AppIcon';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';
import { validateAndNormalizeGstin } from '@/lib/gstUtils';

interface QuickVendorModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (vendorName: string) => void;
}

export default function QuickVendorModal({ open, onClose, onSuccess }: QuickVendorModalProps) {
  const { addVendor } = useApp();
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gstin, setGstin] = useState('');
  const [category, setCategory] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Vendor / Supplier company name is required');
      return;
    }

    const gstinCheck = validateAndNormalizeGstin(gstin);
    if (!gstinCheck.isValid) {
      toast.error(gstinCheck.error || 'Invalid GSTIN format');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await addVendor({
        name: name.trim(),
        contactPerson: contactPerson.trim() || 'Account Manager',
        email: email.trim() || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@supplier.com`,
        phone: phone.trim() || '+91 98000 00000',
        gstin: gstinCheck.normalized || undefined,
        category: category.trim() || 'General Hardware',
        leadTimeDays: Number(leadTimeDays) || 3,
        outstandingPayable: 0,
        rating: 4.8,
      });

      toast.success(`Vendor "${name}" created and selected!`);
      if (onSuccess) onSuccess(name.trim());
      onClose();
      setName('');
      setContactPerson('');
      setEmail('');
      setPhone('');
      setGstin('');
      setCategory('');
      setLeadTimeDays(3);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create vendor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Onboard New Supplier Vendor"
      subtitle="Register vendor directly without leaving current workflow"
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 py-2">
        <div>
          <label className="text-xs font-bold text-foreground block mb-1">Company / Vendor Name *</label>
          <input
            type="text"
            required
            placeholder="e.g. Polycab India Ltd"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field text-xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Contact Person</label>
            <input
              type="text"
              placeholder="e.g. Rajesh Kumar"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="input-field text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Phone Number</label>
            <input
              type="text"
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Email (Optional)</label>
            <input
              type="email"
              placeholder="orders@vendor.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">GSTIN (Optional)</label>
            <input
              type="text"
              placeholder="29AAAAA0000A1Z5"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              className="input-field text-xs font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Category / Trade</label>
            <input
              type="text"
              placeholder="e.g. Cables & Wiring"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-field text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Lead Time (Days)</label>
            <input
              type="number"
              min="1"
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(Number(e.target.value))}
              className="input-field text-xs"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <button type="button" onClick={onClose} className="btn-secondary text-xs" disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" className="btn-primary text-xs" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save & Select Vendor'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
