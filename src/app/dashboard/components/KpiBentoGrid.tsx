'use client';
import React from 'react';
import KpiCard from './KpiCard';
import { useApp } from '@/context/AppContext';

export default function KpiBentoGrid() {
  const { sales, inventory, expenses, vendors, customers, storesList, usersList, selectedStore, datePeriod } = useApp();

  const filteredSales = sales.filter((s) => {
    const matchStore = selectedStore === 'All Stores' || s.store === selectedStore;
    const matchDate = datePeriod === 'This Month' || datePeriod === 'This Year' || datePeriod === 'This Quarter' || s.period === datePeriod;
    return matchStore && matchDate;
  });

  const filteredInv = selectedStore === 'All Stores' ? inventory : inventory.filter((i) => i.store === selectedStore);
  const filteredExpenses = selectedStore === 'All Stores' ? expenses : expenses.filter((e) => e.store === selectedStore);

  const totalRevenue = filteredSales.reduce((acc, s) => acc + s.total, 0);
  const grossProfit = filteredSales.length > 0 ? totalRevenue * 0.30 : 0;
  const totalExp = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = grossProfit - totalExp;
  const invValue = filteredInv.reduce((acc, i) => acc + (i.costPrice || 0) * (i.qtyOnHand || 0), 0);
  const receivablesTotal = customers.reduce((acc, c) => acc + (c.creditBalance || 0), 0);
  const payablesTotal = vendors.reduce((acc, v) => acc + (v.outstandingPayable || 0), 0);
  const activeOutletsCount = selectedStore === 'All Stores' ? storesList.filter(s => s.status === 'Active').length : 1;

  const kpiCards = [
    {
      id: 'kpi-revenue',
      label: `Total Sales Revenue (${datePeriod})`,
      value: `₹${totalRevenue.toLocaleString('en-IN')}`,
      change: filteredSales.length > 0 ? '+100%' : '0%',
      trend: totalRevenue > 0 ? ('up' as const) : ('neutral' as const),
      subtext: `Scope: ${selectedStore} · Period: ${datePeriod}`,
      icon: 'CurrencyRupeeIcon',
      variant: 'hero' as const,
      color: 'primary' as const,
    },
    {
      id: 'kpi-gross-profit',
      label: 'Gross Profit Est.',
      value: `₹${Math.round(grossProfit).toLocaleString('en-IN')}`,
      change: grossProfit > 0 ? '+30.0%' : '0%',
      trend: grossProfit > 0 ? ('up' as const) : ('neutral' as const),
      subtext: totalRevenue > 0 ? 'Estimated gross margin' : 'No sales recorded',
      icon: 'ArrowTrendingUpIcon',
      variant: 'normal' as const,
      color: 'positive' as const,
    },
    {
      id: 'kpi-net-profit',
      label: 'Net Profit',
      value: `₹${Math.round(netProfit).toLocaleString('en-IN')}`,
      change: netProfit > 0 ? 'Positive' : netProfit < 0 ? 'Loss' : '₹0',
      trend: netProfit >= 0 ? ('up' as const) : ('down' as const),
      subtext: `After ₹${totalExp.toLocaleString('en-IN')} expenses`,
      icon: 'ChartPieIcon',
      variant: 'normal' as const,
      color: netProfit >= 0 ? ('warning' as const) : ('danger' as const),
    },
    {
      id: 'kpi-expenses',
      label: 'Total Expenses',
      value: `₹${totalExp.toLocaleString('en-IN')}`,
      change: `${filteredExpenses.length} recorded`,
      trend: 'neutral' as const,
      subtext: 'Operating & Store Expenses',
      icon: 'ReceiptPercentIcon',
      variant: 'normal' as const,
      color: 'danger' as const,
    },
    {
      id: 'kpi-inventory',
      label: 'Inventory Asset Value',
      value: `₹${invValue.toLocaleString('en-IN')}`,
      change: `${filteredInv.length} SKUs`,
      trend: 'neutral' as const,
      subtext: `${filteredInv.length} SKUs in store scope`,
      icon: 'CubeIcon',
      variant: 'normal' as const,
      color: 'info' as const,
    },
    {
      id: 'kpi-receivables',
      label: 'Receivables',
      value: `₹${receivablesTotal.toLocaleString('en-IN')}`,
      change: `${customers.filter(c => (c.creditBalance || 0) > 0).length} pending accounts`,
      trend: receivablesTotal > 0 ? ('alert' as const) : ('neutral' as const),
      subtext: `${customers.length} total customer accounts`,
      icon: 'ClockIcon',
      variant: 'normal' as const,
      color: 'warning' as const,
    },
    {
      id: 'kpi-payables',
      label: 'Vendor Payables',
      value: `₹${payablesTotal.toLocaleString('en-IN')}`,
      change: `${vendors.filter(v => (v.outstandingPayable || 0) > 0).length} pending bills`,
      trend: payablesTotal > 0 ? ('alert' as const) : ('neutral' as const),
      subtext: `${vendors.length} total suppliers`,
      icon: 'BuildingStorefrontIcon',
      variant: 'normal' as const,
      color: 'neutral' as const,
    },
    {
      id: 'kpi-stores',
      label: 'Active Outlets',
      value: selectedStore === 'All Stores' ? `${activeOutletsCount} Outlets` : selectedStore,
      change: `${usersList.length} staff`,
      trend: 'neutral' as const,
      subtext: storesList.map(s => s.code).slice(0, 4).join(' · '),
      icon: 'MapPinIcon',
      variant: 'normal' as const,
      color: 'info' as const,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
      <div className="sm:col-span-2 lg:col-span-2">
        <KpiCard {...kpiCards[0]} />
      </div>
      <div className="lg:col-span-1">
        <KpiCard {...kpiCards[1]} />
      </div>
      <div className="lg:col-span-1">
        <KpiCard {...kpiCards[2]} />
      </div>

      <div className="lg:col-span-1">
        <KpiCard {...kpiCards[3]} />
      </div>
      <div className="lg:col-span-1">
        <KpiCard {...kpiCards[4]} />
      </div>
      <div className="lg:col-span-1">
        <KpiCard {...kpiCards[5]} />
      </div>
      <div className="lg:col-span-1">
        <KpiCard {...kpiCards[6]} />
      </div>
    </div>
  );
}