'use client';
import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { useApp } from '@/context/AppContext';

export default function InventorySummaryCards() {
  const { inventory, selectedStore } = useApp();

  const filteredItems = selectedStore === 'All Stores'
    ? inventory
    : inventory.filter((i) => i.store === selectedStore);

  const totalSKUs = filteredItems.length;
  const totalValue = filteredItems.reduce((acc, item) => acc + item.costPrice * item.qtyOnHand, 0);
  const lowStockCount = filteredItems.filter((item) => item.qtyOnHand > 0 && item.qtyOnHand <= item.reorderPt).length;
  const outOfStockCount = filteredItems.filter((item) => item.qtyOnHand === 0).length;

  const summaryCards = [
    {
      id: 'inv-sum-total',
      label: 'Total SKUs',
      value: totalSKUs.toLocaleString('en-IN'),
      sub: `Store Scope: ${selectedStore}`,
      icon: 'CubeIcon',
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      id: 'inv-sum-value',
      label: 'Inventory Value',
      value: `₹${totalValue.toLocaleString('en-IN')}`,
      sub: 'At cost (FIFO valuation)',
      icon: 'CurrencyRupeeIcon',
      color: 'text-info',
      bg: 'bg-info/10',
    },
    {
      id: 'inv-sum-low',
      label: 'Low Stock Items',
      value: lowStockCount.toString(),
      sub: 'Below reorder point threshold',
      icon: 'ExclamationTriangleIcon',
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
    {
      id: 'inv-sum-out',
      label: 'Out of Stock',
      value: outOfStockCount.toString(),
      sub: 'Needs immediate PO order',
      icon: 'XCircleIcon',
      color: 'text-danger',
      bg: 'bg-danger/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
      {summaryCards.map((card) => (
        <div key={card.id} className="card p-4 flex items-center gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${card.bg}`}>
            <Icon name={card.icon as Parameters<typeof Icon>[0]['name']} size={20} className={card.color} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</p>
            <p className="text-xl font-bold text-foreground font-tabular mt-0.5">{card.value}</p>
            <p className="text-2xs text-muted-foreground">{card.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}