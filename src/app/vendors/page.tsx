'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import { useApp, Vendor } from '@/context/AppContext';

export default function VendorsPage() {
  const { vendors, addVendor, updateVendor, deleteVendor } = useApp();

  const [onboardModal, setOnboardModal] = useState(false);
  const [editVendorModal, setEditVendorModal] = useState<Vendor | null>(null);
  const [deleteVendorModal, setDeleteVendorModal] = useState<Vendor | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('Electricals & Wiring');
  const [leadTimeDays, setLeadTimeDays] = useState(3);
  const [outstandingPayable, setOutstandingPayable] = useState(0);

  const handleOnboardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    addVendor({
      name,
      contactPerson,
      email: email || `orders@${name.toLowerCase().replace(/\s+/g, '')}.com`,
      phone: phone || '+91 80 1234 5678',
      category,
      leadTimeDays,
      outstandingPayable,
      rating: 4.8,
    });
    setOnboardModal(false);
    resetForm();
  };

  const handleUpdateVendorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVendorModal) return;
    updateVendor(editVendorModal.id, {
      name,
      contactPerson,
      email,
      phone,
      category,
      leadTimeDays,
      outstandingPayable,
    });
    setEditVendorModal(null);
    resetForm();
  };

  const openEdit = (v: Vendor) => {
    setEditVendorModal(v);
    setName(v.name);
    setContactPerson(v.contactPerson);
    setEmail(v.email);
    setPhone(v.phone);
    setCategory(v.category);
    setLeadTimeDays(v.leadTimeDays);
    setOutstandingPayable(v.outstandingPayable);
  };

  const resetForm = () => {
    setName('');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setCategory('Electricals & Wiring');
    setLeadTimeDays(3);
    setOutstandingPayable(0);
  };

  return (
    <AppLayout activeRoute="/vendors">
      <div className="space-y-6 fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Vendor & Supplier Directory</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Supplier onboarding, lead times, outstanding payables, and commercial ratings.
            </p>
          </div>
          <button onClick={() => { resetForm(); setOnboardModal(true); }} className="btn-primary gap-2 self-start sm:self-auto text-xs sm:text-sm">
            <Icon name="PlusIcon" size={18} />
            Onboard New Supplier
          </button>
        </div>

        {/* Vendors Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map((v) => (
            <div key={`vend-${v.id}`} className="card p-5 space-y-4 hover:shadow-md transition-all duration-150 relative group">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-2xs font-mono font-bold text-muted-foreground">{v.code}</span>
                  <h3 className="text-sm font-bold text-foreground">{v.name}</h3>
                  <p className="text-2xs text-muted-foreground">{v.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge-warning text-2xs flex items-center gap-1 font-bold">
                    ★ {v.rating}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(v)} className="p-1 text-muted-foreground hover:text-primary">
                      <Icon name="PencilSquareIcon" size={15} />
                    </button>
                    <button onClick={() => setDeleteVendorModal(v)} className="p-1 text-muted-foreground hover:text-danger">
                      <Icon name="TrashIcon" size={15} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-xs space-y-1 text-muted-foreground border-y border-border py-2.5">
                <p><strong className="text-foreground">Contact Representative:</strong> {v.contactPerson}</p>
                <p><strong className="text-foreground">Phone:</strong> {v.phone}</p>
                <p><strong className="text-foreground">Email:</strong> {v.email}</p>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 font-tabular">
                <div>
                  <span className="text-2xs text-muted-foreground uppercase block font-semibold">Lead Time</span>
                  <span className="font-bold text-foreground">{v.leadTimeDays} Days</span>
                </div>
                <div className="text-right">
                  <span className="text-2xs text-muted-foreground uppercase block font-semibold">Outstanding Payable</span>
                  <span className="font-extrabold text-sm text-danger">₹{v.outstandingPayable.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Onboard Supplier Modal */}
      <Modal
        open={onboardModal}
        onClose={() => setOnboardModal(false)}
        title="Onboard Supplier Vendor"
        subtitle="Register new vendor into purchasing system"
        size="md"
      >
        <form onSubmit={handleOnboardSubmit} className="space-y-4 py-2">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Company / Vendor Name *</label>
            <input type="text" required placeholder="e.g. Havells India Limited" value={name} onChange={(e) => setName(e.target.value)} className="input-field text-xs" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Contact Representative</label>
              <input type="text" placeholder="Suresh Menon" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="input-field text-xs" />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Category</label>
              <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} className="input-field text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Phone</label>
              <input type="text" placeholder="+91 80 2345 6789" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field text-xs" />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Email</label>
              <input type="email" placeholder="orders@vendor.com" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Lead Time (Days)</label>
              <input type="number" min="1" value={leadTimeDays} onChange={(e) => setLeadTimeDays(Number(e.target.value))} className="input-field text-xs" />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Outstanding Payable (₹)</label>
              <input type="number" min="0" value={outstandingPayable} onChange={(e) => setOutstandingPayable(Number(e.target.value))} className="input-field text-xs" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={() => setOnboardModal(false)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs">Onboard Supplier</button>
          </div>
        </form>
      </Modal>

      {/* Edit Vendor Modal */}
      {editVendorModal && (
        <Modal
          open={!!editVendorModal}
          onClose={() => setEditVendorModal(null)}
          title="Edit Supplier Profile"
          subtitle={`Update details for ${editVendorModal.name}`}
          size="md"
        >
          <form onSubmit={handleUpdateVendorSubmit} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Vendor Name *</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="input-field text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Contact Representative</label>
                <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="input-field text-xs" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Category</label>
                <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} className="input-field text-xs" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button type="button" onClick={() => setEditVendorModal(null)} className="btn-secondary text-xs">Cancel</button>
              <button type="submit" className="btn-primary text-xs">Save Changes</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Vendor Modal */}
      {deleteVendorModal && (
        <Modal
          open={!!deleteVendorModal}
          onClose={() => setDeleteVendorModal(null)}
          title={`Archive / Delete "${deleteVendorModal.name}"`}
          subtitle="Relational validation against purchase orders and procurement history"
          size="md"
        >
          <div className="space-y-4 py-2 text-xs">
            {(() => {
              const poCount = (deleteVendorModal as any).purchasesCount || (deleteVendorModal.outstandingPayable > 0 ? 1 : 0);
              return (
                <>
                  <div className={`p-4 rounded-xl border ${poCount > 0 ? 'bg-warning/10 border-warning/30 text-foreground' : 'bg-muted/40 border-border text-foreground'}`}>
                    <div className="flex items-start gap-2.5">
                      <Icon name={poCount > 0 ? 'ExclamationTriangleIcon' : 'InformationCircleIcon'} size={18} className={poCount > 0 ? 'text-warning shrink-0 mt-0.5' : 'text-primary shrink-0 mt-0.5'} />
                      <div>
                        <p className="font-bold text-sm">
                          {poCount > 0 ? 'Vendor Has Procurement / Financial Records' : 'Unused Vendor Record'}
                        </p>
                        <p className="text-muted-foreground mt-1">
                          {poCount > 0
                            ? `This vendor has purchase orders or an outstanding balance of ₹${deleteVendorModal.outstandingPayable.toLocaleString('en-IN')}. It will be safely Archived to preserve warehouse stock ledgers and accounting history.`
                            : `This vendor has no linked purchase orders. You can archive it safely, or permanently delete it.`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-border">
                    <button onClick={() => setDeleteVendorModal(null)} className="btn-secondary text-xs">Cancel</button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteVendor(deleteVendorModal.id, false);
                        setDeleteVendorModal(null);
                      }}
                      className="btn-primary bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4"
                    >
                      Safe Archive
                    </button>
                    {poCount === 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteVendor(deleteVendorModal.id, true);
                          setDeleteVendorModal(null);
                        }}
                        className="btn-danger text-xs font-bold px-4"
                      >
                        Permanent Delete
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
