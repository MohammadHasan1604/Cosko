'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import { useApp, PurchaseOrder } from '@/context/AppContext';

export default function PurchasesPage() {
  const { purchases, vendors, inventory, addPurchase, updatePurchase, deletePurchase, selectedStore, storesList } = useApp();

  const [createPoModal, setCreatePoModal] = useState(false);
  const [editPoModal, setEditPoModal] = useState<PurchaseOrder | null>(null);
  const [deletePoModal, setDeletePoModal] = useState<PurchaseOrder | null>(null);

  // Form state
  const [vendorName, setVendorName] = useState(vendors[0]?.name || 'Polycab India Ltd');
  const [store, setStore] = useState('BLR');
  const [itemName, setItemName] = useState(inventory[0]?.name || 'Polycab 1.5 Sq mm Wire');
  const [qty, setQty] = useState(50);
  const [unitCost, setUnitCost] = useState(1850);
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Partial' | 'Unpaid'>('Unpaid');
  const [expectedDate, setExpectedDate] = useState('30 Aug 2026');

  const filteredPurchases = selectedStore === 'All Stores' ? purchases : purchases.filter((p) => p.store === selectedStore);

  const handleCreatePo = (e: React.FormEvent) => {
    e.preventDefault();
    addPurchase({
      vendorName,
      store,
      items: [{ name: itemName, qty, unitCost }],
      totalAmount: qty * unitCost,
      status: 'Sent',
      paymentStatus,
      expectedDate,
    });
    setCreatePoModal(false);
    resetForm();
  };

  const handleUpdatePoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPoModal) return;
    updatePurchase(editPoModal.id, {
      vendorName,
      store,
      items: [{ name: itemName, qty, unitCost }],
      totalAmount: qty * unitCost,
      paymentStatus,
      expectedDate,
    });
    setEditPoModal(null);
    resetForm();
  };

  const openEdit = (po: PurchaseOrder) => {
    setEditPoModal(po);
    setVendorName(po.vendorName);
    setStore(po.store);
    setItemName(po.items[0]?.name || '');
    setQty(po.items[0]?.qty || 1);
    setUnitCost(po.items[0]?.unitCost || 0);
    setPaymentStatus(po.paymentStatus);
    setExpectedDate(po.expectedDate);
  };

  const resetForm = () => {
    setVendorName(vendors[0]?.name || 'Polycab India Ltd');
    setStore('BLR');
    setItemName(inventory[0]?.name || 'Polycab 1.5 Sq mm Wire');
    setQty(50);
    setUnitCost(1850);
    setPaymentStatus('Unpaid');
    setExpectedDate('30 Aug 2026');
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
                    <span className={`text-3xs font-semibold px-2 py-0.5 rounded ${po.paymentStatus === 'Paid' ? 'bg-positive/10 text-positive' : 'bg-danger/10 text-danger'}`}>
                      {po.paymentStatus}
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
                      <span className={`text-2xs font-semibold px-2 py-0.5 rounded ${po.paymentStatus === 'Paid' ? 'bg-positive/10 text-positive' : 'bg-danger/10 text-danger'}`}>
                        {po.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-2xs text-muted-foreground">{po.expectedDate}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
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
              <label className="text-xs font-bold text-foreground block mb-1">Select Supplier Vendor *</label>
              <select value={vendorName} onChange={(e) => setVendorName(e.target.value)} className="input-field text-xs font-medium">
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
                {storesList.map((st) => (
                  <option key={`po-create-${st.code}`} value={st.code}>
                    {st.code} — {st.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Item Description / SKU *</label>
            <input type="text" required value={itemName} onChange={(e) => setItemName(e.target.value)} className="input-field text-xs" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Order Quantity *</label>
              <input type="number" min="1" required value={qty} onChange={(e) => setQty(Number(e.target.value))} className="input-field text-xs" />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Unit Cost Price (₹) *</label>
              <input type="number" min="0" required value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} className="input-field text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Payment Status</label>
              <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as any)} className="input-field text-xs font-medium">
                <option value="Unpaid">Unpaid</option>
                <option value="Partial">Partial</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Expected Delivery Date</label>
              <input type="text" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="input-field text-xs" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-xs font-bold text-foreground">Total PO Amount: ₹{(qty * unitCost).toLocaleString('en-IN')}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setCreatePoModal(false)} className="btn-secondary text-xs">Cancel</button>
              <button type="submit" className="btn-primary text-xs">Dispatch PO</button>
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
                <input type="text" value={vendorName} onChange={(e) => setVendorName(e.target.value)} className="input-field text-xs" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Target Store</label>
                <select value={store} onChange={(e) => setStore(e.target.value)} className="input-field text-xs font-medium">
                  {storesList.map((st) => (
                    <option key={`po-edit-${st.code}`} value={st.code}>
                      {st.code} — {st.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Item Description</label>
              <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} className="input-field text-xs" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Order Quantity</label>
                <input type="number" min="1" value={qty} onChange={(e) => setQty(Number(e.target.value))} className="input-field text-xs" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Unit Cost Price (₹)</label>
                <input type="number" min="0" value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} className="input-field text-xs" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button type="button" onClick={() => setEditPoModal(null)} className="btn-secondary text-xs">Cancel</button>
              <button type="submit" className="btn-primary text-xs">Save PO Changes</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete PO Modal */}
      {deletePoModal && (
        <Modal
          open={!!deletePoModal}
          onClose={() => setDeletePoModal(null)}
          title="Delete Purchase Order"
          subtitle={`Delete PO ${deletePoModal.poNo}?`}
          size="sm"
        >
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Are you sure you want to delete purchase order {deletePoModal.poNo}? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button onClick={() => setDeletePoModal(null)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={() => { deletePurchase(deletePoModal.id); setDeletePoModal(null); }} className="btn-danger text-xs">
                Delete PO
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
