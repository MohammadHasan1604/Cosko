'use client';
import React, { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import StockTransferModal from '@/components/forms/StockTransferModal';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';
import SuperAdminGuard from '@/components/SuperAdminGuard';
import {
  calculateTransferLineItem,
  formatTransferINR,
  formatTransferMargin,
  getTransferProfitColorClass,
  validateTransferHeader,
  validateTransferItem,
  round2,
} from '@/lib/stockTransferCalculations';

export default function StockTransfersPage() {
  const {
    inventory,
    storesList,
    stockTransfers,
    currentUser,
    selectedStore,
    refreshAllData,
    updateTransferStatus,
    deleteTransfer,
  } = useApp();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewModalTransfer, setViewModalTransfer] = useState<any | null>(null);
  const [cancelModalTransfer, setCancelModalTransfer] = useState<any | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [storeFilter, setStoreFilter] = useState('All Stores');

  // Filtered Transfers History
  const filteredTransfers = useMemo(() => {
    return stockTransfers.filter((t: any) => {
      const assignedStore = currentUser.store || 'BLR';
      const matchStore = currentUser.role === 'Super Admin'
        ? (storeFilter === 'All Stores' || t.sourceStore === storeFilter || t.destStore === storeFilter)
        : (t.sourceStore === assignedStore || t.destStore === assignedStore);
      const matchSearch =
        searchQuery === '' ||
        (t.transferNo && t.transferNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.productName && t.productName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.notes && t.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchStore && matchSearch;
    });
  }, [stockTransfers, storeFilter, searchQuery, currentUser.role, currentUser.store]);

  return (
    <SuperAdminGuard moduleName="Stock Transfers">
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

          {currentUser.role === 'Super Admin' && (
            <div className="flex items-center gap-2">
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="input-field text-xs py-2 px-3"
              >
                <optgroup label="Reporting Scope">
                  <option value="All Stores">All Stores (Consolidated Transfers)</option>
                </optgroup>
                <optgroup label="Physical Hubs & Stores">
                  {[...storesList]
                    .sort((a, b) => (a.code === 'CENTRAL' ? -1 : b.code === 'CENTRAL' ? 1 : a.code.localeCompare(b.code)))
                    .map((st) => (
                      <option key={st.id} value={st.code}>
                        {st.code === 'CENTRAL' ? 'COSKO Central Warehouse (CENTRAL)' : `${st.name} (${st.code})`}
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>
          )}
        </div>

        {/* Transfers Directory Table */}
        <div className="card overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-border/80 flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-foreground">Stock Transfer Manifests</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Authoritative inter-store movement records</p>
            </div>
            <span className="badge-neutral text-3xs font-semibold">{filteredTransfers.length} total transfers</span>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs min-w-[780px]">
              <thead>
                <tr className="table-header">
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
              <tbody className="divide-y divide-border/60 font-tabular">
                {filteredTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      No stock transfer records found.
                    </td>
                  </tr>
                ) : (
                  filteredTransfers.map((t: any) => (
                    <tr key={t.id || t.transferNo} className="table-row">
                      <td className="px-4 py-3 font-mono font-bold text-primary">{t.transferNo}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN') : 'Recent'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="badge-neutral text-3xs">{t.sourceStore}</span>
                          <Icon name="ArrowRightIcon" size={11} className="text-muted-foreground/70" />
                          <span className="badge-info text-3xs">{t.destStore}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-foreground">{t.totalUnits || t.qty}</td>
                      <td className="px-4 py-3 text-right font-extrabold text-foreground font-tabular">
                        {formatTransferINR(Number(t.totalTransferValue) !== undefined && !isNaN(Number(t.totalTransferValue)) && Number(t.totalTransferValue) > 0 ? Number(t.totalTransferValue) : ((Number(t.transferPrice) || 0) * (t.totalUnits || t.qty || 1)))}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold font-tabular ${getTransferProfitColorClass(Number(t.grossProfit) !== undefined && !isNaN(Number(t.grossProfit)) ? Number(t.grossProfit) : t.transferProfit)}`}>
                        {formatTransferINR(Number(t.grossProfit) !== undefined && !isNaN(Number(t.grossProfit)) ? Number(t.grossProfit) : (t.transferProfit || 0), { showPositiveSign: true })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={t.status === 'Cancelled' ? 'badge-danger text-3xs font-bold' : 'badge-success text-3xs font-bold'}>
                          {t.status || 'Received'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewModalTransfer(t)}
                            className="btn-secondary text-2xs py-1 px-2.5 h-7"
                          >
                            View Details
                          </button>
                          {currentUser.role === 'Super Admin' && t.status !== 'Cancelled' && (
                            <button
                              onClick={() => setCancelModalTransfer(t)}
                              className="btn-danger text-2xs py-1 px-2.5 h-7 font-bold"
                              title="Cancel Transfer & Reverse Inventory"
                            >
                              Cancel & Reverse
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Master Single Source of Truth Stock Transfer Modal */}
      <StockTransferModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        initialSourceStore={currentUser.role === 'Super Admin' ? 'CENTRAL' : currentUser.store}
        onSuccess={() => {
          setCreateModalOpen(false);
          refreshAllData();
        }}
      />

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
                <span className="font-tabular font-bold text-foreground">
                  {formatTransferINR(Number(viewModalTransfer.totalTransferValue) !== undefined && !isNaN(Number(viewModalTransfer.totalTransferValue)) && Number(viewModalTransfer.totalTransferValue) > 0 ? Number(viewModalTransfer.totalTransferValue) : ((Number(viewModalTransfer.transferPrice) || 0) * (viewModalTransfer.totalUnits || viewModalTransfer.qty || 1)))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Inventory Cost:</span>
                <span className="font-tabular font-bold text-foreground">
                  {formatTransferINR(Number(viewModalTransfer.totalCost) !== undefined && !isNaN(Number(viewModalTransfer.totalCost)) && Number(viewModalTransfer.totalCost) > 0 ? Number(viewModalTransfer.totalCost) : ((Number(viewModalTransfer.purchaseCost) || 0) * (viewModalTransfer.totalUnits || viewModalTransfer.qty || 1)))}
                </span>
              </div>
              <div className={`flex justify-between font-bold ${getTransferProfitColorClass(Number(viewModalTransfer.grossProfit) !== undefined && !isNaN(Number(viewModalTransfer.grossProfit)) ? Number(viewModalTransfer.grossProfit) : viewModalTransfer.transferProfit)}`}>
                <span>Gross Transfer Profit:</span>
                <span>
                  {formatTransferINR(Number(viewModalTransfer.grossProfit) !== undefined && !isNaN(Number(viewModalTransfer.grossProfit)) ? Number(viewModalTransfer.grossProfit) : (viewModalTransfer.transferProfit || 0), { showPositiveSign: true })}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div>
                {currentUser.role === 'Super Admin' && viewModalTransfer.status !== 'Cancelled' && (
                  <button
                    type="button"
                    onClick={() => {
                      setCancelModalTransfer(viewModalTransfer);
                    }}
                    className="btn-danger text-xs font-bold"
                  >
                    Cancel & Reverse Transfer
                  </button>
                )}
              </div>
              <button onClick={() => setViewModalTransfer(null)} className="btn-secondary text-xs">
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cancel Transfer Confirmation Modal */}
      {cancelModalTransfer && (
        <Modal
          open={!!cancelModalTransfer}
          onClose={() => !cancelLoading && setCancelModalTransfer(null)}
          title={`Cancel Transfer ${cancelModalTransfer.transferNo}?`}
          subtitle="Automatic stock restoration and inventory ledger reversal"
          size="sm"
        >
          <div className="space-y-4 py-2 text-xs">
            <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/30 text-foreground space-y-1.5">
              <div className="flex items-start gap-2">
                <Icon name="ExclamationTriangleIcon" size={18} className="text-danger shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm text-danger">Atomic Stock Reversal</p>
                  <p className="text-muted-foreground mt-1">
                    Cancelling this transfer will automatically return <strong>{cancelModalTransfer.totalUnits || cancelModalTransfer.qty} units</strong> back to <strong>{cancelModalTransfer.sourceStore}</strong> and deduct them from <strong>{cancelModalTransfer.destStore}</strong> in the root MySQL database.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                disabled={cancelLoading}
                onClick={() => setCancelModalTransfer(null)}
                className="btn-secondary text-xs"
              >
                Keep Transfer
              </button>
              <button
                type="button"
                disabled={cancelLoading}
                onClick={async () => {
                  setCancelLoading(true);
                  try {
                    await updateTransferStatus(cancelModalTransfer.id, 'Cancelled');
                    setCancelModalTransfer(null);
                    if (viewModalTransfer?.id === cancelModalTransfer.id) {
                      setViewModalTransfer(null);
                    }
                  } finally {
                    setCancelLoading(false);
                  }
                }}
                className="btn-danger text-xs font-bold px-4"
              >
                {cancelLoading ? 'Reversing Stock...' : 'Confirm Reversal'}
              </button>
            </div>
          </div>
        </Modal>
      )}


    </AppLayout>
    </SuperAdminGuard>
  );
}
