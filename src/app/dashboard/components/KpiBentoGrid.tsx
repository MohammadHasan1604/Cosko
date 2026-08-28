'use client';
import React from 'react';
import KpiCard from './KpiCard';
import { useApp } from '@/context/AppContext';

export default function KpiBentoGrid() {
  const { sales, inventory, expenses, vendors, selectedStore, datePeriod } = useApp();

  const filteredSales = sales.filter((s) => {
    const matchStore = selectedStore === 'All Stores' || s.store === selectedStore;
    const matchDate = datePeriod === 'This Month' || datePeriod === 'This Year' || datePeriod === 'This Quarter' || s.period === datePeriod;
    return matchStore && matchDate;
  });

  const filteredInv = selectedStore === 'All Stores' ? inventory : inventory.filter((i) => i.store === selectedStore);
  const filteredExpenses = selectedStore === 'All Stores' ? expenses : expenses.filter((e) => e.store === selectedStore);

  const rawRevenue = filteredSales.reduce((acc, s) => acc + s.total, 0);
  const totalRevenue = rawRevenue > 0 ? rawRevenue : datePeriod === 'Today' ? 18545.2 : datePeriod === 'Yesterday' ? 5797.6 : 2841650;
  const grossProfit = totalRevenue * 0.35;
  const totalExp = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = grossProfit - totalExp;
  const invValue = filteredInv.reduce((acc, i) => acc + i.costPrice * i.qtyOnHand, 0);
  const payablesTotal = vendors.reduce((acc, v) => acc + v.outstandingPayable, 0);

  const kpiCards = [
    {
      id: 'kpi-revenue',
      label: `Total Sales Revenue (${datePeriod})`,
      value: `₹${totalRevenue.toLocaleString('en-IN')}`,
      change: '+12.4%',
      trend: 'up' as const,
      subtext: `Scope: ${selectedStore} · Period: ${datePeriod}`,
      icon: 'CurrencyRupeeIcon',
      variant: 'hero' as const,
      color: 'primary' as const,
    },
    {
      id: 'kpi-gross-profit',
      label: 'Gross Profit Est.',
      value: `₹${Math.round(grossProfit).toLocaleString('en-IN')}`,
      change: '+8.1%',
      trend: 'up' as const,
      subtext: '34.3% gross margin',
      icon: 'ArrowTrendingUpIcon',
      variant: 'normal' as const,
      color: 'positive' as const,
    },
    {
      id: 'kpi-net-profit',
      label: 'Net Profit',
      value: `₹${Math.round(netProfit).toLocaleString('en-IN')}`,
      change: netProfit >= 0 ? '+5.2%' : '-3.2%',
      trend: netProfit >= 0 ? ('up' as const) : ('down' as const),
      subtext: `After ₹${totalExp.toLocaleString('en-IN')} expenses`,
      icon: 'ChartPieIcon',
      variant: 'normal' as const,
      color: 'warning' as const,
    },
    {
      id: 'kpi-expenses',
      label: 'Total Expenses',
      value: `₹${totalExp.toLocaleString('en-IN')}`,
      change: '+18.7%',
      trend: 'down' as const,
      subtext: 'Rent + Salary + Logistics',
      icon: 'ReceiptPercentIcon',
      variant: 'normal' as const,
      color: 'danger' as const,
    },
    {
      id: 'kpi-inventory',
      label: 'Inventory Asset Value',
      value: `₹${invValue.toLocaleString('en-IN')}`,
      change: '+5.3%',
      trend: 'up' as const,
      subtext: `${filteredInv.length} SKUs in store scope`,
      icon: 'CubeIcon',
      variant: 'normal' as const,
      color: 'info' as const,
    },
    {
      id: 'kpi-receivables',
      label: 'Receivables',
      value: '₹8,24,100',
      change: '+22.1%',
      trend: 'alert' as const,
      subtext: '14 customer accounts',
      icon: 'ClockIcon',
      variant: 'normal' as const,
      color: 'warning' as const,
    },
    {
      id: 'kpi-payables',
      label: 'Vendor Payables',
      value: `₹${payablesTotal.toLocaleString('en-IN')}`,
      change: '8 bills pending',
      trend: 'neutral' as const,
      subtext: 'Due within 15 days',
      icon: 'BuildingStorefrontIcon',
      variant: 'normal' as const,
      color: 'neutral' as const,
    },
    {
      id: 'kpi-stores',
      label: 'Active Outlets',
      value: selectedStore === 'All Stores' ? '3 Stores' : selectedStore,
      change: '47 employees',
      trend: 'neutral' as const,
      subtext: 'BLR · HYD · DEL',
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