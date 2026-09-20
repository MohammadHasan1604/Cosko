'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import Icon from '@/components/ui/AppIcon';
import CustomSelect, { SelectOption } from '@/components/ui/CustomSelect';
import NumericInput from '@/components/ui/NumericInput';
import CustomerFormModal from './CustomerFormModal';
import StoreFormModal from './StoreFormModal';
import CategoryFormModal from './CategoryFormModal';
import { useApp, Customer, StoreHub } from '@/context/AppContext';
import { toast } from 'sonner';

export interface RepairItem {
  id: string;
  ticketNo?: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  deviceType: string;
  deviceName: string;
  issueDescription: string;
  estimatedCost?: number;
  status: string;
  storeCode?: string;
  store?: string;
  enquiryDate?: string;
  linkedCoskoSaleNo?: string | null;
  assignedTech?: string;
  technicianNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RepairFormModalProps {
  open: boolean;
  onClose: () => void;
  repair?: RepairItem | null;
  onSuccess?: (repair: RepairItem) => void;
  zIndex?: number;
}

const DEVICE_TYPES = ['Mobile', 'EV', 'AC', 'TV', 'Washing Machine', 'Laptop', 'Other'];
const REPAIR_STATUSES = [
  'Pending Diagnosis',
  'In Progress',
  'Awaiting Parts',
  'Completed',
  'Delivered',
  'Cancelled',
];

export default function RepairFormModal({
  open,
  onClose,
  repair,
  onSuccess,
  zIndex = 100,
}: RepairFormModalProps) {
  const {
    customers,
    storesList,
    categoriesList,
    currentUser,
    selectedStore,
    addRepairEnquiry,
    updateRepairEnquiry,
    confirmAction,
  } = useApp();

  const isEdit = Boolean(repair);

  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deviceType, setDeviceType] = useState('Mobile');
  const [deviceName, setDeviceName] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [estimatedCost, setEstimatedCost] = useState<number | ''>('');
  const [storeCode, setStoreCode] = useState('CENTRAL');
  const [assignedTech, setAssignedTech] = useState('');
  const [technicianNotes, setTechnicianNotes] = useState('');
  const [status, setStatus] = useState('Pending Diagnosis');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Child modals for master entity onboarding
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  // Customers dropdown options
  const customerOptions: SelectOption[] = useMemo(() => {
    return customers.map((c) => ({
      value: c.id,
      label: c.name,
      sublabel: `${c.phone} · ${c.city || 'Bengaluru'}`,
      badge: c.tier,
    }));
  }, [customers]);

  // Stores dropdown options
  const storeOptions: SelectOption[] = useMemo(() => {
    return [
      { value: 'CENTRAL', label: 'CENTRAL Hub (Headquarters & Service)', sublabel: 'Central Service Center' },
      ...storesList
        .filter((s) => s.code !== 'CENTRAL')
        .map((st) => ({
          value: st.code,
          label: `${st.code} — ${st.name}`,
          sublabel: st.city,
          badge: st.status,
        })),
    ];
  }, [storesList]);

  // Dynamic Device Category Options
  const deviceCategoryOptions: SelectOption[] = useMemo(() => {
    const list = (categoriesList || []).filter((c) => c.status !== 'Archived');
    const existing = new Set<string>();
    const opts: SelectOption[] = [];

    list.forEach((c) => {
      existing.add(c.name.toLowerCase());
      opts.push({
        value: c.name,
        label: c.name,
        sublabel: c.categoryType,
      });
    });

    DEVICE_TYPES.forEach((dt) => {
      if (!existing.has(dt.toLowerCase())) {
        opts.push({ value: dt, label: dt });
      }
    });

    return opts;
  }, [categoriesList]);

  // Sync selected customer details
  const handleCustomerSelect = (val: string) => {
    setCustomerId(val);
    const match = customers.find((c) => c.id === val);
    if (match) {
      setCustomerName(match.name);
      setCustomerPhone(match.phone);
    }
  };

  useEffect(() => {
    if (open) {
      if (repair) {
        setCustomerId(repair.customerId || '');
        setCustomerName(repair.customerName || '');
        setCustomerPhone(repair.customerPhone || '');
        setDeviceType(repair.deviceType || 'Mobile');
        setDeviceName(repair.deviceName || '');
        setIssueDescription(repair.issueDescription || '');
        setEstimatedCost(repair.estimatedCost !== undefined && repair.estimatedCost !== null ? Number(repair.estimatedCost) : '');
        setStoreCode(repair.storeCode || 'CENTRAL');
        setAssignedTech(repair.assignedTech || '');
        setTechnicianNotes(repair.technicianNotes || '');
        setStatus(repair.status || 'Pending Diagnosis');
      } else {
        setCustomerId(customerOptions[0]?.value || '');
        setCustomerName(customerOptions[0]?.label || '');
        const firstCust = customers[0];
        setCustomerPhone(firstCust?.phone || '');
        setDeviceType('Mobile');
        setDeviceName('');
        setIssueDescription('');
        setEstimatedCost('');
        const defaultStore = selectedStore === 'All Stores' ? 'CENTRAL' : selectedStore;
        setStoreCode(defaultStore);
        setAssignedTech(currentUser.name || 'Service Desk');
        setTechnicianNotes('');
        setStatus('Pending Diagnosis');
      }
    }
  }, [open, repair, customers, customerOptions, selectedStore, currentUser]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error('Customer Name and Phone Number are required');
      return;
    }

    if (!deviceName.trim()) {
      toast.error('Device Model / Name is required');
      return;
    }

    if (!issueDescription.trim()) {
      toast.error('Issue Description is required');
      return;
    }

    const costNum = estimatedCost !== '' ? Number(estimatedCost) : 0;

    const confirmed = await confirmAction({
      actionType: isEdit ? 'update' : 'create',
      title: isEdit ? `Confirm Repair Ticket Update: ${repair?.ticketNo}` : 'Confirm New Repair Ticket',
      subtitle: 'Please review customer and device repair details before proceeding.',
      confirmLabel: isEdit ? 'Confirm & Update Ticket' : 'Confirm & Create Ticket',
      summaryItems: [
        { label: 'Customer', value: customerName.trim(), highlighted: true },
        { label: 'Phone', value: customerPhone.trim() },
        { label: 'Device', value: `${deviceType} - ${deviceName.trim()}` },
        { label: 'Service Center', value: storeCode },
        { label: 'Ticket Status', value: status },
        { label: 'Estimated Repair Cost', value: `₹${costNum.toLocaleString('en-IN')}` },
      ],
      warningMessage: isEdit
        ? 'Changes to technician notes or status will be logged into the repair tracking record.'
        : 'A new official repair job card with a unique tracking ticket number will be generated.',
    });

    if (!confirmed) return;

    setIsSubmitting(true);
    try {

      if (isEdit && repair) {
        await updateRepairEnquiry(repair.id, {
          deviceName: deviceName.trim(),
          deviceType,
          issueDescription: issueDescription.trim(),
          estimatedCost: costNum,
          storeCode,
          assignedTech: assignedTech.trim(),
          technicianNotes: technicianNotes.trim(),
          status,
        });
        toast.success(`Repair ticket ${repair.ticketNo} updated!`);
        if (onSuccess) {
          onSuccess({
            ...repair,
            deviceName: deviceName.trim(),
            deviceType,
            issueDescription: issueDescription.trim(),
            estimatedCost: costNum,
            storeCode,
            assignedTech: assignedTech.trim(),
            technicianNotes: technicianNotes.trim(),
            status,
          });
        }
      } else {
        await addRepairEnquiry({
          customerId: customerId || undefined,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          deviceName: deviceName.trim(),
          deviceType,
          issueDescription: issueDescription.trim(),
          estimatedCost: costNum,
          storeCode,
          assignedTech: assignedTech.trim(),
          technicianNotes: technicianNotes.trim(),
          status,
        });
        toast.success(`New repair ticket created for ${customerName}!`);
        if (onSuccess) {
          onSuccess({
            id: 'temp-' + Date.now(),
            ticketNo: 'TKT-' + Date.now().toString().slice(-4),
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            deviceName: deviceName.trim(),
            deviceType,
            issueDescription: issueDescription.trim(),
            estimatedCost: costNum,
            storeCode,
            assignedTech: assignedTech.trim(),
            technicianNotes: technicianNotes.trim(),
            status,
            createdAt: new Date().toISOString(),
          } as RepairItem);
        }
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save repair ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={isEdit ? `Edit Repair Ticket — ${repair?.ticketNo}` : 'Log New Repair Service Ticket'}
        subtitle={isEdit ? 'Update repair diagnostics, technician assignment, or status' : 'Track customer device repairs, spare parts diagnosis, and workshop status'}
        size="md"
        zIndex={zIndex}
      >
        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {/* Customer Selection with "+ Add New Customer" */}
          <div>
            <CustomSelect
              label="Customer"
              required
              placeholder="Search or select customer..."
              value={customerId}
              onChange={handleCustomerSelect}
              options={customerOptions}
              searchable={true}
              addNewLabel="+ Add New Customer"
              onAddNew={() => setCustomerModalOpen(true)}
              size="sm"
            />
            {customerPhone && (
              <p className="text-3xs text-muted-foreground mt-1">
                Contact: <strong className="text-foreground">{customerName}</strong> ({customerPhone})
              </p>
            )}
          </div>

          {/* Device Type & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <CustomSelect
                label="Device Category"
                required
                placeholder="Select category..."
                value={deviceType}
                onChange={setDeviceType}
                options={deviceCategoryOptions}
                searchable={true}
                addNewLabel="+ Add New Category"
                onAddNew={() => setCategoryModalOpen(true)}
                size="sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-foreground block mb-1">
                Device Model / Name <span className="text-danger">*</span>
              </label>
              <input
                required
                type="text"
                placeholder="e.g. Apple iPhone 15 Pro or Ather 450X Display"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="input-field text-xs h-8 font-medium"
              />
            </div>
          </div>

          {/* Issue Description */}
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              Issue Description / Symptoms <span className="text-danger">*</span>
            </label>
            <textarea
              required
              rows={2}
              placeholder="Describe malfunction, physical damage, error codes, or customer complaint..."
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              className="input-field text-xs resize-none"
            />
          </div>

          {/* Location & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <CustomSelect
                label="Store Location Hub"
                required
                placeholder="Select store..."
                value={storeCode}
                onChange={setStoreCode}
                options={storeOptions}
                searchable={true}
                addNewLabel="+ Add New Store"
                onAddNew={() => setStoreModalOpen(true)}
                size="sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Repair Status <span className="text-danger">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="input-field text-xs font-semibold h-8"
              >
                {REPAIR_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Estimated Cost & Technician */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Estimated Cost (₹)
              </label>
              <NumericInput
                min={0}
                step="0.01"
                allowDecimals={true}
                placeholder="e.g. 4500.00"
                value={estimatedCost}
                onChange={(val) => setEstimatedCost(val)}
                className="text-xs font-bold font-tabular h-8"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Assigned Technician
              </label>
              <input
                type="text"
                placeholder="e.g. Rajesh Sharma"
                value={assignedTech}
                onChange={(e) => setAssignedTech(e.target.value)}
                className="input-field text-xs h-8"
              />
            </div>
          </div>

          {/* Technician Internal Notes */}
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              Internal Workshop Notes <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Motherboard diagnostics underway, spare part requested from CENTRAL"
              value={technicianNotes}
              onChange={(e) => setTechnicianNotes(e.target.value)}
              className="input-field text-xs h-8"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end items-center gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary text-xs font-bold gap-1.5 px-4"
              disabled={isSubmitting || !deviceName.trim() || !issueDescription.trim()}
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving Ticket...
                </>
              ) : (
                <>
                  <Icon name="CheckCircleIcon" size={14} />
                  {isEdit ? 'Update Repair Ticket' : 'Create Repair Ticket'}
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Embedded Master Customer Form Modal for "+ Add New Customer" */}
      <CustomerFormModal
        open={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onSuccess={(newCust: Customer) => {
          setCustomerId(newCust.id);
          setCustomerName(newCust.name);
          setCustomerPhone(newCust.phone);
          toast.success(`Customer "${newCust.name}" registered and selected!`);
        }}
        zIndex={zIndex + 20}
      />

      {/* Embedded Master Store Form Modal for "+ Add New Store" */}
      <StoreFormModal
        open={storeModalOpen}
        onClose={() => setStoreModalOpen(false)}
        onSuccess={(newStore: StoreHub) => {
          setStoreCode(newStore.code);
          toast.success(`Store "${newStore.name}" (${newStore.code}) selected!`);
        }}
        zIndex={zIndex + 20}
      />

      {/* Embedded Master Category Form Modal */}
      <CategoryFormModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        onSuccess={(catName) => {
          setDeviceType(catName);
          toast.success(`Category "${catName}" selected!`);
        }}
        quickMode={true}
        zIndex={zIndex + 20}
      />
    </>
  );
}
