'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import Icon from '@/components/ui/AppIcon';

type DateFilterType = 'Today' | 'Yesterday' | 'Week' | 'Month' | 'Financial Year' | 'Custom';

export default function StoreSalesRanking() {
  const { sales, storesList, customers } = useApp();
  const [activeTab, setActiveTab] = useState<'stores' | 'customers'>('stores');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('Month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Authoritative date range calculation
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    // Indian Financial Year: April 1 to March 31
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed (3 = April)
    const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    const fyStart = new Date(fyStartYear, 3, 1).getTime();

    return sales.filter((sale) => {
      // Exclude refunded or non-completed sales
      if (sale.status === 'Refunded') return false;

      // Parse sale creation date
      let saleTime = 0;
      if (sale.createdAt) {
        // Try parsing either ISO string or Indian formatted date
        const parsed = Date.parse(sale.createdAt);
        if (!isNaN(parsed)) {
          saleTime = parsed;
        } else {
          // e.g. "07/09/2026" or "07/09/2026, 17:30"
          const parts = sale.createdAt.split(/[,\s]+/)[0].split(/[\/-]/);
          if (parts.length === 3) {
            const d = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const y = parseInt(parts[2], 10);
            saleTime = new Date(y, m, d).getTime();
          }
        }
      }
      if (!saleTime) saleTime = now.getTime(); // fallback safe

      switch (dateFilter) {
        case 'Today':
          return saleTime >= todayStart;
        case 'Yesterday':
          return saleTime >= yesterdayStart && saleTime < todayStart;
        case 'Week':
          return saleTime >= weekStart;
        case 'Month':
          return saleTime >= monthStart;
        case 'Financial Year':
          return saleTime >= fyStart;
        case 'Custom':
          if (!customStartDate && !customEndDate) return true;
          const start = customStartDate ? new Date(customStartDate).getTime() : 0;
          const end = customEndDate ? new Date(customEndDate).getTime() + 24 * 60 * 60 * 1000 - 1 : Infinity;
          return saleTime >= start && saleTime <= end;
        default:
          return true;
      }
    });
  }, [sales, dateFilter, customStartDate, customEndDate]);

  // Aggregate Store Sales Ranking
  const storeRankings = useMemo(() => {
    // Exclude 'CENTRAL' warehouse from retail store ranking if Central has registers = 0
    const storeMap: Record<
      string,
      {
        storeCode: string;
        storeName: string;
        revenue: number;
        grossProfit: number;
        invoiceCount: number;
        totalUnits: number;
      }
    > = {};

    // Initialize with existing known retail stores
    storesList.forEach((st) => {
      if (st.code !== 'CENTRAL') {
        storeMap[st.code] = {
          storeCode: st.code,
          storeName: st.name,
          revenue: 0,
          grossProfit: 0,
          invoiceCount: 0,
          totalUnits: 0,
        };
      }
    });

    // Aggregate from external customer sales
    filteredSales.forEach((sale) => {
      const code = sale.store || 'BLR';
      if (!storeMap[code]) {
        const found = storesList.find((s) => s.code === code);
        storeMap[code] = {
          storeCode: code,
          storeName: found ? found.name : `Store ${code}`,
          revenue: 0,
          grossProfit: 0,
          invoiceCount: 0,
          totalUnits: 0,
        };
      }

      const rev = Number(sale.total) || 0;
      const subtotal = Number(sale.subtotal) || rev;
      // Estimate or calculate gross profit: roughly subtotal - estimated cost (or 25% margin default if no cost snapshot)
      const costEstimate = sale.items?.reduce((acc, it) => acc + ((it as any).unitCost || (it.unitPrice * 0.7)) * it.qty, 0) || (subtotal * 0.7);
      const gp = Math.max(0, subtotal - costEstimate);
      const units = sale.items?.reduce((acc, it) => acc + (it.qty || 1), 0) || 1;

      storeMap[code].revenue += rev;
      storeMap[code].grossProfit += gp;
      storeMap[code].invoiceCount += 1;
      storeMap[code].totalUnits += units;
    });

    const list = Object.values(storeMap).map((st) => {
      const avgInvoiceValue = st.invoiceCount > 0 ? Math.round(st.revenue / st.invoiceCount) : 0;
      return {
        ...st,
        avgInvoiceValue,
      };
    });

    // Sort by revenue descending
    return list.sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, storesList]);

  // Aggregate Customer Sales Analytics
  const customerAnalytics = useMemo(() => {
    const custMap: Record<
      string,
      {
        id: string;
        name: string;
        phone: string;
        totalSpend: number;
        totalPurchases: number;
        invoiceCount: number;
        lastPurchase: string;
      }
    > = {};

    filteredSales.forEach((sale) => {
      const key = sale.customerPhone || sale.customerName || 'Walk-in';
      if (!custMap[key]) {
        const matched = customers.find((c) => c.phone === sale.customerPhone || c.name === sale.customerName);
        custMap[key] = {
          id: matched?.id || key,
          name: sale.customerName || 'Walk-in Customer',
          phone: sale.customerPhone || '',
          totalSpend: 0,
          totalPurchases: 0,
          invoiceCount: 0,
          lastPurchase: sale.createdAt || 'Recent',
        };
      }

      const rev = Number(sale.total) || 0;
      const units = sale.items?.reduce((acc, it) => acc + (it.qty || 1), 0) || 1;

      custMap[key].totalSpend += rev;
      custMap[key].totalPurchases += units;
      custMap[key].invoiceCount += 1;
    });

    return Object.values(custMap)
      .filter((c) => c.totalSpend > 0)
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 10);
  }, [filteredSales, customers]);

  const maxStoreRevenue = Math.max(...storeRankings.map((s) => s.revenue), 1);

  return (
    <div className="card p-5 space-y-4">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="section-header text-sm sm:text-base font-bold text-foreground">
              {activeTab === 'stores' ? 'Store Sales Ranking' : 'Customer Sales Analytics'}
            </h2>
            <span className="badge-primary text-2xs px-2 py-0.5 rounded-full font-bold">
              {activeTab === 'stores' ? `${storeRankings.length} Stores` : `${customerAnalytics.length} Top Customers`}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeTab === 'stores'
              ? 'Ranked using authoritative external customer sales (transfers excluded)'
              : 'Top retail customer purchase frequency & lifetime spend'}
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center p-1 bg-muted/50 rounded-lg border border-border self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('stores')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'stores'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Stores
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'customers'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Customers
          </button>
        </div>
      </div>

      {/* Date Filters */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {(['Today', 'Yesterday', 'Week', 'Month', 'Financial Year', 'Custom'] as DateFilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setDateFilter(f)}
            className={`px-2.5 py-1 rounded-md text-2xs font-semibold border transition-all ${
              dateFilter === f
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:bg-muted/40'
            }`}
          >
            {f}
          </button>
        ))}

        {dateFilter === 'Custom' && (
          <div className="flex items-center gap-2 mt-1 sm:mt-0">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="input-field text-2xs py-0.5 px-1.5 h-7"
            />
            <span className="text-2xs text-muted-foreground">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="input-field text-2xs py-0.5 px-1.5 h-7"
            />
          </div>
        )}
      </div>

      {/* Tab 1: Store Sales Ranking */}
      {activeTab === 'stores' && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-border text-muted-foreground font-semibold text-2xs uppercase tracking-wider">
                <th className="py-2 px-2 text-center w-8">#</th>
                <th className="py-2 px-2">Store</th>
                <th className="py-2 px-2 text-right">Invoices</th>
                <th className="py-2 px-2 text-right">Revenue</th>
                <th className="py-2 px-2 text-right hidden sm:table-cell">Gross Profit</th>
                <th className="py-2 px-2 text-right hidden sm:table-cell">Avg Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {storeRankings.map((st, idx) => {
                const pct = Math.round((st.revenue / maxStoreRevenue) * 100);
                return (
                  <tr key={st.storeCode} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-2 text-center font-bold text-muted-foreground">
                      {idx === 0 ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 font-bold text-2xs">
                          1
                        </span>
                      ) : (
                        idx + 1
                      )}
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="font-bold text-foreground flex items-center gap-1.5">
                        <span>{st.storeName}</span>
                        <span className="text-2xs font-mono font-medium text-muted-foreground">({st.storeCode})</span>
                      </div>
                      <div className="w-full bg-muted/60 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: idx === 0 ? 'var(--primary)' : 'var(--positive, #10b981)',
                          }}
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-medium text-foreground">
                      {st.invoiceCount}
                    </td>
                    <td className="py-2.5 px-2 text-right font-bold text-foreground font-tabular">
                      ₹{st.revenue.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-2 text-right text-emerald-600 font-semibold font-tabular hidden sm:table-cell">
                      ₹{st.grossProfit.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-2 text-right text-muted-foreground font-medium font-tabular hidden sm:table-cell">
                      ₹{st.avgInvoiceValue.toLocaleString('en-IN')}
                    </td>
                  </tr>
                );
              })}
              {storeRankings.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground text-xs">
                    No sales recorded for the selected date period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Customer Sales Analytics */}
      {activeTab === 'customers' && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-border text-muted-foreground font-semibold text-2xs uppercase tracking-wider">
                <th className="py-2 px-2 text-center w-8">#</th>
                <th className="py-2 px-2">Customer</th>
                <th className="py-2 px-2 text-right">Purchases</th>
                <th className="py-2 px-2 text-right">Invoices</th>
                <th className="py-2 px-2 text-right">Total Spend</th>
                <th className="py-2 px-2 text-right hidden sm:table-cell">Last Purchase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {customerAnalytics.map((cust, idx) => (
                <tr key={`${cust.id}-${idx}`} className="hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-2 text-center font-bold text-muted-foreground">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-2">
                    <p className="font-bold text-foreground">{cust.name}</p>
                    {cust.phone && <p className="text-2xs font-mono text-muted-foreground">{cust.phone}</p>}
                  </td>
                  <td className="py-2.5 px-2 text-right font-medium text-foreground font-tabular">
                    {cust.totalPurchases} units
                  </td>
                  <td className="py-2.5 px-2 text-right font-medium text-foreground">
                    {cust.invoiceCount}
                  </td>
                  <td className="py-2.5 px-2 text-right font-bold text-foreground font-tabular">
                    ₹{cust.totalSpend.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-2 text-right text-muted-foreground text-2xs hidden sm:table-cell">
                    {cust.lastPurchase}
                  </td>
                </tr>
              ))}
              {customerAnalytics.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground text-xs">
                    No customer purchases recorded for the selected date period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
