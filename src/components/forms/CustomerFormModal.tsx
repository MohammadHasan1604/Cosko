'use client';
import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Icon from '@/components/ui/AppIcon';
import NumericInput from '@/components/ui/NumericInput';
import { useApp, Customer } from '@/context/AppContext';
import { toast } from 'sonner';
import { validateAndNormalizeGstin } from '@/lib/gstUtils';

interface CustomerFormModalProps {
  open: boolean;
  onClose: () => void;
  customer?: Customer | null;
  onSuccess?: (customer: Customer) => void;
  initialPhone?: string;
  initialName?: string;
  quickMode?: boolean;
  zIndex?: number;
}

export function clean10DigitPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
}

export default function CustomerFormModal({
  open,
  onClose,
  customer,
  onSuccess,
  initialPhone = '',
  initialName = '',
  quickMode = false,
  zIndex = 100,
}: CustomerFormModalProps) {
  const { addCustomer, updateCustomer, confirmAction } = useApp();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [tier, setTier] = useState<'VIP' | 'Regular' | 'New'>('Regular');
  const [creditBalance, setCreditBalance] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = Boolean(customer);

  useEffect(() => {
    if (open) {
      if (customer) {
        setName(customer.name || '');
        setPhone(clean10DigitPhone(customer.phone || ''));
        setEmail(customer.email || '');
        setCity(customer.city || 'Bengaluru');
        setAddress(customer.address || '');
        setGstin('');
        setTier(customer.tier || 'Regular');
        setCreditBalance(
          customer.creditBalance !== undefined && customer.creditBalance !== null
            ? customer.creditBalance
            : ''
        );
      } else {
        setName(initialName || '');
        setPhone(clean10DigitPhone(initialPhone || ''));
        setEmail('');
        setCity('Bengaluru');
        setAddress('');
        setGstin('');
        setTier('Regular');
        setCreditBalance('');
      }
    }
  }, [open, customer, initialPhone, initialName]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error('Customer Name is required');
      return;
    }

    const cleanDigits = clean10DigitPhone(phone);
    if (cleanDigits.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

    if (gstin.trim()) {
      const gstinCheck = validateAndNormalizeGstin(gstin);
      if (!gstinCheck.isValid) {
        toast.error(gstinCheck.error || 'Invalid GSTIN format');
        return;
      }
    }

    const formattedPhone = `+91 ${cleanDigits.slice(0, 5)} ${cleanDigits.slice(5)}`;
    const cleanGstin = gstin.trim().toUpperCase();

    const confirmed = await confirmAction({
      actionType: isEdit ? 'update' : 'create',
      title: isEdit ? `Confirm Customer Update: ${cleanName}` : 'Confirm New Customer Registration',
      subtitle: 'Please review customer profile information before saving.',
      confirmLabel: isEdit ? 'Confirm & Update Customer' : 'Confirm & Register Customer',
      summaryItems: [
        { label: 'Customer Name', value: cleanName, highlighted: true },
        { label: 'Mobile Phone', value: formattedPhone },
        { label: 'Email Address', value: email.trim() || 'N/A' },
        { label: 'City / Location', value: city.trim() || 'Bengaluru' },
        { label: 'Customer Tier', value: tier },
        ...(creditBalance !== ''
          ? [
              {
                label: 'Credit Balance',
                value: `₹${Number(creditBalance).toLocaleString('en-IN')}`,
              },
            ]
          : []),
      ],
      warningMessage: isEdit
        ? 'Customer updates will reflect immediately across all POS customer lookups and CRM history.'
        : 'Once registered, this customer profile can immediately be selected for sales billing and repair tickets.',
    });

    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      if (isEdit && customer) {
        const res = await updateCustomer(customer.id, {
          name: cleanName,
          phone: formattedPhone,
          email: email.trim() || undefined,
          city: city.trim() || 'Bengaluru',
          address: address.trim() || undefined,
          tier,
          creditBalance:
            creditBalance !== '' && creditBalance !== undefined && creditBalance !== null
              ? Number(creditBalance)
              : 0,
        });

        const updatedCust: Customer = {
          ...customer,
          name: cleanName,
          phone: formattedPhone,
          email: email.trim(),
          city: city.trim() || 'Bengaluru',
          address: address.trim(),
          tier,
          creditBalance:
            creditBalance !== '' && creditBalance !== undefined && creditBalance !== null
              ? Number(creditBalance)
              : 0,
        };

        toast.success(`Customer "${cleanName}" updated successfully`);
        if (onSuccess) onSuccess(updatedCust);
        onClose();
      } else {
        const res = await addCustomer({
          name: cleanName,
          phone: formattedPhone,
          email:
            email.trim() || `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}@customer.com`,
          city: city.trim() || 'Bengaluru',
          address: address.trim() || undefined,
          tier,
          creditBalance:
            creditBalance !== '' && creditBalance !== undefined && creditBalance !== null
              ? Number(creditBalance)
              : 0,
          status: 'Active',
        });

        if (res) {
          toast.success(`Customer "${cleanName}" registered successfully!`);
          if (onSuccess) onSuccess(res);
          onClose();
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      zIndex={zIndex}
      title={
        isEdit
          ? `Edit Customer: ${customer?.name}`
          : quickMode
            ? 'Quick Customer Registration'
            : 'Register New Customer'
      }
      subtitle={
        isEdit
          ? `Account: ${customer?.phone}`
          : 'Unified customer profile across POS, Repairs, and Billing'
      }
      size={quickMode ? 'sm' : 'md'}
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        {/* Full Name */}
        <div>
          <label className="text-xs font-bold text-foreground block mb-1">
            Customer Full Name <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            required
            autoFocus
            placeholder="e.g. Ramesh Patel, Ananya Sharma"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field text-xs"
          />
        </div>

        {/* Phone & Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              Mobile Number (10 Digits) <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-mono font-semibold">
                +91
              </span>
              <input
                type="tel"
                required
                maxLength={10}
                placeholder="9876543210"
                value={phone}
                onChange={(e) => setPhone(clean10DigitPhone(e.target.value))}
                className="input-field pl-12 text-xs font-mono font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              Email Address <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <input
              type="email"
              placeholder="customer@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field text-xs"
            />
          </div>
        </div>

        {/* GSTIN & City */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              Customer GSTIN{' '}
              <span className="text-muted-foreground font-normal">(B2B Invoices)</span>
            </label>
            <input
              type="text"
              maxLength={15}
              placeholder="29AAAAA0000A1Z5"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              className="input-field text-xs font-mono uppercase"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">City / Region</label>
            <input
              type="text"
              placeholder="e.g. Bengaluru, Hyderabad"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="input-field text-xs"
            />
          </div>
        </div>

        {/* Billing Address */}
        <div>
          <label className="text-xs font-bold text-foreground block mb-1">
            Billing / Delivery Address{' '}
            <span className="text-muted-foreground font-normal">(Optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. 100ft Road, Indiranagar, Bengaluru"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="input-field text-xs"
          />
        </div>

        {/* Tier & Credit Balance */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border border-border bg-muted/20">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Customer Segment</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as any)}
              className="input-field text-xs font-medium"
            >
              <option value="Regular">Regular Customer</option>
              <option value="VIP">VIP / Priority</option>
              <option value="New">New Customer</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              Opening Credit Balance (₹)
            </label>
            <NumericInput
              min={0}
              step="0.01"
              allowDecimals={true}
              placeholder="e.g. 500.00"
              value={creditBalance}
              onChange={(val) => setCreditBalance(val)}
              className="text-xs font-tabular"
            />
          </div>
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
                {isEdit
                  ? 'Update Customer'
                  : quickMode
                    ? 'Save & Auto-Select'
                    : 'Register Customer'}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
