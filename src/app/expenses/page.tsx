'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import { useApp } from '@/context/AppContext';

export default function ExpensesPage() {
  const { expenses, addExpense, selectedStore, storesList } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [category, setCategory] = useState('Store Rent');
  const [description, setDescription] = useState('');
  const [store, setStore] = useState(selectedStore === 'All Stores' ? 'CENTRAL' : selectedStore);
  const [amount, setAmount] = useState(5000);
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');

  // Keep store in sync when modal opens
  React.useEffect(() => {
    if (modalOpen) {
      setStore(selectedStore === 'All Stores' ? 'CENTRAL' : selectedStore);
    }
  }, [modalOpen, selectedStore]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addExpense({
      category,
      description,
      store: store || 'CENTRAL',
      amount,
      paymentMethod,
      status: 'Approved',
    });
    setModalOpen(false);
  };

  const totalExpense = expenses.reduce((acc, e) => acc + e.amount, 0);

  return (
    <AppLayout activeRoute="/expenses">
      <div className="space-y-6 fade-in">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Operating Expenses</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Store operating expenses, utility bills, rent, logistics, and approval status.
            </p>
          </div>

          <button onClick={() => setModalOpen(true)} className="btn-primary gap-2 text-sm">
            <Icon name="PlusIcon" size={16} />
            Log New Expense
          </button>
        </div>

        {/* Expenses Summary Card */}
        <div className="card p-5 bg-gradient-to-r from-primary/10 via-info/5 to-card flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Logged Expenses</p>
            <h2 className="text-2xl font-extrabold text-foreground font-tabular mt-1">₹{totalExpense.toLocaleString('en-IN')}</h2>
            <p className="text-2xs text-muted-foreground mt-0.5">{expenses.length} approved transactions in active store scope</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center font-bold text-lg">
            ₹
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="bg-muted text-2xs font-bold uppercase text-muted-foreground">
                  <th className="px-4 py-3">Ref No</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-3 font-tabular">Amount</th>
                  <th className="px-4 py-3">Payment Method</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {expenses.map((exp) => (
                  <tr key={`exp-${exp.id}`} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-xs font-bold text-primary">{exp.referenceNo}</td>
                    <td className="px-4 py-3.5 font-semibold text-foreground">{exp.category}</td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">{exp.description}</td>
                    <td className="px-4 py-3.5"><span className="badge-info text-2xs">{exp.store}</span></td>
                    <td className="px-4 py-3.5 font-bold font-tabular text-foreground">₹{exp.amount.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3.5 text-2xs text-muted-foreground">{exp.paymentMethod}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-2xs bg-positive/10 text-positive px-2 py-0.5 rounded font-semibold">{exp.status}</span>
                    </td>
                    <td className="px-4 py-3.5 text-2xs text-muted-foreground">{exp.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Log Expense Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Business Expense" size="md">
        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Expense Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field py-2">
                {['Store Rent', 'Utilities & Power', 'Logistics & Freight', 'Staff Salaries', 'Maintenance & Repairs', 'Marketing'].map((cat) => (
                  <option key={`exp-cat-${cat}`} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Store / Warehouse Hub *</label>
              <select value={store} onChange={(e) => setStore(e.target.value)} className="input-field py-2 font-medium">
                {[...storesList]
                  .sort((a, b) => (a.code === 'CENTRAL' ? -1 : b.code === 'CENTRAL' ? 1 : a.code.localeCompare(b.code)))
                  .map((st) => (
                    <option key={`exp-store-${st.code}`} value={st.code}>
                      {st.code === 'CENTRAL' ? 'COSKO Central Warehouse (CENTRAL)' : `${st.code} — ${st.name}`}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Description / Notes</label>
            <input required type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="input-field py-2" placeholder="e.g. Monthly freight bill" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Amount (₹)</label>
              <input type="number" min="1" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="input-field py-2 font-tabular" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Payment Method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="input-field py-2">
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Direct Debit">Direct Debit</option>
                <option value="Corporate Card">Corporate Card</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
          </div>
          <div className="pt-2 border-t border-border flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost">Cancel</button>
            <button type="submit" className="btn-primary">Record Expense</button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
