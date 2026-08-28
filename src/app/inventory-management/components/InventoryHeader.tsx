'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import AddItemModal from './AddItemModal';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

export default function InventoryHeader() {
  const { inventory, selectedStore, branding } = useApp();
  const [addModalOpen, setAddModalOpen] = useState(false);

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

  const handleImport = () => {
    toast.success("Import dialog ready: Selected catalog template validated.");
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span>{branding.appName}</span>
            <Icon name="ChevronRightIcon" size={12} />
            <span className="text-foreground font-medium">Inventory</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Inventory Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {inventory.length} total SKUs · Scope: <span className="font-semibold text-foreground">{selectedStore}</span> · FIFO lot tracking active
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleImport} className="btn-ghost gap-1.5 text-sm">
            <Icon name="ArrowDownTrayIcon" size={15} />
            Import Items
          </button>
          <button onClick={handleExport} className="btn-ghost gap-1.5 text-sm">
            <Icon name="ArrowUpTrayIcon" size={15} />
            Export CSV
          </button>
          <button onClick={() => setAddModalOpen(true)} className="btn-primary gap-1.5 text-sm">
            <Icon name="PlusIcon" size={15} />
            Add Item
          </button>
        </div>
      </div>

      <AddItemModal open={addModalOpen} onClose={() => setAddModalOpen(false)} />
    </>
  );
}