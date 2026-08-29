'use client';
import React, { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { useApp } from '@/context/AppContext';

export default function CentralProfitPage() {
  const { stockTransfers, expenses, inventory, selectedStore } = useApp();

  const [dateFilter, setDateFilter] = useState('All Time');
  const [storeFilter, setStoreFilter] = useState('All Stores');
  const [searchRef, setSearchRef] = useState('');

  // 1. Filtered Transfers List
  const filteredTransfers = useMemo(() => {
    return stockTransfers.filter((t) => {
      const matchStore = storeFilter === 'All Stores' || t.destStore === storeFilter || t.sourceStore === storeFilter;
      const matchSearch = searchRef === '' || t.transferNo.toLowerCase().includes(searchRef.toLowerCase()) || t.productName.toLowerCase().includes(searchRef.toLowerCase()) || t.sku.toLowerCase().includes(searchRef.toLowerCase());
      return matchStore && matchSearch;
    });
  }, [stockTransfers, storeFilter, searchRef]);

  // 2. High-Level Central Profit KPIs
  const totalTransferRevenue = useMemo(() => filteredTransfers.reduce((acc, t) => acc + t.transferPrice * t.qty, 0), [filteredTransfers]);
  const totalInventoryCost = useMemo(() => filteredTransfers.reduce((acc, t) => acc + t.purchaseCost * t.qty, 0), [filteredTransfers]);
  const totalGrossTransferProfit = useMemo(() => filteredTransfers.reduce((acc, t) => acc + t.transferProfit, 0), [filteredTransfers]);
  
  // Central Expenses (Central Rent, Logistics, Central Salaries)
  const centralExpenses = useMemo(() => {
    return expenses
      .filter((e) => e.store === 'CENTRAL' || e.description.toLowerCase().includes('central') || e.category === 'Transport')
      .reduce((acc, e) => acc + e.amount, 0);
  }, [expenses]);

  const netCentralProfit = totalGrossTransferProfit - centralExpenses;
  const totalUnitsTransferred = useMemo(() => filteredTransfers.reduce((acc, t) => acc + t.qty, 0), [filteredTransfers]);
  const activeStoresCount = useMemo(() => new Set(filteredTransfers.map((t) => t.destStore)).size, [filteredTransfers]);

  // 3. Store Breakdown Calculations
  const storeBreakdown = useMemo(() => {
    const map: Record<string, { store: string; cost: number; revenue: number; profit: number }> = {};

    filteredTransfers.forEach((t) => {
      const dest = t.destStore;
      if (!map[dest]) {
        map[dest] = { store: dest, cost: 0, revenue: 0, profit: 0 };
      }
      const c = t.purchaseCost * t.qty;
      const r = t.transferPrice * t.qty;
      const p = t.transferProfit;
      map[dest].cost += c;
      map[dest].revenue += r;
      map[dest].profit += p;
    });

    return Object.values(map);
  }, [filteredTransfers]);

  // 4. Product Profitability Breakdown
  const productBreakdown = useMemo(() => {
    const map: Record<string, { name: string; sku: string; qty: number; cost: number; revenue: number; profit: number }> = {};

    filteredTransfers.forEach((t) => {
      const key = t.sku;
      if (!map[key]) {
        map[key] = { name: t.productName, sku: t.sku, qty: 0, cost: 0, revenue: 0, profit: 0 };
      }
      map[key].qty += t.qty;
      map[key].cost += t.purchaseCost * t.qty;
      map[key].revenue += t.transferPrice * t.qty;
      map[key].profit += t.transferProfit;
    });

    return Object.values(map);
  }, [filteredTransfers]);

  return (
    <AppLayout activeRoute="/central-profit">
      <div className="space-y-6 fade-in">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Central Profit</h1>
              <span className="badge-primary text-2xs uppercase tracking-wider">CENTRAL WAREHOUSE</span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Central inventory distribution, transfer revenue, transfer cost and operational profit across all stores.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} className="input-field text-xs py-2 px-3">
              <option value="All Stores">All Destination Stores</option>
              <option value="BLR">BLR (Bengaluru)</option>
              <option value="HYD">HYD (Hyderabad)</option>
              <option value="DEL">DEL (Delhi)</option>
              <option value="MUM">MUM (Mumbai)</option>
            </select>
          </div>
        </div>

        {/* 7 KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="card p-3">
            <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground block">Transfer Revenue</span>
            <p className="text-base font-bold text-foreground font-tabular mt-1">₹{totalTransferRevenue.toLocaleString('en-IN')}</p>
          </div>

          <div className="card p-3">
            <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground block">Inventory Cost</span>
            <p className="text-base font-bold text-info font-tabular mt-1">₹{totalInventoryCost.toLocaleString('en-IN')}</p>
          </div>

          <div className="card p-3">
            <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground block">Gross Profit</span>
            <p className="text-base font-bold text-success font-tabular mt-1">₹{totalGrossTransferProfit.toLocaleString('en-IN')}</p>
          </div>

          <div className="card p-3">
            <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground block">Central Expenses</span>
            <p className="text-base font-bold text-danger font-tabular mt-1">₹{centralExpenses.toLocaleString('en-IN')}</p>
          </div>

          <div className="card p-3 bg-primary/5 border-primary/20">
            <span className="text-3xs font-bold uppercase tracking-wider text-primary block">Net Central Profit</span>
            <p className={`text-base font-extrabold font-tabular mt-1 ${netCentralProfit >= 0 ? 'text-success' : 'text-danger'}`}>
              ₹{netCentralProfit.toLocaleString('en-IN')}
            </p>
          </div>

          <div className="card p-3">
            <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground block">Units Transferred</span>
            <p className="text-base font-bold text-foreground font-tabular mt-1">{totalUnitsTransferred} pcs</p>
          </div>

          <div className="card p-3">
            <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground block">Active Stores</span>
            <p className="text-base font-bold text-foreground font-tabular mt-1">{activeStoresCount} Outlets</p>
          </div>
        </div>

        {/* Store Profitability Breakdown Table */}
        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground">Store-wise Central Transfer Profit Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-tabular">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-2xs uppercase text-muted-foreground font-bold">
                  <th className="px-4 py-2.5">Destination Store</th>
                  <th className="px-4 py-2.5 text-right">Inventory Cost</th>
                  <th className="px-4 py-2.5 text-right">Transfer Value</th>
                  <th className="px-4 py-2.5 text-right">Gross Transfer Profit</th>
                  <th className="px-4 py-2.5 text-right">Gross Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {storeBreakdown.map((s) => {
                  const margin = s.revenue > 0 ? ((s.profit / s.revenue) * 100).toFixed(2) : '0.00';
                  return (
                    <tr key={`st-brk-${s.store}`} className="hover:bg-muted/40">
                      <td className="px-4 py-3 font-bold text-foreground">{s.store}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">₹{s.cost.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">₹{s.revenue.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right font-extrabold text-success">₹{s.profit.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right font-bold text-primary">{margin}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Product Profitability Breakdown Table */}
        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground">Product Transfer Profitability Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-tabular">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-2xs uppercase text-muted-foreground font-bold">
                  <th className="px-4 py-2.5">Product Name</th>
                  <th className="px-4 py-2.5">SKU</th>
                  <th className="px-4 py-2.5 text-right">Qty Transferred</th>
                  <th className="px-4 py-2.5 text-right">Inventory Cost</th>
                  <th className="px-4 py-2.5 text-right">Transfer Revenue</th>
                  <th className="px-4 py-2.5 text-right">Gross Transfer Profit</th>
                  <th className="px-4 py-2.5 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {productBreakdown.map((p) => {
                  const margin = p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(2) : '0.00';
                  return (
                    <tr key={`prod-brk-${p.sku}`} className="hover:bg-muted/40">
                      <td className="px-4 py-3 font-bold text-foreground">{p.name}</td>
                      <td className="px-4 py-3 font-mono text-2xs text-muted-foreground">{p.sku}</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">{p.qty}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">₹{p.cost.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">₹{p.revenue.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right font-extrabold text-success">₹{p.profit.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right font-bold text-primary">{margin}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailed Transfer History Table */}
        <div className="card p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-foreground">Detailed Central Stock Transfer Profit Log</h3>
            <div className="relative">
              <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search reference, product, or SKU..."
                value={searchRef}
                onChange={(e) => setSearchRef(e.target.value)}
                className="input-field pl-8 text-xs py-1.5 w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-tabular">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-2xs uppercase text-muted-foreground font-bold">
                  <th className="px-4 py-2.5">Transfer Ref #</th>
                  <th className="px-4 py-2.5">Date / Time</th>
                  <th className="px-4 py-2.5">Product</th>
                  <th className="px-4 py-2.5 text-right">Qty</th>
                  <th className="px-4 py-2.5 text-right">Unit Cost</th>
                  <th className="px-4 py-2.5 text-right">Transfer Price</th>
                  <th className="px-4 py-2.5">Destination</th>
                  <th className="px-4 py-2.5 text-right">Transfer Value</th>
                  <th className="px-4 py-2.5 text-right">Gross Profit</th>
                  <th className="px-4 py-2.5">Created By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTransfers.map((t) => (
                  <tr key={`trans-row-${t.id}`} className="hover:bg-muted/40">
                    <td className="px-4 py-3 font-mono text-2xs font-bold text-primary">{t.transferNo}</td>
                    <td className="px-4 py-3 text-2xs text-muted-foreground">{t.createdAt}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{t.productName} <span className="text-3xs text-muted-foreground font-mono">({t.sku})</span></td>
                    <td className="px-4 py-3 text-right font-bold">{t.qty}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">₹{t.purchaseCost}</td>
                    <td className="px-4 py-3 text-right font-bold">₹{t.transferPrice}</td>
                    <td className="px-4 py-3"><span className="badge-info text-3xs">{t.destStore}</span></td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">₹{(t.transferPrice * t.qty).toLocaleString('en-IN')}</td>
                    <td className={`px-4 py-3 text-right font-extrabold ${t.transferProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                      ₹{t.transferProfit.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-2xs text-muted-foreground">{t.createdBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
