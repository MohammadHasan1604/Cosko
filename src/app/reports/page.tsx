'use client';
import React, { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

export default function ReportsPage() {
  const { inventory, sales, purchases, vendors, usersList, selectedStore } = useApp();
  const [activeTab, setActiveTab] = useState<'overview' | 'suppliers' | 'products' | 'employees'>('overview');

  const filteredSales = useMemo(() => {
    return sales.filter((s) => selectedStore === 'All Stores' || s.store === selectedStore);
  }, [sales, selectedStore]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => selectedStore === 'All Stores' || p.store === selectedStore);
  }, [purchases, selectedStore]);

  const totalInvValue = useMemo(() => inventory.reduce((acc, i) => acc + i.costPrice * i.qtyOnHand, 0), [inventory]);
  const totalInvSelling = useMemo(() => inventory.reduce((acc, i) => acc + i.sellingPrice * i.qtyOnHand, 0), [inventory]);
  const totalRevenue = useMemo(() => filteredSales.reduce((acc, s) => acc + s.total, 0), [filteredSales]);
  
  const totalGrossProfit = useMemo(() => {
    return filteredSales.reduce((acc, s) => {
      const saleCost = s.items.reduce((iAcc, it) => {
        const inv = inventory.find((i) => i.id === it.itemId || i.name === it.name);
        const cost = inv ? inv.costPrice : Math.round(it.unitPrice * 0.7);
        return iAcc + cost * it.qty;
      }, 0);
      return acc + (s.subtotal - saleCost);
    }, 0);
  }, [filteredSales, inventory]);

  // Supplier analytics breakdown
  const supplierAnalytics = useMemo(() => {
    return vendors.map((v) => {
      const pos = purchases.filter((p) => p.vendorName === v.name);
      const totalSpend = pos.reduce((acc, p) => acc + p.totalAmount, 0);
      const paid = pos.filter((p) => p.paymentStatus === 'Paid').reduce((acc, p) => acc + p.totalAmount, 0);
      const pending = totalSpend - paid;
      const totalUnits = pos.reduce((acc, p) => acc + p.items.reduce((iAcc, item) => iAcc + item.qty, 0), 0);
      const avgUnitPrice = totalUnits > 0 ? totalSpend / totalUnits : 0;
      return {
        vendor: v,
        totalOrders: pos.length,
        totalUnits,
        totalSpend,
        paid,
        pending,
        avgUnitPrice,
      };
    });
  }, [vendors, purchases]);

  // Best-selling products rollup
  const bestSellingProducts = useMemo(() => {
    const map = new Map<string, { name: string; sku: string; unitsSold: number; revenue: number; grossProfit: number }>();
    for (const sale of filteredSales) {
      for (const it of sale.items) {
        const key = it.itemId || it.name;
        const existing = map.get(key) || { name: it.name, sku: it.sku || 'N/A', unitsSold: 0, revenue: 0, grossProfit: 0 };
        const lineRev = it.unitPrice * it.qty;
        const invItem = inventory.find((i) => i.id === it.itemId || i.name === it.name);
        const unitCost = invItem?.costPrice || (it.unitPrice * 0.7);
        const lineCost = unitCost * it.qty;
        existing.unitsSold += it.qty;
        existing.revenue += lineRev;
        existing.grossProfit += (lineRev - lineCost);
        map.set(key, existing);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, inventory]);

  // Employee sales performance rollup
  const employeePerformance = useMemo(() => {
    const map = new Map<string, { name: string; store: string; invoices: number; revenue: number; grossProfit: number; customers: Set<string> }>();
    for (const sale of filteredSales) {
      const empName = (sale as any).cashierName || 'Sales Staff';
      const saleCost = sale.items.reduce((iAcc, it) => {
        const inv = inventory.find((i) => i.id === it.itemId || i.name === it.name);
        const cost = inv ? inv.costPrice : Math.round(it.unitPrice * 0.7);
        return iAcc + cost * it.qty;
      }, 0);
      const saleProfit = sale.subtotal - saleCost;
      const existing = map.get(empName) || { name: empName, store: sale.store, invoices: 0, revenue: 0, grossProfit: 0, customers: new Set<string>() };
      existing.invoices += 1;
      existing.revenue += sale.total;
      existing.grossProfit += saleProfit;
      if (sale.customerPhone) existing.customers.add(sale.customerPhone);
      map.set(empName, existing);
    }
    return Array.from(map.values()).map((e) => ({
      ...e,
      customerCount: e.customers.size,
      avgInvoiceValue: e.invoices > 0 ? e.revenue / e.invoices : 0,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, inventory]);

  const handleDownload = (reportName: string) => {
    toast.success(`Generated and downloaded ${reportName} (${selectedStore}) as CSV/PDF`);
  };

  return (
    <AppLayout activeRoute="/reports">
      <div className="space-y-6 fade-in">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Executive Analytics & Reports</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Consolidated sales performance, supplier procurement, product profitability, and employee tracking.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => handleDownload('Executive Summary Report')} className="btn-primary text-xs gap-1.5 py-2">
              <Icon name="ArrowDownTrayIcon" size={14} /> Export All Reports
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-border pb-1 overflow-x-auto">
          {[
            { id: 'overview', label: 'Executive Overview', icon: 'ChartBarIcon' },
            { id: 'suppliers', label: 'Supplier Procurement', icon: 'TruckIcon' },
            { id: 'products', label: 'Best-Selling Products', icon: 'CubeIcon' },
            { id: 'employees', label: 'Employee Productivity', icon: 'UserGroupIcon' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Icon name={tab.icon as any} size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card p-4 space-y-1">
                <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Total Sales Revenue</span>
                <p className="text-2xl font-extrabold text-foreground font-tabular">₹{totalRevenue.toLocaleString('en-IN')}</p>
                <span className="badge-success text-3xs">{filteredSales.length} Invoices</span>
              </div>

              <div className="card p-4 space-y-1">
                <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Gross Trading Profit</span>
                <p className="text-2xl font-extrabold text-success font-tabular">₹{totalGrossProfit.toLocaleString('en-IN')}</p>
                <span className="text-2xs text-muted-foreground font-tabular">Margin: {totalRevenue > 0 ? ((totalGrossProfit / totalRevenue) * 100).toFixed(1) : 0}%</span>
              </div>

              <div className="card p-4 space-y-1">
                <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Inventory Cost (FIFO)</span>
                <p className="text-2xl font-extrabold text-foreground font-tabular">₹{totalInvValue.toLocaleString('en-IN')}</p>
                <span className="text-2xs text-muted-foreground">{inventory.length} active SKUs</span>
              </div>

              <div className="card p-4 space-y-1">
                <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Total Retail Value</span>
                <p className="text-2xl font-extrabold text-info font-tabular">₹{totalInvSelling.toLocaleString('en-IN')}</p>
                <span className="badge-info text-3xs">Potential: ₹{(totalInvSelling - totalInvValue).toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Quick Report Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
                  <span className="text-2xs font-mono text-muted-foreground">{filteredSales.length} transactions</span>
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
        )}

        {/* Suppliers Tab */}
        {activeTab === 'suppliers' && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Supplier Procurement & Payables Summary</h3>
                <p className="text-xs text-muted-foreground">Total purchase volumes, average prices, and payable balances per supplier.</p>
              </div>
              <button onClick={() => handleDownload('Supplier Procurement Summary')} className="btn-secondary text-xs gap-1.5 py-1.5">
                <Icon name="ArrowDownTrayIcon" size={14} /> Export CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                    <th className="px-4 py-3">Supplier Name</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3 text-right">Orders</th>
                    <th className="px-4 py-3 text-right">Units Purchased</th>
                    <th className="px-4 py-3 text-right">Avg Unit Price</th>
                    <th className="px-4 py-3 text-right">Total Purchases</th>
                    <th className="px-4 py-3 text-right">Amount Paid</th>
                    <th className="px-4 py-3 text-right">Amount Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {supplierAnalytics.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                        No supplier procurement records found.
                      </td>
                    </tr>
                  ) : (
                    supplierAnalytics.map((s) => (
                      <tr key={s.vendor.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3 font-bold text-foreground">{s.vendor.name}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono">{s.vendor.phone}</td>
                        <td className="px-4 py-3 text-right font-tabular">{s.totalOrders}</td>
                        <td className="px-4 py-3 text-right font-tabular">{s.totalUnits.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right font-tabular">₹{s.avgUnitPrice.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-bold text-foreground font-tabular">₹{s.totalSpend.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right font-tabular text-success font-semibold">₹{s.paid.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right font-tabular text-danger font-semibold">₹{s.pending.toLocaleString('en-IN')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Top-Selling & Most Profitable Products</h3>
                <p className="text-xs text-muted-foreground">Rankings by total units sold, gross revenue, and gross profit contribution.</p>
              </div>
              <button onClick={() => handleDownload('Best-Selling Products Report')} className="btn-secondary text-xs gap-1.5 py-1.5">
                <Icon name="ArrowDownTrayIcon" size={14} /> Export CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3 text-right">Units Sold</th>
                    <th className="px-4 py-3 text-right">Gross Revenue</th>
                    <th className="px-4 py-3 text-right">Gross Profit</th>
                    <th className="px-4 py-3 text-right">Gross Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {bestSellingProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No product sales recorded yet.
                      </td>
                    </tr>
                  ) : (
                    bestSellingProducts.map((p, idx) => (
                      <tr key={`best-prod-${idx}`} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3 font-bold text-foreground">{p.name}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-2xs">{p.sku}</td>
                        <td className="px-4 py-3 text-right font-tabular font-bold">{p.unitsSold}</td>
                        <td className="px-4 py-3 text-right font-tabular font-bold text-foreground">₹{p.revenue.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right font-tabular font-bold text-success">₹{p.grossProfit.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right font-tabular text-muted-foreground">{p.revenue > 0 ? ((p.grossProfit / p.revenue) * 100).toFixed(1) : 0}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Employees Tab */}
        {activeTab === 'employees' && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Employee Sales & Productivity Report</h3>
                <p className="text-xs text-muted-foreground">Performance metrics per employee across stores.</p>
              </div>
              <button onClick={() => handleDownload('Employee Performance Report')} className="btn-secondary text-xs gap-1.5 py-1.5">
                <Icon name="ArrowDownTrayIcon" size={14} /> Export CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                    <th className="px-4 py-3">Employee Name</th>
                    <th className="px-4 py-3">Assigned Store</th>
                    <th className="px-4 py-3 text-right">Invoices Created</th>
                    <th className="px-4 py-3 text-right">Customers Served</th>
                    <th className="px-4 py-3 text-right">Average Order Value</th>
                    <th className="px-4 py-3 text-right">Total Revenue</th>
                    <th className="px-4 py-3 text-right">Gross Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {employeePerformance.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        No employee sales transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    employeePerformance.map((emp, idx) => (
                      <tr key={`emp-perf-${idx}`} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3 font-bold text-foreground">{emp.name}</td>
                        <td className="px-4 py-3"><span className="badge-info text-3xs">{emp.store}</span></td>
                        <td className="px-4 py-3 text-right font-tabular font-bold">{emp.invoices}</td>
                        <td className="px-4 py-3 text-right font-tabular">{emp.customerCount}</td>
                        <td className="px-4 py-3 text-right font-tabular">₹{emp.avgInvoiceValue.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-tabular font-bold text-foreground">₹{emp.revenue.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right font-tabular font-bold text-success">₹{emp.grossProfit.toLocaleString('en-IN')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
