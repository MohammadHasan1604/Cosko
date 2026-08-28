'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { useApp } from '@/context/AppContext';

export default function AccountingPage() {
  const { sales, expenses, inventory } = useApp();

  const totalSalesRevenue = sales.reduce((acc, s) => acc + s.total, 0);
  const totalInventoryCost = inventory.reduce((acc, i) => acc + i.costPrice * i.qtyOnHand, 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  const grossProfitEstimate = totalSalesRevenue * 0.35;
  const netProfitEstimate = grossProfitEstimate - totalExpenses;

  const accountsList = [
    { code: '1010', name: 'Cash & POS Receivables', category: 'Asset', balance: 142500 },
    { code: '1200', name: 'Inventory Asset (FIFO)', category: 'Asset', balance: totalInventoryCost },
    { code: '2010', name: 'Accounts Payable (Vendors)', category: 'Liability', balance: 265250 },
    { code: '3010', name: 'Owner Equity & Reserve', category: 'Equity', balance: 8500000 },
    { code: '4010', name: 'Sales Revenue', category: 'Revenue', balance: totalSalesRevenue },
    { code: '5010', name: 'Operating Expenses', category: 'Expense', balance: totalExpenses },
  ];

  return (
    <AppLayout activeRoute="/accounting">
      <div className="space-y-6 fade-in">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Accounting & General Ledger</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Double-entry chart of accounts, real-time Profit & Loss preview, and balance ledger.
            </p>
          </div>
        </div>

        {/* P&L Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Total Sales Revenue</p>
            <p className="text-xl font-bold text-foreground font-tabular mt-1">₹{totalSalesRevenue.toLocaleString('en-IN')}</p>
            <p className="text-2xs text-success font-semibold mt-1">✓ Billed POS & Credit</p>
          </div>

          <div className="card p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Inventory Asset</p>
            <p className="text-xl font-bold text-info font-tabular mt-1">₹{totalInventoryCost.toLocaleString('en-IN')}</p>
            <p className="text-2xs text-muted-foreground mt-1">Valuation at Cost</p>
          </div>

          <div className="card p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Operating Expenses</p>
            <p className="text-xl font-bold text-danger font-tabular mt-1">₹{totalExpenses.toLocaleString('en-IN')}</p>
            <p className="text-2xs text-muted-foreground mt-1">Rent, Freight & Utilities</p>
          </div>

          <div className="card p-4 bg-primary/5 border-primary/20">
            <p className="text-xs font-semibold text-primary uppercase">Est. Net Profit</p>
            <p className={`text-xl font-extrabold font-tabular mt-1 ${netProfitEstimate >= 0 ? 'text-success' : 'text-danger'}`}>
              ₹{Math.round(netProfitEstimate).toLocaleString('en-IN')}
            </p>
            <p className="text-2xs text-muted-foreground mt-1">Gross Margin after Expenses</p>
          </div>
        </div>

        {/* Chart of Accounts */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-base font-bold text-foreground">Chart of Accounts & Ledgers</h3>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted text-2xs font-bold uppercase text-muted-foreground">
                  <th className="px-4 py-3">Account Code</th>
                  <th className="px-4 py-3">Account Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 font-tabular text-right">Current Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {accountsList.map((acc) => (
                  <tr key={`acc-${acc.code}`} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-xs font-bold text-primary">{acc.code}</td>
                    <td className="px-4 py-3.5 font-semibold text-foreground">{acc.name}</td>
                    <td className="px-4 py-3.5"><span className="badge-info text-2xs">{acc.category}</span></td>
                    <td className="px-4 py-3.5 font-bold font-tabular text-right text-foreground">₹{acc.balance.toLocaleString('en-IN')}</td>
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
