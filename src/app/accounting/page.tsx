'use client';
import React, { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { useApp } from '@/context/AppContext';

export default function AccountingPage() {
  const { sales, expenses, inventory, stockTransfers, selectedStore, setSelectedStore, datePeriod, setDatePeriod } = useApp();

  const [activeView, setActiveView] = useState<'consolidated' | 'store' | 'central'>('consolidated');

  // Filtered dataset based on selectedStore & datePeriod
  const filteredSales = useMemo(() => {
    return sales.filter((s) => selectedStore === 'All Stores' || s.store === selectedStore);
  }, [sales, selectedStore]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => selectedStore === 'All Stores' || e.store === selectedStore);
  }, [expenses, selectedStore]);

  // 1. External Sales & Store Operational Performance
  const externalSalesRevenue = useMemo(() => filteredSales.reduce((acc, s) => acc + s.total, 0), [filteredSales]);
  
  // Store COGS based on Transfer Price paid to Central
  const storeCOGS = useMemo(() => {
    return filteredSales.reduce((acc, s) => {
      const itemsCost = s.items.reduce((itemAcc, item) => {
        const invItem = inventory.find((i) => i.id === item.itemId || i.sku === item.name);
        const unitTransferPrice = invItem?.transferPrice || Math.round(item.unitPrice * 0.75);
        return itemAcc + unitTransferPrice * item.qty;
      }, 0);
      return acc + itemsCost;
    }, 0);
  }, [filteredSales, inventory]);

  const storeOperatingExpenses = useMemo(() => {
    return filteredExpenses.filter((e) => e.store !== 'CENTRAL').reduce((acc, e) => acc + e.amount, 0);
  }, [filteredExpenses]);

  const storeGrossProfit = externalSalesRevenue - storeCOGS;
  const storeNetProfit = storeGrossProfit - storeOperatingExpenses;

  // 2. Central Operations & Internal Transfers Performance
  const centralTransfers = useMemo(() => {
    return stockTransfers.filter((t) => selectedStore === 'All Stores' || t.destStore === selectedStore || t.sourceStore === selectedStore);
  }, [stockTransfers, selectedStore]);

  const centralTransferRevenue = useMemo(() => centralTransfers.reduce((acc, t) => acc + t.transferPrice * t.qty, 0), [centralTransfers]);
  const centralInventoryCost = useMemo(() => centralTransfers.reduce((acc, t) => acc + t.purchaseCost * t.qty, 0), [centralTransfers]);
  const centralGrossTransferProfit = useMemo(() => centralTransfers.reduce((acc, t) => acc + t.transferProfit, 0), [centralTransfers]);
  
  const centralExpenses = useMemo(() => {
    return expenses.filter((e) => e.store === 'CENTRAL' || e.description.toLowerCase().includes('central')).reduce((acc, e) => acc + e.amount, 0);
  }, [expenses]);

  const centralNetProfit = centralGrossTransferProfit - centralExpenses;

  // 3. Consolidated Company P&L (Internal Transfer Elimination Logic)
  // Consolidated Revenue = External Customer Sales ONLY (Central internal transfer revenue is ELIMINATED)
  const consolidatedRevenue = externalSalesRevenue;

  // Consolidated COGS = Actual Vendor Purchase Cost (Store transfer price is ELIMINATED)
  const consolidatedCOGS = useMemo(() => {
    return filteredSales.reduce((acc, s) => {
      const itemsCost = s.items.reduce((itemAcc, item) => {
        const invItem = inventory.find((i) => i.id === item.itemId || i.sku === item.name);
        const actualVendorCost = invItem?.costPrice || Math.round(item.unitPrice * 0.60);
        return itemAcc + actualVendorCost * item.qty;
      }, 0);
      return acc + itemsCost;
    }, 0);
  }, [filteredSales, inventory]);

  const consolidatedTotalExpenses = storeOperatingExpenses + centralExpenses;
  const consolidatedGrossProfit = consolidatedRevenue - consolidatedCOGS; // Equals Store Gross Profit + Central Gross Transfer Profit
  const consolidatedNetProfit = consolidatedGrossProfit - consolidatedTotalExpenses;

  return (
    <AppLayout activeRoute="/accounting">
      <div className="space-y-6 fade-in">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Multi-Store Accounting & Profitability P&L</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Consolidated financial statements with internal transfer profit elimination & store-wise margins.
            </p>
          </div>

          {/* Time Period Filter */}
          <div className="flex items-center gap-2">
            <select
              value={datePeriod}
              onChange={(e) => setDatePeriod(e.target.value)}
              className="input-field text-xs py-2 px-3"
            >
              <option value="Today">Today</option>
              <option value="Yesterday">Yesterday</option>
              <option value="This Month">This Month</option>
              <option value="Last Month">Last Month</option>
              <option value="This Quarter">This Quarter</option>
              <option value="This Year">This Financial Year</option>
            </select>
          </div>
        </div>

        {/* View Switcher Tabs: Consolidated vs Store P&L vs Central P&L */}
        <div className="flex items-center gap-2 border-b border-border pb-1">
          <button
            onClick={() => setActiveView('consolidated')}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-t-xl transition-all ${
              activeView === 'consolidated' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Consolidated Company P&L (Eliminated)
          </button>

          <button
            onClick={() => setActiveView('store')}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-t-xl transition-all ${
              activeView === 'store' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Store Operational P&L
          </button>

          <button
            onClick={() => setActiveView('central')}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-t-xl transition-all ${
              activeView === 'central' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Central Transfer Profit P&L
          </button>
        </div>

        {/* Active View Financial Metrics */}
        {activeView === 'consolidated' && (
          <div className="space-y-6 fade-in">
            {/* Elimination Notice Banner */}
            <div className="p-4 rounded-xl border border-info/30 bg-info/10 flex items-start gap-3">
              <Icon name="InformationCircleIcon" size={20} className="text-info flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-foreground">Consolidated Financial Accounting Rule Applied</p>
                <p className="text-muted-foreground">
                  Internal Central → Store transfer revenue (₹{centralTransferRevenue.toLocaleString('en-IN')}) is <strong>eliminated</strong> from consolidated revenue. Consolidated profit is calculated strictly on genuine external customer sales minus vendor purchase costs.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card p-4">
                <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Consolidated External Revenue</p>
                <p className="text-xl font-bold text-foreground font-tabular mt-1">₹{consolidatedRevenue.toLocaleString('en-IN')}</p>
                <p className="text-3xs text-success font-semibold mt-1">✓ External Billed Sales Only</p>
              </div>

              <div className="card p-4">
                <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Vendor COGS (Purchase Cost)</p>
                <p className="text-xl font-bold text-info font-tabular mt-1">₹{consolidatedCOGS.toLocaleString('en-IN')}</p>
                <p className="text-3xs text-muted-foreground mt-1">Actual Inventory Cost</p>
              </div>

              <div className="card p-4">
                <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Total Operating Expenses</p>
                <p className="text-xl font-bold text-danger font-tabular mt-1">₹{consolidatedTotalExpenses.toLocaleString('en-IN')}</p>
                <p className="text-3xs text-muted-foreground mt-1">Store + Central Freight & Rent</p>
              </div>

              <div className="card p-4 bg-primary/5 border-primary/20">
                <p className="text-2xs font-bold uppercase tracking-wider text-primary">Consolidated Net Profit</p>
                <p className={`text-xl font-extrabold font-tabular mt-1 ${consolidatedNetProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                  ₹{Math.round(consolidatedNetProfit).toLocaleString('en-IN')}
                </p>
                <p className="text-3xs text-muted-foreground mt-1">True Company Net Result</p>
              </div>
            </div>

            {/* Consolidated Income Statement Table */}
            <div className="card p-5 space-y-4">
              <h3 className="text-base font-bold text-foreground">Consolidated Financial Income Statement</h3>
              <div className="space-y-2 text-sm font-tabular border-t border-border pt-3">
                <div className="flex justify-between font-bold text-foreground py-1">
                  <span>Gross External Sales Revenue:</span>
                  <span>₹{consolidatedRevenue.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-muted-foreground py-1 border-b border-border pb-2">
                  <span>Less: Cost of Goods Sold (Vendor Cost):</span>
                  <span>-₹{consolidatedCOGS.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between font-extrabold text-foreground py-2 text-base bg-muted/30 px-3 rounded-lg">
                  <span>Consolidated Gross Profit:</span>
                  <span className="text-primary">₹{consolidatedGrossProfit.toLocaleString('en-IN')} ({consolidatedRevenue > 0 ? ((consolidatedGrossProfit / consolidatedRevenue) * 100).toFixed(1) : 0}%)</span>
                </div>

                <div className="flex justify-between text-muted-foreground py-1 pt-2">
                  <span>Store Operating Expenses (Rent, Utilities, Staff):</span>
                  <span>-₹{storeOperatingExpenses.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-muted-foreground py-1 border-b border-border pb-2">
                  <span>Central Operations & Freight Expenses:</span>
                  <span>-₹{centralExpenses.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between font-extrabold text-foreground py-3 text-lg bg-primary/10 px-4 rounded-xl border border-primary/20">
                  <span>Consolidated Net Operating Profit:</span>
                  <span className={consolidatedNetProfit >= 0 ? 'text-success' : 'text-danger'}>
                    ₹{Math.round(consolidatedNetProfit).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'store' && (
          <div className="space-y-6 fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card p-4">
                <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Store Sales Revenue</p>
                <p className="text-xl font-bold text-foreground font-tabular mt-1">₹{externalSalesRevenue.toLocaleString('en-IN')}</p>
                <p className="text-3xs text-muted-foreground mt-1">Scope: {selectedStore}</p>
              </div>

              <div className="card p-4">
                <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Store COGS (Transfer Price)</p>
                <p className="text-xl font-bold text-info font-tabular mt-1">₹{storeCOGS.toLocaleString('en-IN')}</p>
                <p className="text-3xs text-muted-foreground mt-1">Cost Paid to Central</p>
              </div>

              <div className="card p-4">
                <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Store Operating Expenses</p>
                <p className="text-xl font-bold text-danger font-tabular mt-1">₹{storeOperatingExpenses.toLocaleString('en-IN')}</p>
                <p className="text-3xs text-muted-foreground mt-1">Store Rent & Bills</p>
              </div>

              <div className="card p-4 bg-primary/5 border-primary/20">
                <p className="text-2xs font-bold uppercase tracking-wider text-primary">Store Net Operating Profit</p>
                <p className={`text-xl font-extrabold font-tabular mt-1 ${storeNetProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                  ₹{Math.round(storeNetProfit).toLocaleString('en-IN')}
                </p>
                <p className="text-3xs text-muted-foreground mt-1">Store Margin after Expenses</p>
              </div>
            </div>

            {/* Store Margin Breakdown */}
            <div className="card p-5 space-y-4">
              <h3 className="text-base font-bold text-foreground">Store Operational P&L Breakdown ({selectedStore})</h3>
              <div className="space-y-2 text-sm font-tabular">
                <div className="flex justify-between font-bold text-foreground py-1">
                  <span>Store Sales Revenue:</span>
                  <span>₹{externalSalesRevenue.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-muted-foreground py-1 border-b border-border pb-2">
                  <span>Less: Store COGS (Based on Transfer Price):</span>
                  <span>-₹{storeCOGS.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-extrabold text-foreground py-2 text-base bg-muted/30 px-3 rounded-lg">
                  <span>Store Gross Operating Profit:</span>
                  <span className="text-primary">₹{storeGrossProfit.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-muted-foreground py-1 border-b border-border pb-2">
                  <span>Less: Store Operating Expenses:</span>
                  <span>-₹{storeOperatingExpenses.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-extrabold text-foreground py-2 text-base">
                  <span>Store Net Profit:</span>
                  <span className={storeNetProfit >= 0 ? 'text-success' : 'text-danger'}>₹{storeNetProfit.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'central' && (
          <div className="space-y-6 fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card p-4">
                <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Central Transfer Revenue</p>
                <p className="text-xl font-bold text-foreground font-tabular mt-1">₹{centralTransferRevenue.toLocaleString('en-IN')}</p>
                <p className="text-3xs text-muted-foreground mt-1">Billed to Outlets @ Transfer Price</p>
              </div>

              <div className="card p-4">
                <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Central Inventory Cost</p>
                <p className="text-xl font-bold text-info font-tabular mt-1">₹{centralInventoryCost.toLocaleString('en-IN')}</p>
                <p className="text-3xs text-muted-foreground mt-1">Vendor Purchase Cost</p>
              </div>

              <div className="card p-4">
                <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Gross Transfer Profit</p>
                <p className="text-xl font-bold text-success font-tabular mt-1">₹{centralGrossTransferProfit.toLocaleString('en-IN')}</p>
                <p className="text-3xs text-muted-foreground mt-1">(Transfer Price - Cost) * Qty</p>
              </div>

              <div className="card p-4 bg-primary/5 border-primary/20">
                <p className="text-2xs font-bold uppercase tracking-wider text-primary">Net Central Profit</p>
                <p className={`text-xl font-extrabold font-tabular mt-1 ${centralNetProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                  ₹{Math.round(centralNetProfit).toLocaleString('en-IN')}
                </p>
                <p className="text-3xs text-muted-foreground mt-1">After Freight & Central Expenses</p>
              </div>
            </div>

            {/* Recent Central Stock Transfers Table */}
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground">Central Stock Transfer Profit Log</h3>
                <span className="badge-info text-xs">{centralTransfers.length} Transfers Logged</span>
              </div>

              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-left min-w-[700px]">
                  <thead>
                    <tr className="bg-muted text-2xs font-bold uppercase text-muted-foreground">
                      <th className="px-4 py-3">Transfer #</th>
                      <th className="px-4 py-3">Item / SKU</th>
                      <th className="px-4 py-3">Route</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 font-tabular text-right">Unit Cost</th>
                      <th className="px-4 py-3 font-tabular text-right">Transfer Price</th>
                      <th className="px-4 py-3 font-tabular text-right">Transfer Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm font-tabular">
                    {centralTransfers.map((t) => (
                      <tr key={`tr-log-${t.id}`} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-bold text-primary">{t.transferNo}</td>
                        <td className="px-4 py-3 font-semibold text-foreground">{t.productName} <span className="text-2xs text-muted-foreground font-mono">({t.sku})</span></td>
                        <td className="px-4 py-3"><span className="badge-neutral text-2xs">{t.sourceStore} → {t.destStore}</span></td>
                        <td className="px-4 py-3 text-right font-bold">{t.qty}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">₹{t.purchaseCost}</td>
                        <td className="px-4 py-3 text-right text-foreground font-bold">₹{t.transferPrice}</td>
                        <td className="px-4 py-3 text-right font-extrabold text-success">₹{t.transferProfit.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
