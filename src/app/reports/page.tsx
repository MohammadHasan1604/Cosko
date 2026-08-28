'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

export default function ReportsPage() {
  const { inventory, sales, selectedStore } = useApp();

  const handleDownload = (reportName: string) => {
    toast.success(`Generated and downloaded ${reportName} (${selectedStore}) as PDF/Excel`);
  };

  const totalInvValue = inventory.reduce((acc, i) => acc + i.costPrice * i.qtyOnHand, 0);
  const totalInvSelling = inventory.reduce((acc, i) => acc + i.sellingPrice * i.qtyOnHand, 0);

  return (
    <AppLayout activeRoute="/reports">
      <div className="space-y-6 fade-in">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Executive Analytics & Reports</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sales performance, inventory valuation, ABC analysis, profit margins, and export center.
            </p>
          </div>
        </div>

        {/* Report Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="card p-5 space-y-3 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                <Icon name="ChartBarIcon" size={20} />
              </div>
              <h3 className="text-base font-bold text-foreground">Sales Performance Report</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Detailed breakdown of sales transactions by store, payment method, and product category.
              </p>
            </div>
            <div className="pt-3 border-t border-border flex items-center justify-between">
              <span className="text-2xs font-mono text-muted-foreground">{sales.length} transactions</span>
              <button onClick={() => handleDownload('Sales Performance Report')} className="btn-primary text-xs gap-1.5 py-1.5">
                <Icon name="ArrowDownTrayIcon" size={14} /> Download PDF
              </button>
            </div>
          </div>

          <div className="card p-5 space-y-3 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-info/10 text-info flex items-center justify-center mb-3">
                <Icon name="CubeIcon" size={20} />
              </div>
              <h3 className="text-base font-bold text-foreground">Inventory Valuation (FIFO)</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Cost value (₹{totalInvValue.toLocaleString('en-IN')}) vs Retail selling value (₹{totalInvSelling.toLocaleString('en-IN')}).
              </p>
            </div>
            <div className="pt-3 border-t border-border flex items-center justify-between">
              <span className="text-2xs font-mono text-muted-foreground">{inventory.length} SKUs</span>
              <button onClick={() => handleDownload('Inventory Valuation Report')} className="btn-primary text-xs gap-1.5 py-1.5">
                <Icon name="ArrowDownTrayIcon" size={14} /> Export CSV
              </button>
            </div>
          </div>

          <div className="card p-5 space-y-3 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center mb-3">
                <Icon name="ExclamationTriangleIcon" size={20} />
              </div>
              <h3 className="text-base font-bold text-foreground">ABC & Velocity Analysis</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Classification of fast-moving Class A high revenue items vs slow-moving Class C stock.
              </p>
            </div>
            <div className="pt-3 border-t border-border flex items-center justify-between">
              <span className="text-2xs font-mono text-muted-foreground">Updated Today</span>
              <button onClick={() => handleDownload('ABC Inventory Analysis')} className="btn-primary text-xs gap-1.5 py-1.5">
                <Icon name="ArrowDownTrayIcon" size={14} /> Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
