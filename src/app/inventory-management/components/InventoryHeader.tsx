'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import AddItemModal from './AddItemModal';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

export default function InventoryHeader() {
  const { inventory, inventoryLedger, selectedStore, branding } = useApp();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["SKU,Name,Brand,Category,Store,QtyOnHand,CostPrice,SellingPrice"]
        .concat(inventory.map(i => `${i.sku},"${i.name}",${i.brand},${i.category},${i.store},${i.qtyOnHand},${i.costPrice},${i.sellingPrice}`))
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventory_export_${selectedStore}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Inventory exported as CSV");
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span>{branding.appName}</span>
            <Icon name="ChevronRightIcon" size={12} />
            <span className="text-foreground font-medium">Central & Store Inventory</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Inventory & Movement Ledger</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {inventory.length} total SKUs · Active Scope: <span className="font-semibold text-foreground">{selectedStore}</span> · Central Stock & FIFO Lot tracking
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setLedgerModalOpen(true)} className="btn-secondary gap-1.5 text-xs sm:text-sm">
            <Icon name="QueueListIcon" size={15} />
            Movement Ledger ({inventoryLedger.length})
          </button>
          <button onClick={handleExport} className="btn-ghost gap-1.5 text-xs sm:text-sm">
            <Icon name="ArrowUpTrayIcon" size={15} />
            Export CSV
          </button>
          <button onClick={() => setAddModalOpen(true)} className="btn-primary gap-1.5 text-xs sm:text-sm">
            <Icon name="PlusIcon" size={15} />
            Add Product
          </button>
        </div>
      </div>

      <AddItemModal open={addModalOpen} onClose={() => setAddModalOpen(false)} />

      {/* Complete Movement Ledger Modal */}
      <Modal
        open={ledgerModalOpen}
        onClose={() => setLedgerModalOpen(false)}
        title="Inventory Movement Ledger History"
        subtitle="Complete audit trail of Purchases, Stock Transfers, POS Sales, and Stock Adjustments"
        size="lg"
      >
        <div className="space-y-4 py-2">
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-bold uppercase text-muted-foreground">
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Movement Type</th>
                  <th className="px-3 py-2">Product / SKU</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 font-tabular text-right">Unit Value</th>
                  <th className="px-3 py-2">Ref / User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-tabular">
                {inventoryLedger.map((entry) => (
                  <tr key={`led-row-${entry.id}`} className="hover:bg-muted/30">
                    <td className="px-3 py-2 text-3xs text-muted-foreground whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-3xs font-bold ${
                        entry.movementType === 'PURCHASE' ? 'bg-success/15 text-success' :
                        entry.movementType === 'TRANSFER_IN' ? 'bg-info/15 text-info' :
                        entry.movementType === 'TRANSFER_OUT' ? 'bg-warning/15 text-warning' :
                        entry.movementType === 'SALE' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        {entry.movementType}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-semibold text-foreground">{entry.productName} <span className="text-3xs text-muted-foreground font-mono">({entry.sku})</span></td>
                    <td className="px-3 py-2 font-bold text-foreground">{entry.storeCode}</td>
                    <td className={`px-3 py-2 text-right font-extrabold ${entry.quantity > 0 ? 'text-success' : 'text-danger'}`}>
                      {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                    </td>
                    <td className="px-3 py-2 text-right">₹{entry.unitCost}</td>
                    <td className="px-3 py-2 text-3xs text-muted-foreground">
                      <p className="font-mono text-foreground">{entry.referenceNo}</p>
                      <p>{entry.createdBy}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end pt-2 border-t border-border">
            <button onClick={() => setLedgerModalOpen(false)} className="btn-primary text-xs py-1.5 px-4">
              Close Ledger
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}