'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import { useApp, Expense } from '@/context/AppContext';

export default function ExpensesPage() {
  const { expenses, addExpense, updateExpense, deleteExpense, selectedStore, storesList } = useApp();
  
  // Create state
  const [modalOpen, setModalOpen] = useState(false);
  const [category, setCategory] = useState('Store Rent');
  const [description, setDescription] = useState('');
  const [store, setStore] = useState(selectedStore === 'All Stores' ? 'CENTRAL' : selectedStore);
  const [amount, setAmount] = useState(5000);
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');

  // Edit state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editCategory, setEditCategory] = useState('Store Rent');
  const [editDescription, setEditDescription] = useState('');
  const [editStore, setEditStore] = useState('CENTRAL');
  const [editAmount, setEditAmount] = useState(0);
  const [editPaymentMethod, setEditPaymentMethod] = useState('Bank Transfer');

  // Delete state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Keep store in sync when create modal opens
  useEffect(() => {
    if (modalOpen) {
      setStore(selectedStore === 'All Stores' ? 'CENTRAL' : selectedStore);
    }
  }, [modalOpen, selectedStore]);

  // Filtered expenses based on active store scope
  const filteredExpenses = selectedStore === 'All Stores'
    ? expenses
    : expenses.filter((e) => e.store === selectedStore);

  const totalExpense = filteredExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await addExpense({
      category,
      description,
      store: store || 'CENTRAL',
      amount,
      paymentMethod,
      status: 'Approved',
    });
    setModalOpen(false);
    setDescription('');
  };

  const handleOpenEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setEditCategory(exp.category);
    setEditDescription(exp.description);
    setEditStore(exp.store);
    setEditAmount(exp.amount);
    setEditPaymentMethod(exp.paymentMethod);
    setEditModalOpen(true);
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    await updateExpense(editingExpense.id, {
      category: editCategory,
      description: editDescription,
      store: editStore,
      amount: editAmount,
      paymentMethod: editPaymentMethod,
    });
    setEditModalOpen(false);
    setEditingExpense(null);
  };

  const handleOpenDelete = (exp: Expense) => {
    setDeletingExpense(exp);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingExpense) return;
    try {
      setIsDeleting(true);
      await deleteExpense(deletingExpense.id);
      setDeleteModalOpen(false);
      setDeletingExpense(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AppLayout activeRoute="/expenses">
      <div className="space-y-6 fade-in">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Operating Expenses</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Store operating expenses, utility bills, rent, logistics, and approval status.
            </p>
          </div>

          <button onClick={() => setModalOpen(true)} className="btn-primary gap-2 text-xs sm:text-sm font-semibold shadow-xs">
            <Icon name="PlusIcon" size={16} />
            Log New Expense
          </button>
        </div>

        {/* Expenses Summary Card */}
        <div className="card p-5 bg-gradient-to-r from-primary/10 via-info/5 to-card flex items-center justify-between border border-border/80">
          <div>
            <p className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">Total Logged Expenses</p>
            <h2 className="text-2xl font-extrabold text-foreground font-tabular mt-1">₹{totalExpense.toLocaleString('en-IN')}</h2>
            <p className="text-3xs text-muted-foreground mt-0.5">
              {filteredExpenses.length} approved transactions in active store scope ({selectedStore})
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-primary text-white flex items-center justify-center font-bold text-base shadow-xs">
            ₹
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left min-w-[750px] text-xs">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3">Ref No</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-3 font-tabular text-right">Amount</th>
                  <th className="px-4 py-3">Payment Method</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-xs">
                      No expense records found for {selectedStore}. Click &quot;Log New Expense&quot; to add one.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => (
                    <tr key={`exp-${exp.id}`} className="table-row">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-primary">{exp.referenceNo}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{exp.category}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{exp.description}</td>
                      <td className="px-4 py-3"><span className="badge-info text-3xs font-semibold">{exp.store}</span></td>
                      <td className="px-4 py-3 font-extrabold font-tabular text-foreground text-right">₹{exp.amount.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{exp.paymentMethod}</td>
                      <td className="px-4 py-3">
                        <span className="badge-success text-3xs font-bold">{exp.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{exp.date}</td>
                      <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEdit(exp)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Edit Expense"
                        >
                          <Icon name="PencilSquareIcon" size={14} />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(exp)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                          title="Delete Expense"
                        >
                          <Icon name="TrashIcon" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Log Expense Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Business Expense" size="md">
        <form onSubmit={handleSubmitCreate} className="space-y-4 py-2 text-sm">
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

      {/* Edit Expense Modal */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title={`Edit Expense (${editingExpense?.referenceNo || ''})`} size="md">
        <form onSubmit={handleSubmitEdit} className="space-y-4 py-2 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Expense Category</label>
              <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="input-field py-2">
                {['Store Rent', 'Utilities & Power', 'Logistics & Freight', 'Staff Salaries', 'Maintenance & Repairs', 'Marketing'].map((cat) => (
                  <option key={`edit-exp-cat-${cat}`} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Store / Warehouse Hub *</label>
              <select value={editStore} onChange={(e) => setEditStore(e.target.value)} className="input-field py-2 font-medium">
                {[...storesList]
                  .sort((a, b) => (a.code === 'CENTRAL' ? -1 : b.code === 'CENTRAL' ? 1 : a.code.localeCompare(b.code)))
                  .map((st) => (
                    <option key={`edit-exp-store-${st.code}`} value={st.code}>
                      {st.code === 'CENTRAL' ? 'COSKO Central Warehouse (CENTRAL)' : `${st.code} — ${st.name}`}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Description / Notes</label>
            <input required type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="input-field py-2" placeholder="e.g. Monthly freight bill" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Amount (₹)</label>
              <input type="number" min="1" value={editAmount} onChange={(e) => setEditAmount(Number(e.target.value))} className="input-field py-2 font-tabular" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Payment Method</label>
              <select value={editPaymentMethod} onChange={(e) => setEditPaymentMethod(e.target.value)} className="input-field py-2">
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Direct Debit">Direct Debit</option>
                <option value="Corporate Card">Corporate Card</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
          </div>
          <div className="pt-2 border-t border-border flex justify-end gap-2">
            <button type="button" onClick={() => setEditModalOpen(false)} className="btn-ghost">Cancel</button>
            <button type="submit" className="btn-primary">Update Expense</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Expense Record" size="sm">
        <div className="py-2 space-y-3 text-sm">
          <p className="text-muted-foreground">
            Are you sure you want to delete expense <span className="font-mono font-bold text-foreground">{deletingExpense?.referenceNo}</span> ({deletingExpense?.description}) for <span className="font-bold text-foreground">₹{deletingExpense?.amount.toLocaleString('en-IN')}</span>?
          </p>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-600 dark:text-rose-400">
            This action permanently deletes this expense record from the MySQL database.
          </div>
          <div className="pt-2 border-t border-border flex justify-end gap-2">
            <button type="button" onClick={() => setDeleteModalOpen(false)} className="btn-ghost text-xs" disabled={isDeleting}>Cancel</button>
            <button type="button" onClick={handleConfirmDelete} className="btn-danger text-xs" disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete Expense'}
            </button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
