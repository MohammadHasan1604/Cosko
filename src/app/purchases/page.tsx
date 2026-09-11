'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import QuickVendorModal from '@/components/ui/QuickVendorModal';
import { useApp, PurchaseOrder } from '@/context/AppContext';
import { toast } from 'sonner';

export default function PurchasesPage() {
  const { purchases, vendors, inventory, addPurchase, updatePurchase, deletePurchase, selectedStore, storesList, refreshAllData } = useApp();

  const [createPoModal, setCreatePoModal] = useState(false);
  const [editPoModal, setEditPoModal] = useState<PurchaseOrder | null>(null);
  const [deletePoModal, setDeletePoModal] = useState<PurchaseOrder | null>(null);
  const [quickVendorOpen, setQuickVendorOpen] = useState(false);

  // Payment Recording Modal State (Requirement 28 & 29)
  const [paymentModalPo, setPaymentModalPo] = useState<PurchaseOrder | null>(null);
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [payMethod, setPayMethod] = useState('Bank Transfer');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Form state - Clean initial state without fake mock pre-fills
  const [vendorName, setVendorName] = useState('');
  const [store, setStore] = useState('CENTRAL');
  const [itemName, setItemName] = useState('');
  const [qty, setQty] = useState<string | number>('');
  const [unitCost, setUnitCost] = useState<string | number>('');
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Partial' | 'Unpaid'>('Unpaid');
  const [paidAmount, setPaidAmount] = useState<string | number>('');
  const [expectedDate, setExpectedDate] = useState('');

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalPo || !payAmount || Number(payAmount) <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    const amountNum = Number(payAmount);
    const remaining = paymentModalPo.remainingAmount !== undefined
      ? paymentModalPo.remainingAmount
      : Math.max(0, paymentModalPo.totalAmount - (paymentModalPo.paidAmount || 0));

    if (amountNum > remaining) {
      toast.error(`Payment amount cannot exceed remaining balance (₹${remaining.toLocaleString('en-IN')})`);
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const res = await fetch('/api/purchases/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          purchaseId: paymentModalPo.id,
          amount: amountNum,
          paymentDate: payDate,
          paymentMethod: payMethod,
          referenceNo: payRef || undefined,
          notes: payNotes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to record payment');
        return;
      }

      toast.success(`Payment of ₹${amountNum.toLocaleString('en-IN')} recorded successfully!`);
      setPaymentModalPo(null);
      setPayAmount('');
      setPayRef('');
      setPayNotes('');
      await refreshAllData();
    } catch (err: any) {
      toast.error(err.message || 'Error recording payment');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const openPaymentModal = (po: PurchaseOrder) => {
    setPaymentModalPo(po);
    const remaining = po.remainingAmount !== undefined
      ? po.remainingAmount
      : Math.max(0, po.totalAmount - (po.paidAmount || 0));
    setPayAmount(remaining > 0 ? remaining : '');
    setPayMethod('Bank Transfer');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayRef('');
    setPayNotes('');
  };

  const filteredPurchases = selectedStore === 'All Stores' ? purchases : purchases.filter((p) => p.store === selectedStore);

  const numQty = Number(qty) || 0;
  const numUnitCost = Number(unitCost) || 0;
  const currentTotal = numQty * numUnitCost;
  const numPaid = paymentStatus === 'Paid' ? currentTotal : paymentStatus === 'Unpaid' ? 0 : Number(paidAmount) || 0;
  const currentRemaining = Math.max(0, currentTotal - numPaid);

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName) {
      toast.error('Please select a supplier vendor');
      return;
    }
    if (!itemName) {
      toast.error('Item description or SKU is required');
      return;
    }
    if (numQty <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }
    if (numUnitCost < 0) {
      toast.error('Unit cost must be positive');
      return;
    }

    await addPurchase({
      vendorName,
      store,
      items: [{ name: itemName, qty: numQty, unitCost: numUnitCost }],
      totalAmount: currentTotal,
      paidAmount: numPaid,
      remainingAmount: currentRemaining,
      status: 'Sent',
      paymentStatus,
      expectedDate: expectedDate || 'ASAP',
    });
    setCreatePoModal(false);
    resetForm();
  };

  const handleUpdatePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPoModal) return;

    await updatePurchase(editPoModal.id, {
      vendorName,
      store,
      items: [{ name: itemName, qty: numQty, unitCost: numUnitCost }],
      totalAmount: currentTotal,
      paidAmount: numPaid,
      remainingAmount: currentRemaining,
      paymentStatus,
      expectedDate: expectedDate || 'ASAP',
    });
    setEditPoModal(null);
    resetForm();
  };

  const openEdit = (po: PurchaseOrder) => {
    setEditPoModal(po);
    setVendorName(po.vendorName);
    setStore(po.store);
    setItemName(po.items[0]?.name || '');
    setQty(po.items[0]?.qty || '');
    setUnitCost(po.items[0]?.unitCost || '');
    setPaymentStatus(po.paymentStatus);
    setPaidAmount(po.paidAmount !== undefined ? po.paidAmount : po.paymentStatus === 'Paid' ? po.totalAmount : '');
    setExpectedDate(po.expectedDate || '');
  };

  const resetForm = () => {
    setVendorName('');
    setStore('CENTRAL');
    setItemName('');
    setQty('');
    setUnitCost('');
    setPaymentStatus('Unpaid');
    setPaidAmount('');
    setExpectedDate('');
  };

  return (
    <AppLayout activeRoute="/purchases">
      <div className="space-y-6 fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Purchases & Goods Receiving</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Purchase orders, supplier shipments, Goods Received Notes (GRN), and payable tracking.
            </p>
          </div>
          <button onClick={() => { resetForm(); setCreatePoModal(true); }} className="btn-primary gap-2">
            <Icon name="PlusIcon" size={18} />
            Create Purchase Order
          </button>
        </div>

        {/* Purchase Orders Directory */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-bold text-foreground">Purchase Orders Directory</h3>
            <span className="text-xs text-muted-foreground">{filteredPurchases.length} total orders</span>
          </div>

          {/* Mobile PO Cards (<md) */}
          <div className="block md:hidden divide-y divide-border">
            {filteredPurchases.map((po) => (
              <div key={`m-po-${po.id}`} className="p-4 space-y-3 bg-card hover:bg-muted/10 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-primary">{po.poNo}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-3xs font-semibold px-2 py-0.5 rounded ${po.status === 'Received' ? 'bg-positive/10 text-positive' : 'bg-warning/10 text-warning'}`}>
                      {po.status}
                    </span>
                    <span className={`text-3xs font-semibold px-2 py-0.5 rounded ${po.paymentStatus === 'Paid' ? 'bg-positive/10 text-positive' : po.paymentStatus === 'Partial' ? 'bg-info/10 text-info' : 'bg-danger/10 text-danger'}`}>
                      {po.paymentStatus === 'Partial' ? `Partial (Rem: ₹${(po.remainingAmount ?? (po.totalAmount - (po.paidAmount || 0))).toLocaleString('en-IN')})` : po.paymentStatus}
                    </span>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{po.vendorName}</h4>
                    <p className="text-2xs text-muted-foreground mt-0.5">Expected: {po.expectedDate} · Store: <span className="badge-info text-3xs font-mono">{po.store}</span></p>
                  </div>
                  <span className="text-sm font-extrabold font-tabular text-foreground">₹{po.totalAmount.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                  {po.paymentStatus !== 'Paid' && (
                    <button
                      onClick={() => openPaymentModal(po)}
                      className="btn-secondary text-3xs py-1 px-2.5 gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                    >
                      <Icon name="BanknotesIcon" size={12} />
                      Record Payment
                    </button>
                  )}
                  {po.status !== 'Received' && (
                    <button
                      onClick={() => updatePurchase(po.id, { status: 'Received' })}
                      className="btn-primary text-3xs py-1 px-2.5 gap-1"
                    >
                      <Icon name="CheckIcon" size={12} />
                      Receive GRN
                    </button>
                  )}
                  <button onClick={() => openEdit(po)} className="btn-secondary text-3xs py-1 px-2.5 gap-1">
                    <Icon name="PencilSquareIcon" size={13} />
                    Edit PO
                  </button>
                  <button onClick={() => setDeletePoModal(po)} className="btn-ghost text-3xs py-1 px-2 text-danger hover:bg-danger/10">
                    <Icon name="TrashIcon" size={13} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop PO Table (>=md) */}
          <div className="hidden md:block overflow-x-auto scrollbar-thin">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="bg-muted text-2xs font-bold uppercase text-muted-foreground">
                  <th className="px-4 py-3">PO Number</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-3 font-tabular">Amount</th>
                  <th className="px-4 py-3">Fulfillment</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Expected Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {filteredPurchases.map((po) => (
                  <tr key={`po-row-${po.id}`} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-xs font-bold text-primary">{po.poNo}</td>
                    <td className="px-4 py-3.5 font-semibold text-foreground">{po.vendorName}</td>
                    <td className="px-4 py-3.5"><span className="badge-info text-2xs">{po.store}</span></td>
                    <td className="px-4 py-3.5 font-bold font-tabular text-foreground">₹{po.totalAmount.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3.5">
                      <span className={`text-2xs font-semibold px-2 py-0.5 rounded ${po.status === 'Received' ? 'bg-positive/10 text-positive' : 'bg-warning/10 text-warning'}`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-2xs font-semibold px-2 py-0.5 rounded ${po.paymentStatus === 'Paid' ? 'bg-positive/10 text-positive' : po.paymentStatus === 'Partial' ? 'bg-info/10 text-info' : 'bg-danger/10 text-danger'}`}>
                        {po.paymentStatus === 'Partial' ? `Partial (Rem: ₹${(po.remainingAmount ?? (po.totalAmount - (po.paidAmount || 0))).toLocaleString('en-IN')})` : po.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-2xs text-muted-foreground">{po.expectedDate}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {po.paymentStatus !== 'Paid' && (
                          <button
                            onClick={() => openPaymentModal(po)}
                            className="btn-secondary text-3xs py-1 px-2 gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                            title="Record Payment against PO"
                          >
                            <Icon name="BanknotesIcon" size={12} />
                            Pay
                          </button>
                        )}
                        {po.status !== 'Received' && (
                          <button
                            onClick={() => updatePurchase(po.id, { status: 'Received' })}
                            className="btn-primary text-3xs py-1 px-2 gap-1"
                            title="Receive Goods Received Note (GRN) & Credit Stock"
                          >
                            <Icon name="CheckIcon" size={12} />
                            Receive GRN
                          </button>
                        )}
                        <button onClick={() => openEdit(po)} className="p-1 text-muted-foreground hover:text-primary" title="Edit PO">
                          <Icon name="PencilSquareIcon" size={15} />
                        </button>
                        <button onClick={() => setDeletePoModal(po)} className="p-1 text-muted-foreground hover:text-danger" title="Delete PO">
                          <Icon name="TrashIcon" size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Purchase Order Modal */}
      <Modal
        open={createPoModal}
        onClose={() => setCreatePoModal(false)}
        title="Create New Purchase Order"
        subtitle="Generate PO for supplier inventory replenishment"
        size="md"
      >
        <form onSubmit={handleCreatePo} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-foreground block">Select Supplier Vendor *</label>
                <button
                  type="button"
                  onClick={() => setQuickVendorOpen(true)}
                  className="text-3xs text-primary font-bold hover:underline flex items-center gap-0.5"
                >
                  <Icon name="PlusIcon" size={10} />
                  Add New
                </button>
              </div>
              <select
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                className="input-field text-xs font-medium"
                required
              >
                <option value="">-- Select Vendor --</option>
                {vendors.map((v) => (
                  <option key={`v-po-${v.id}`} value={v.name}>
                    {v.name} ({v.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Target Receiving Store *</label>
              <select value={store} onChange={(e) => setStore(e.target.value)} className="input-field text-xs font-medium">
                {[...storesList]
                  .sort((a, b) => (a.code === 'CENTRAL' ? -1 : b.code === 'CENTRAL' ? 1 : a.code.localeCompare(b.code)))
                  .map((st) => (
                    <option key={`po-create-${st.code}`} value={st.code}>
                      {st.code === 'CENTRAL' ? 'COSKO Central Warehouse (CENTRAL)' : `${st.code} — ${st.name}`}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">Item Description / SKU *</label>
              {inventory.length > 0 && (
                <span className="text-3xs text-muted-foreground">Pick from catalog or type custom below</span>
              )}
            </div>
            {inventory.length > 0 && (
              <select
                className="input-field text-xs font-medium mb-1.5"
                onChange={(e) => {
                  const selectedId = e.target.value;
                  if (!selectedId) return;
                  const found = inventory.find(i => i.id === selectedId || i.productId === selectedId);
                  if (found) {
                    setItemName(found.name);
                    if (found.costPrice > 0) setUnitCost(found.costPrice);
                  }
                }}
              >
                <option value="">-- Quick Pick from Inventory Catalog (Optional) --</option>
                {inventory.map((inv) => (
                  <option key={`inv-opt-${inv.id}`} value={inv.id}>
                    {inv.name} ({inv.sku}) — Cost: ₹{inv.costPrice}
                  </option>
                ))}
              </select>
            )}
            <input
              type="text"
              required
              placeholder="e.g. Polycab 1.5 Sq mm Wire"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="input-field text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Order Quantity *</label>
              <input
                type="number"
                min="1"
                required
                placeholder="e.g. 50"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="input-field text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Unit Cost Price (₹) *</label>
              <input
                type="number"
                min="0"
                required
                placeholder="e.g. 1850"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="input-field text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Payment Status</label>
              <select
                value={paymentStatus}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setPaymentStatus(val);
                  if (val === 'Paid') setPaidAmount(currentTotal);
                  else if (val === 'Unpaid') setPaidAmount(0);
                }}
                className="input-field text-xs font-medium"
              >
                <option value="Unpaid">Unpaid</option>
                <option value="Partial">Partial</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Expected Delivery Date</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="input-field text-xs"
              />
            </div>
          </div>

          {paymentStatus === 'Partial' && (
            <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span>Total Amount:</span>
                <span>₹{currentTotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-2xs font-bold text-foreground block mb-1">Amount Paid (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    max={currentTotal}
                    required
                    placeholder="Enter paid amount"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="input-field text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-2xs font-bold text-muted-foreground block mb-1">Amount Remaining (₹)</label>
                  <div className="input-field text-xs font-bold bg-muted text-danger font-tabular flex items-center">
                    ₹{currentRemaining.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-xs font-bold text-foreground">
              Total PO Amount: ₹{currentTotal.toLocaleString('en-IN')}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setCreatePoModal(false)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button type="submit" className="btn-primary text-xs">
                Dispatch PO
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit Purchase Order Modal */}
      {editPoModal && (
        <Modal
          open={!!editPoModal}
          onClose={() => setEditPoModal(null)}
          title="Edit Purchase Order"
          subtitle={`Modify PO ${editPoModal.poNo}`}
          size="md"
        >
          <form onSubmit={handleUpdatePoSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Supplier Vendor</label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Target Store</label>
                <select value={store} onChange={(e) => setStore(e.target.value)} className="input-field text-xs font-medium">
                  {[...storesList]
                    .sort((a, b) => (a.code === 'CENTRAL' ? -1 : b.code === 'CENTRAL' ? 1 : a.code.localeCompare(b.code)))
                    .map((st) => (
                      <option key={`po-edit-${st.code}`} value={st.code}>
                        {st.code === 'CENTRAL' ? 'COSKO Central Warehouse (CENTRAL)' : `${st.code} — ${st.name}`}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Item Description</label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="input-field text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Order Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Unit Cost Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  className="input-field text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Payment Status</label>
                <select
                  value={paymentStatus}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setPaymentStatus(val);
                    if (val === 'Paid') setPaidAmount(currentTotal);
                    else if (val === 'Unpaid') setPaidAmount(0);
                  }}
                  className="input-field text-xs font-medium"
                >
                  <option value="Unpaid">Unpaid</option>
                  <option value="Partial">Partial</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Expected Delivery Date</label>
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="input-field text-xs"
                />
              </div>
            </div>

            {paymentStatus === 'Partial' && (
              <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Total Amount:</span>
                  <span>₹{currentTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-2xs font-bold text-foreground block mb-1">Amount Paid (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      max={currentTotal}
                      required
                      placeholder="Enter paid amount"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      className="input-field text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-2xs font-bold text-muted-foreground block mb-1">Amount Remaining (₹)</label>
                    <div className="input-field text-xs font-bold bg-muted text-danger font-tabular flex items-center">
                      ₹{currentRemaining.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button type="button" onClick={() => setEditPoModal(null)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button type="submit" className="btn-primary text-xs">
                Save PO Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete PO Modal */}
      {deletePoModal && (
        <Modal
          open={!!deletePoModal}
          onClose={() => setDeletePoModal(null)}
          title={`Archive / Delete PO ${deletePoModal.poNo}`}
          subtitle={`Supplier: ${deletePoModal.vendorName} · Status: ${deletePoModal.status}`}
          size="md"
        >
          <div className="space-y-4 py-2 text-xs">
            {(() => {
              const isReceived = deletePoModal.status === 'Received' || (deletePoModal as any).status === 'Completed';

              return (
                <>
                  <div className={`p-4 rounded-xl border ${isReceived ? 'bg-warning/10 border-warning/30 text-foreground' : 'bg-muted/40 border-border text-foreground'}`}>
                    <div className="flex items-start gap-2.5">
                      <Icon name={isReceived ? 'ExclamationTriangleIcon' : 'InformationCircleIcon'} size={18} className={isReceived ? 'text-warning shrink-0 mt-0.5' : 'text-primary shrink-0 mt-0.5'} />
                      <div>
                        <p className="font-bold text-sm">
                          {isReceived ? 'Purchase Order Already Received Into Stock' : 'Draft / Unreceived Purchase Order'}
                        </p>
                        <p className="text-muted-foreground mt-1">
                          {isReceived
                            ? `This purchase order has already been received into central inventory stock. To protect warehouse ledgers and audit records, this PO will be safely Cancelled / Archived.`
                            : `This draft PO has not impacted warehouse stock and can be safely deleted.`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-border">
                    <button onClick={() => setDeletePoModal(null)} className="btn-secondary text-xs">Cancel</button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deletePurchase(deletePoModal.id);
                        setDeletePoModal(null);
                      }}
                      className={isReceived ? "btn-primary bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4" : "btn-danger text-xs font-bold px-4"}
                    >
                      {isReceived ? 'Cancel & Archive PO' : 'Delete Draft PO'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </Modal>
      )}

      {/* Record Payment Modal */}
      {paymentModalPo && (
        <Modal
          open={!!paymentModalPo}
          onClose={() => setPaymentModalPo(null)}
          title="Record Supplier Payment"
          subtitle={`PO #${paymentModalPo.poNo} — ${paymentModalPo.vendorName}`}
          size="md"
        >
          <form onSubmit={handleRecordPayment} className="space-y-4 py-2">
            {/* Summary breakdown */}
            <div className="p-3.5 bg-muted/40 border border-border rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total PO Cost:</span>
                <span className="font-bold text-foreground">₹{paymentModalPo.totalAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already Paid:</span>
                <span className="font-semibold text-emerald-600">₹{(paymentModalPo.paidAmount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-border font-bold">
                <span className="text-foreground">Remaining Balance:</span>
                <span className="text-danger font-tabular">
                  ₹{Math.max(0, paymentModalPo.totalAmount - (paymentModalPo.paidAmount || 0)).toLocaleString('en-IN')}
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
                  max={Math.max(0, paymentModalPo.totalAmount - (paymentModalPo.paidAmount || 0))}
                  required
                  placeholder="e.g. 5000"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="input-field text-xs font-bold text-emerald-600"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Payment Method *</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
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
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Reference / UTR / Cheque #</label>
                <input
                  type="text"
                  placeholder="e.g. UTR9283741829"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="input-field text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Payment Remarks (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Advance payment tranche 1"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="input-field text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setPaymentModalPo(null)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingPayment}
                className="btn-primary text-xs gap-1.5"
              >
                <Icon name="BanknotesIcon" size={14} />
                {isSubmittingPayment ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Quick Vendor Modal */}
      <QuickVendorModal
        open={quickVendorOpen}
        onClose={() => setQuickVendorOpen(false)}
        onSuccess={(name) => setVendorName(name)}
      />
    </AppLayout>
  );
}
