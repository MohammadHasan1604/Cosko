import React from 'react';
import AppLayout from '@/components/AppLayout';
import InventoryHeader from './components/InventoryHeader';
import InventorySummaryCards from './components/InventorySummaryCards';
import InventoryTable from './components/InventoryTable';

export default function InventoryManagementPage() {
  return (
    <AppLayout activeRoute="/inventory-management">
      <div className="space-y-6 fade-in">
        <InventoryHeader />
        <InventorySummaryCards />
        <InventoryTable />
      </div>
    </AppLayout>
  );
}