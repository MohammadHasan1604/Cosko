'use client';
import React, { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import { useApp, Vendor, PurchaseOrder } from '@/context/AppContext';
import { toast } from 'sonner';

export default function VendorsPage() {
  const { vendors, addVendor, updateVendor, deleteVendor, purchases, recordPurchasePayment } = useApp();

  const [onboardModal, setOnboardModal] = useState(false);
  const [editVendorModal, setEditVendorModal] = useState<Vendor | null>(null);
  const [deleteVendorModal, setDeleteVendorModal] = useState<Vendor | null>(null);

  // Outstanding Payables Breakdown & Payment states (Requirement 15)
  const [selectedVendorForBreakdown, setSelectedVendorForBreakdown] = useState<any | null>(null);
  const [vendorPaymentPo, setVendorPaymentPo] = useState<PurchaseOrder | null>(null);
  const [vendorPayAmount, setVendorPayAmount] = useState<number | ''>('');
  const [vendorPayMethod, setVendorPayMethod] = useState('Bank Transfer');
  const [vendorPayDate, setVendorPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [vendorPayRef, setVendorPayRef] = useState('');
  const [vendorPayNotes, setVendorPayNotes] = useState('');
  const [isSubmittingVendorPay, setIsSubmittingVendorPay] = useState(false);

  // Form State - start clean with no pre-filled fake defaults
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState<number | ''>('');

  // Authoritative calculation of Vendor Outstanding Payable from real Purchase Orders
  const vendorOutstandingMap = useMemo(() => {
    const map: Record<string, number> = {};
    purchases.forEach((p) => {
      if (p.status === 'Cancelled') return;
      const paid = p.paidAmount ?? 0;
      const remaining = p.remainingAmount !== undefined ? p.remainingAmount : Math.max(0, p.totalAmount - paid);
      if (p.vendorId) {
        map[p.vendorId] = (map[p.vendorId] || 0) + remaining;
      }
      if (p.vendorName) {
        const normName = p.vendorName.toLowerCase().trim();
        map[normName] = (map[normName] || 0) + remaining;
      }
    });
    return map;
  }, [purchases]);

  const vendorsWithOutstanding = useMemo(() => {
    return vendors.map((v) => {
      const outstanding = vendorOutstandingMap[v.id] ?? vendorOutstandingMap[v.name.toLowerCase().trim()] ?? 0;
      return { ...v, outstandingPayable: outstanding };
    });
  }, [vendors, vendorOutstandingMap]);

  const handleOnboardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addVendor({
      name: name.trim(),
      contactPerson: contactPerson.trim(),
      email: email.trim(),
      phone: phone.trim(),
      category: category.trim() || 'General',
      gstin: gstin.trim() || undefined,
      address: address.trim() || undefined,
      leadTimeDays: Number(leadTimeDays) || 3,
      outstandingPayable: 0,
      rating: 5.0,
    });
    setOnboardModal(false);
    resetForm();
  };

  const handleUpdateVendorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVendorModal) return;
    updateVendor(editVendorModal.id, {
      name: name.trim(),
      contactPerson: contactPerson.trim(),
      email: email.trim(),
      phone: phone.trim(),
      category: category.trim() || 'General',
      gstin: gstin.trim() || undefined,
      address: address.trim() || undefined,
      leadTimeDays: Number(leadTimeDays) || 3,
    });
    setEditVendorModal(null);
    resetForm();
  };

  const openEdit = (v: Vendor) => {
    setEditVendorModal(v);
    setName(v.name || '');
    setContactPerson(v.contactPerson || '');
    setEmail(v.email || '');
    setPhone(v.phone || '');
    setCategory(v.category || '');
    setGstin(v.gstin || '');
    setAddress(v.address || '');
    setLeadTimeDays(v.leadTimeDays || 3);
  };

  const resetForm = () => {
    setName('');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setCategory('');
    setGstin('');
    setAddress('');
    setLeadTimeDays('');
  };

  return (
    <AppLayout activeRoute="/vendors">
      <div className="space-y-6 fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Vendor & Supplier Directory</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Supplier onboarding, lead times, real-time purchase payables, and GSTIN records.
            </p>
          </div>
          <button onClick={() => { resetForm(); setOnboardModal(true); }} className="btn-primary gap-2 self-start sm:self-auto text-xs sm:text-sm">
            <Icon name="PlusIcon" size={18} />
            Onboard New Supplier
          </button>
        </div>

        {/* Vendors Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendorsWithOutstanding.map((v) => (
            <div key={`vend-${v.id}`} className="card p-5 space-y-4 hover:shadow-md transition-all duration-150 relative group">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-2xs font-mono font-bold text-muted-foreground">{v.code}</span>
                  <h3 className="text-sm font-bold text-foreground">{v.name}</h3>
                  <p className="text-2xs text-muted-foreground">{v.category || 'General'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge-warning text-2xs flex items-center gap-1 font-bold">
                    ★ {v.rating}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(v)} className="p-1 text-muted-foreground hover:text-primary" title="Edit Vendor">
                      <Icon name="PencilSquareIcon" size={15} />
                    </button>
                    <button onClick={() => setDeleteVendorModal(v)} className="p-1 text-muted-foreground hover:text-danger" title="Delete / Archive Vendor">
                      <Icon name="TrashIcon" size={15} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-xs space-y-1 text-muted-foreground border-y border-border py-2.5">
                {v.contactPerson && <p><strong className="text-foreground">Contact:</strong> {v.contactPerson}</p>}
                {v.phone && <p><strong className="text-foreground">Phone:</strong> {v.phone}</p>}
                {v.email && <p><strong className="text-foreground">Email:</strong> {v.email}</p>}
                {v.gstin && <p><strong className="text-foreground">GSTIN:</strong> <span className="font-mono text-primary font-bold">{v.gstin}</span></p>}
                {v.address && <p><strong className="text-foreground">Address:</strong> {v.address}</p>}
              </div>

              <div className="flex items-center justify-between text-xs pt-1 font-tabular">
                <div>
                  <span className="text-2xs text-muted-foreground uppercase block font-semibold">Lead Time</span>
                  <span className="font-bold text-foreground">{v.leadTimeDays} Days</span>
                </div>
                <div
                  className="text-right cursor-pointer group"
                  onClick={() => setSelectedVendorForBreakdown(v)}
                  title="Click to view purchase order breakdown & payables"
                >
                  <span className="text-2xs text-muted-foreground uppercase font-semibold group-hover:text-primary transition-colors flex items-center justify-end gap-1">
                    Outstanding Payable
                    <Icon name="ChevronRightIcon" size={10} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </span>
                  <span className={`font-extrabold text-sm ${v.outstandingPayable > 0 ? 'text-danger' : 'text-emerald-600'}`}>
                    ₹{v.outstandingPayable.toLocaleString('en-IN')}
                  </span>
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
              <input type="text" placeholder="e.g. Suresh Menon" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="input-field text-xs" />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Category</label>
              <input type="text" placeholder="e.g. Electricals & Wiring" value={category} onChange={(e) => setCategory(e.target.value)} className="input-field text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Phone</label>
              <input type="text" placeholder="e.g. +91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field text-xs" />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Email</label>
              <input type="email" placeholder="e.g. orders@vendor.com" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Vendor GSTIN (Optional)</label>
              <input type="text" maxLength={15} placeholder="29ABCDE1234F1Z5" value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} className="input-field text-xs font-mono" />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Lead Time (Days)</label>
              <input type="number" min="1" placeholder="e.g. 3" value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value === '' ? '' : Number(e.target.value))} className="input-field text-xs" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Billing / Dispatch Address (Optional)</label>
            <input type="text" placeholder="e.g. Plot 45, Phase 2, Electronic City, Bengaluru" value={address} onChange={(e) => setAddress(e.target.value)} className="input-field text-xs" />
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Phone</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field text-xs" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Vendor GSTIN (Optional)</label>
                <input type="text" maxLength={15} value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} className="input-field text-xs font-mono" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Lead Time (Days)</label>
                <input type="number" min="1" value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value === '' ? '' : Number(e.target.value))} className="input-field text-xs" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Billing / Dispatch Address (Optional)</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="input-field text-xs" />
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

      {/* Outstanding Payables Breakdown Modal (Requirement 15) */}
      {selectedVendorForBreakdown && (
        <Modal
          open={!!selectedVendorForBreakdown}
          onClose={() => setSelectedVendorForBreakdown(null)}
          title="Outstanding Payables Breakdown"
          subtitle={`Supplier: ${selectedVendorForBreakdown.name} (${selectedVendorForBreakdown.code || 'Supplier'})`}
          size="lg"
        >
          <div className="space-y-4 py-2 text-xs">
            {(() => {
              const vendorPOs = purchases.filter((p) => {
                if (p.status === 'Cancelled') return false;
                const matchId = p.vendorId && p.vendorId === selectedVendorForBreakdown.id;
                const matchName = p.vendorName && p.vendorName.toLowerCase().trim() === selectedVendorForBreakdown.name.toLowerCase().trim();
                return matchId || matchName;
              });

              const totalPayable = vendorPOs.reduce((sum, p) => {
                const remaining = p.remainingAmount !== undefined ? p.remainingAmount : Math.max(0, p.totalAmount - (p.paidAmount || 0));
                return sum + remaining;
              }, 0);

              return (
                <>
                  <div className="flex items-center justify-between p-3.5 bg-muted/40 border border-border rounded-xl">
                    <div>
                      <span className="text-2xs text-muted-foreground uppercase font-bold block">Total Outstanding Balance</span>
                      <span className={`text-xl font-extrabold font-tabular ${totalPayable > 0 ? 'text-danger' : 'text-emerald-600'}`}>
                        ₹{totalPayable.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="text-right text-muted-foreground text-2xs">
                      <span>{vendorPOs.length} Total Orders</span>
                      <p className="mt-0.5">Authoritative live MySQL data</p>
                    </div>
                  </div>

                  {vendorPOs.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <Icon name="DocumentTextIcon" size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="font-semibold">No purchase orders found for this vendor.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-border rounded-xl">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-muted text-2xs font-bold uppercase text-muted-foreground">
                            <th className="px-3.5 py-2.5">PO #</th>
                            <th className="px-3.5 py-2.5">Store</th>
                            <th className="px-3.5 py-2.5">Expected</th>
                            <th className="px-3.5 py-2.5 font-tabular">Order Total</th>
                            <th className="px-3.5 py-2.5 font-tabular">Paid</th>
                            <th className="px-3.5 py-2.5 font-tabular">Remaining</th>
                            <th className="px-3.5 py-2.5">Status</th>
                            <th className="px-3.5 py-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {vendorPOs.map((po) => {
                            const remaining = po.remainingAmount !== undefined ? po.remainingAmount : Math.max(0, po.totalAmount - (po.paidAmount || 0));
                            return (
                              <tr key={`vpo-${po.id}`} className="hover:bg-muted/30 transition-colors">
                                <td className="px-3.5 py-2.5 font-mono font-bold text-primary">{po.poNo}</td>
                                <td className="px-3.5 py-2.5"><span className="badge-info text-3xs">{po.store}</span></td>
                                <td className="px-3.5 py-2.5 text-muted-foreground">{po.expectedDate}</td>
                                <td className="px-3.5 py-2.5 font-bold font-tabular">₹{po.totalAmount.toLocaleString('en-IN')}</td>
                                <td className="px-3.5 py-2.5 font-medium text-emerald-600 font-tabular">₹{(po.paidAmount || 0).toLocaleString('en-IN')}</td>
                                <td className="px-3.5 py-2.5 font-bold text-danger font-tabular">₹{remaining.toLocaleString('en-IN')}</td>
                                <td className="px-3.5 py-2.5">
                                  <span className={`text-3xs font-semibold px-2 py-0.5 rounded ${po.paymentStatus === 'Paid' ? 'bg-positive/10 text-positive' : po.paymentStatus === 'Partial' ? 'bg-info/10 text-info' : 'bg-danger/10 text-danger'}`}>
                                    {po.paymentStatus}
                                  </span>
                                </td>
                                <td className="px-3.5 py-2.5 text-right">
                                  {po.paymentStatus !== 'Paid' && remaining > 0 ? (
                                    <button
                                      onClick={() => {
                                        setVendorPaymentPo(po);
                                        setVendorPayAmount(remaining);
                                        setVendorPayMethod('Bank Transfer');
                                        setVendorPayDate(new Date().toISOString().split('T')[0]);
                                        setVendorPayRef('');
                                        setVendorPayNotes('');
                                      }}
                                      className="btn-secondary text-3xs py-1 px-2 gap-1 text-emerald-600 hover:bg-emerald-50 border-emerald-200"
                                    >
                                      <Icon name="BanknotesIcon" size={12} />
                                      Pay
                                    </button>
                                  ) : (
                                    <span className="text-3xs text-muted-foreground">Settled</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex justify-end pt-3 border-t border-border">
                    <button onClick={() => setSelectedVendorForBreakdown(null)} className="btn-secondary text-xs">
                      Close
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </Modal>
      )}

      {/* Record Payment directly from Vendor Modal */}
      {vendorPaymentPo && (
        <Modal
          open={!!vendorPaymentPo}
          onClose={() => setVendorPaymentPo(null)}
          title="Record Supplier Payment"
          subtitle={`PO #${vendorPaymentPo.poNo} — ${selectedVendorForBreakdown?.name || vendorPaymentPo.vendorName}`}
          size="md"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!vendorPaymentPo || !vendorPayAmount || Number(vendorPayAmount) <= 0) {
                toast.error('Please enter a valid payment amount');
                return;
              }
              const amt = Number(vendorPayAmount);
              const remaining = vendorPaymentPo.remainingAmount !== undefined
                ? vendorPaymentPo.remainingAmount
                : Math.max(0, vendorPaymentPo.totalAmount - (vendorPaymentPo.paidAmount || 0));
              if (amt > remaining) {
                toast.error(`Payment amount cannot exceed remaining balance (₹${remaining.toLocaleString('en-IN')})`);
                return;
              }
              setIsSubmittingVendorPay(true);
              try {
                const res = await recordPurchasePayment({
                  purchaseId: vendorPaymentPo.id,
                  amount: amt,
                  paymentDate: vendorPayDate,
                  paymentMethod: vendorPayMethod,
                  referenceNo: vendorPayRef || undefined,
                  notes: vendorPayNotes || undefined,
                });
                if (res.success) {
                  setVendorPaymentPo(null);
                  setVendorPayAmount('');
                  setVendorPayRef('');
                  setVendorPayNotes('');
                }
              } finally {
                setIsSubmittingVendorPay(false);
              }
            }}
            className="space-y-4 py-2"
          >
            <div className="p-3.5 bg-muted/40 border border-border rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total PO Cost:</span>
                <span className="font-bold text-foreground">₹{vendorPaymentPo.totalAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already Paid:</span>
                <span className="font-semibold text-emerald-600">₹{(vendorPaymentPo.paidAmount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-border font-bold">
                <span className="text-foreground">Remaining Balance:</span>
                <span className="text-danger font-tabular">
                  ₹{Math.max(0, vendorPaymentPo.totalAmount - (vendorPaymentPo.paidAmount || 0)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Payment Amount (₹) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={Math.max(0, vendorPaymentPo.totalAmount - (vendorPaymentPo.paidAmount || 0))}
                  required
                  placeholder="e.g. 5000"
                  value={vendorPayAmount}
                  onChange={(e) => setVendorPayAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="input-field text-xs font-bold text-emerald-600"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Payment Method *</label>
                <select
                  value={vendorPayMethod}
                  onChange={(e) => setVendorPayMethod(e.target.value)}
                  className="input-field text-xs font-medium"
                >
                  <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="Credit Card">Credit Card</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={vendorPayDate}
                  onChange={(e) => setVendorPayDate(e.target.value)}
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Reference / UTR / Cheque #</label>
                <input
                  type="text"
                  placeholder="e.g. UTR9283741829"
                  value={vendorPayRef}
                  onChange={(e) => setVendorPayRef(e.target.value)}
                  className="input-field text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Remarks (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Cleared pending invoices"
                value={vendorPayNotes}
                onChange={(e) => setVendorPayNotes(e.target.value)}
                className="input-field text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setVendorPaymentPo(null)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingVendorPay}
                className="btn-primary text-xs gap-1.5"
              >
                <Icon name="BanknotesIcon" size={14} />
                {isSubmittingVendorPay ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
