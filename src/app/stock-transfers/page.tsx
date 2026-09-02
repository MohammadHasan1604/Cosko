'use client';
import React, { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

export default function StockTransfersPage() {
  const {
    inventory,
    storesList,
    stockTransfers,
    currentUser,
    selectedStore,
    refreshAllData,
  } = useApp();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewModalTransfer, setViewModalTransfer] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [storeFilter, setStoreFilter] = useState('All Stores');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const defaultSource = currentUser.role === 'Super Admin' ? 'CENTRAL' : currentUser.store;
  const [sourceStore, setSourceStore] = useState(defaultSource);
  const [destStore, setDestStore] = useState('BLR');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [transferPriceInput, setTransferPriceInput] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  // Available source physical locations
  const availableSourceStores = useMemo(() => {
    if (currentUser.role === 'Super Admin') {
      return storesList.filter((s) => s.status === 'Active');
    }
    return storesList.filter((s) => s.code === currentUser.store || currentUser.allowedStores?.includes(s.code));
  }, [storesList, currentUser]);

  // Available destination physical locations (cannot be same as source)
  const availableDestStores = useMemo(() => {
    return storesList.filter((s) => s.status === 'Active' && s.code !== sourceStore);
  }, [storesList, sourceStore]);

  // Items available at source location
  const sourceInventoryItems = useMemo(() => {
    return inventory.filter((i) => i.store === sourceStore && i.qtyOnHand > 0);
  }, [inventory, sourceStore]);

  // Active selected item for transfer
  const activeItem = useMemo(() => {
    if (!selectedProductId && sourceInventoryItems.length > 0) return sourceInventoryItems[0];
    return sourceInventoryItems.find((i) => i.id === selectedProductId) || sourceInventoryItems[0] || null;
  }, [selectedProductId, sourceInventoryItems]);

  // Update default transfer price when activeItem or destination store changes
  React.useEffect(() => {
    if (activeItem) {
      setTransferPriceInput(activeItem.transferPrice || Math.round(activeItem.costPrice * 1.2));
    }
  }, [activeItem, destStore]);

  // Live Calculations
  const unitCost = activeItem ? activeItem.costPrice : 0;
  const effectivePrice = typeof transferPriceInput === 'number' ? transferPriceInput : unitCost;
  const availableStock = activeItem ? activeItem.qtyOnHand : 0;
  const totalCost = unitCost * transferQty;
  const totalTransferValue = effectivePrice * transferQty;
  const grossProfit = totalTransferValue - totalCost;

  // Filtered Transfers History
  const filteredTransfers = useMemo(() => {
    return stockTransfers.filter((t: any) => {
      const matchStore =
        storeFilter === 'All Stores' ||
        t.sourceStore === storeFilter ||
        t.destStore === storeFilter;
      const matchSearch =
        searchQuery === '' ||
        (t.transferNo && t.transferNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.productName && t.productName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.notes && t.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchStore && matchSearch;
    });
  }, [stockTransfers, storeFilter, searchQuery]);

  const handleCreateTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) {
      toast.error('Please select a valid product to transfer');
      return;
    }
    if (transferQty <= 0) {
      toast.error('Transfer quantity must be at least 1 unit');
      return;
    }
    if (transferQty > availableStock) {
      toast.error(`Transfer quantity (${transferQty}) exceeds available stock (${availableStock}) at ${sourceStore}`);
      return;
    }
    if (sourceStore === destStore) {
      toast.error('Source and Destination stores cannot be identical');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sourceStore,
          destStore,
          notes: notes || undefined,
          items: [
            {
              productId: activeItem.id,
              qty: transferQty,
              costPerUnit: unitCost,
              transferPricePerUnit: effectivePrice,
            },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Transfer failed');
      }

      toast.success(`Successfully dispatched ${transferQty} units from ${sourceStore} to ${destStore} (${data.transfer.transferNo})`);
      setCreateModalOpen(false);
      setNotes('');
      setTransferQty(1);
      await refreshAllData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete stock transfer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout activeRoute="/stock-transfers">
      <div className="space-y-6 fade-in">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <span>Operations</span>
              <Icon name="ChevronRightIcon" size={12} />
              <span className="text-foreground font-medium">Inter-Store Movements</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Stock Transfer Center</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Execute atomic inventory transfers between Central Warehouse and retail stores with real-time profit tracking.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (availableDestStores.length > 0) setDestStore(availableDestStores[0].code);
                setCreateModalOpen(true);
              }}
              className="btn-primary gap-1.5 text-xs sm:text-sm font-bold shadow-sm"
            >
              <Icon name="PlusIcon" size={16} />
              New Stock Transfer
            </button>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by transfer #, product, or notes..."
                className="input-field text-xs pl-8 w-full"
              />
              <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="input-field text-xs py-2 px-3"
            >
              <option value="All Stores">All Stores / Central</option>
              {storesList.map((st) => (
                <option key={st.id} value={st.code}>
                  {st.name} ({st.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Transfers Directory Table */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-bold text-foreground">Stock Transfer Manifests</h3>
            <span className="text-xs text-muted-foreground">{filteredTransfers.length} total transfers</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-bold uppercase text-muted-foreground text-2xs">
                  <th className="px-4 py-3">Transfer #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Route (From → To)</th>
                  <th className="px-4 py-3 text-right">Units</th>
                  <th className="px-4 py-3 text-right">Transfer Value</th>
                  <th className="px-4 py-3 text-right">Central Profit</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-tabular">
                {filteredTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      No stock transfer records found.
                    </td>
                  </tr>
                ) : (
                  filteredTransfers.map((t: any) => (
                    <tr key={t.id || t.transferNo} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-primary">{t.transferNo}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN') : 'Recent'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="badge-neutral text-3xs">{t.sourceStore}</span>
                          <Icon name="ArrowRightIcon" size={12} className="text-muted-foreground" />
                          <span className="badge-info text-3xs">{t.destStore}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">{t.totalUnits || t.qty}</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">
                        ₹{(Number(t.totalTransferValue) || (t.transferPrice * t.qty) || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-success">
                        {t.sourceStore === 'CENTRAL' ? `+₹${(Number(t.grossProfit) || t.transferProfit || 0).toLocaleString('en-IN')}` : '₹0.00'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="badge-success text-3xs">{t.status || 'Received'}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setViewModalTransfer(t)}
                          className="btn-secondary text-2xs py-1 px-2.5"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Stock Transfer Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => !isSubmitting && setCreateModalOpen(false)}
        title="Execute Inter-Store Stock Transfer"
        subtitle="Atomic transfer with automatic destination stock credit and ledger logging"
        size="lg"
      >
        <form onSubmit={handleCreateTransferSubmit} className="space-y-4 py-2 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">From Location (Source) *</label>
              <select
                value={sourceStore}
                onChange={(e) => {
                  setSourceStore(e.target.value);
                  setSelectedProductId('');
                }}
                disabled={currentUser.role !== 'Super Admin'}
                className="input-field text-xs"
              >
                {availableSourceStores.map((st) => (
                  <option key={`src-${st.id}`} value={st.code}>
                    {st.name} ({st.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">To Location (Destination) *</label>
              <select
                value={destStore}
                onChange={(e) => setDestStore(e.target.value)}
                className="input-field text-xs"
              >
                {availableDestStores.map((st) => (
                  <option key={`dest-${st.id}`} value={st.code}>
                    {st.name} ({st.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Select Product *</label>
            {sourceInventoryItems.length === 0 ? (
              <div className="p-3 rounded-lg border border-warning/40 bg-warning/10 text-warning text-xs">
                No inventory in stock at {sourceStore}. Please select another source location or receive goods at Central.
              </div>
            ) : (
              <select
                value={activeItem?.id || ''}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="input-field text-xs"
              >
                {sourceInventoryItems.map((it) => (
                  <option key={`prod-${it.id}`} value={it.id}>
                    {it.name} (SKU: {it.sku}) — Available: {it.qtyOnHand} pcs
                  </option>
                ))}
              </select>
            )}
          </div>

          {activeItem && (
            <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Available at {sourceStore}:</span>
                <strong className="text-foreground font-tabular">{availableStock} units</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Base Purchase Cost:</span>
                <span className="font-tabular font-semibold">₹{unitCost.toLocaleString('en-IN')}/unit</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Transfer Quantity *</label>
              <input
                type="number"
                min="1"
                max={availableStock}
                value={transferQty}
                onChange={(e) => setTransferQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="input-field text-xs"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Transfer Price per Unit (₹) {sourceStore === 'CENTRAL' && <span className="text-primary">*</span>}
              </label>
              <input
                type="number"
                step="0.5"
                value={transferPriceInput}
                onChange={(e) => setTransferPriceInput(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="input-field text-xs"
                required
              />
            </div>
          </div>

          {/* Financial Breakdown Preview */}
          {activeItem && (
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-1.5 font-tabular">
              <div className="flex justify-between text-muted-foreground">
                <span>Total Inventory Cost:</span>
                <span>₹{totalCost.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Total Transfer Value:</span>
                <span className="font-bold text-foreground">₹{totalTransferValue.toLocaleString('en-IN')}</span>
              </div>
              {sourceStore === 'CENTRAL' && (
                <div className="flex justify-between text-success pt-1 border-t border-primary/20 font-bold">
                  <span>Gross Central Transfer Profit:</span>
                  <span>+₹{grossProfit.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Notes / Instructions (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Dispatched via Express Logistics"
              className="input-field text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setCreateModalOpen(false)}
              className="btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || sourceInventoryItems.length === 0}
              className="btn-primary text-xs font-bold"
            >
              {isSubmitting ? 'Processing Transfer...' : 'Confirm & Dispatch Stock'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Transfer Details Modal */}
      {viewModalTransfer && (
        <Modal
          open={!!viewModalTransfer}
          onClose={() => setViewModalTransfer(null)}
          title={`Stock Transfer ${viewModalTransfer.transferNo}`}
          subtitle={`${viewModalTransfer.sourceStore} → ${viewModalTransfer.destStore}`}
          size="md"
        >
          <div className="space-y-4 py-2 text-xs">
            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transfer Number:</span>
                <strong className="font-mono text-primary">{viewModalTransfer.transferNo}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Route:</span>
                <span className="font-bold">{viewModalTransfer.sourceStore} → {viewModalTransfer.destStore}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Units:</span>
                <span className="font-tabular font-bold">{viewModalTransfer.totalUnits || viewModalTransfer.qty}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transfer Value:</span>
                <span className="font-tabular font-bold">
                  ₹{(Number(viewModalTransfer.totalTransferValue) || (viewModalTransfer.transferPrice * viewModalTransfer.qty) || 0).toLocaleString('en-IN')}
                </span>
              </div>
              {viewModalTransfer.sourceStore === 'CENTRAL' && (
                <div className="flex justify-between text-success font-bold">
                  <span>Gross Central Profit:</span>
                  <span>₹{(Number(viewModalTransfer.grossProfit) || viewModalTransfer.transferProfit || 0).toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-border">
              <button onClick={() => setViewModalTransfer(null)} className="btn-primary text-xs">
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
