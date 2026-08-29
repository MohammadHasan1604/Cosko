'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import { useApp, Customer } from '@/context/AppContext';

export default function CustomersPage() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useApp();

  const [registerModal, setRegisterModal] = useState(false);
  const [editCustomerModal, setEditCustomerModal] = useState<Customer | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<Customer | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [tier, setTier] = useState<'VIP' | 'Regular' | 'New'>('Regular');
  const [creditBalance, setCreditBalance] = useState(0);

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    addCustomer({
      name,
      phone,
      email: email || `${name.toLowerCase().replace(/\s+/g, '')}@domain.com`,
      city,
      tier,
      creditBalance,
    });
    setRegisterModal(false);
    resetForm();
  };

  const handleUpdateCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCustomerModal) return;
    updateCustomer(editCustomerModal.id, {
      name,
      phone,
      email,
      city,
      tier,
      creditBalance,
    });
    setEditCustomerModal(null);
    resetForm();
  };

  const openEdit = (c: Customer) => {
    setEditCustomerModal(c);
    setName(c.name);
    setPhone(c.phone);
    setEmail(c.email);
    setCity(c.city);
    setTier(c.tier);
    setCreditBalance(c.creditBalance);
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setCity('Bengaluru');
    setTier('Regular');
    setCreditBalance(0);
  };

  return (
    <AppLayout activeRoute="/customers">
      <div className="space-y-6 fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Customer Directory & Credits</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Customer relationship management, credit limits, purchase histories, and VIP tier tracking.
            </p>
          </div>
          <button onClick={() => { resetForm(); setRegisterModal(true); }} className="btn-primary gap-2 self-start sm:self-auto text-xs sm:text-sm">
            <Icon name="PlusIcon" size={18} />
            Add New Customer
          </button>
        </div>

        {/* Customer Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((c) => (
            <div key={`cust-${c.id}`} className="card p-5 space-y-4 hover:shadow-md transition-all duration-150 relative group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{c.name}</h3>
                    <p className="text-2xs text-muted-foreground">{c.city}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`badge ${c.tier === 'VIP' ? 'badge-warning' : 'badge-neutral'} text-2xs`}>
                    {c.tier}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(c)} className="p-1 text-muted-foreground hover:text-primary">
                      <Icon name="PencilSquareIcon" size={15} />
                    </button>
                    <button onClick={() => setDeleteConfirmModal(c)} className="p-1 text-muted-foreground hover:text-danger">
                      <Icon name="TrashIcon" size={15} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-xs space-y-1 text-muted-foreground border-y border-border py-2.5">
                <p><strong className="text-foreground">Email:</strong> {c.email}</p>
                <p><strong className="text-foreground">Phone:</strong> {c.phone}</p>
                <p><strong className="text-foreground">Last Activity:</strong> {c.lastPurchase}</p>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 font-tabular">
                <div>
                  <span className="text-2xs text-muted-foreground uppercase block font-semibold">Total Lifetime Spend</span>
                  <span className="font-extrabold text-foreground text-sm">₹{c.totalSpend.toLocaleString('en-IN')}</span>
                </div>
                <div className="text-right">
                  <span className="text-2xs text-muted-foreground uppercase block font-semibold">Credit Balance</span>
                  <span className={`font-extrabold text-sm ${c.creditBalance > 0 ? 'text-danger' : 'text-foreground'}`}>
                    ₹{c.creditBalance.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add New Customer Modal */}
      <Modal
        open={registerModal}
        onClose={() => setRegisterModal(false)}
        title="Register Customer Profile"
        subtitle="Add a new customer to CRM directory with credit limits"
        size="md"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4 py-2">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Full Name / Business Name *</label>
            <input type="text" required placeholder="e.g. Acme Constructions" value={name} onChange={(e) => setName(e.target.value)} className="input-field text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Phone Number *</label>
              <input type="text" required placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field text-xs" />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Email Address</label>
              <input type="email" placeholder="contact@acme.com" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">City</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="input-field text-xs" />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Tier Level</label>
              <select value={tier} onChange={(e) => setTier(e.target.value as any)} className="input-field text-xs font-medium">
                <option value="VIP">VIP</option>
                <option value="Regular">Regular</option>
                <option value="New">New</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Initial Credit Limit (₹)</label>
              <input type="number" min="0" value={creditBalance} onChange={(e) => setCreditBalance(Number(e.target.value))} className="input-field text-xs" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={() => setRegisterModal(false)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs">Register Customer</button>
          </div>
        </form>
      </Modal>

      {/* Edit Customer Modal */}
      {editCustomerModal && (
        <Modal
          open={!!editCustomerModal}
          onClose={() => setEditCustomerModal(null)}
          title="Edit Customer Profile"
          subtitle={`Update details for ${editCustomerModal.name}`}
          size="md"
        >
          <form onSubmit={handleUpdateCustomerSubmit} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Full Name / Business Name *</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="input-field text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Phone Number *</label>
                <input type="text" required value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field text-xs" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">City</label>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="input-field text-xs" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Tier Level</label>
                <select value={tier} onChange={(e) => setTier(e.target.value as any)} className="input-field text-xs font-medium">
                  <option value="VIP">VIP</option>
                  <option value="Regular">Regular</option>
                  <option value="New">New</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Credit Limit (₹)</label>
                <input type="number" min="0" value={creditBalance} onChange={(e) => setCreditBalance(Number(e.target.value))} className="input-field text-xs" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button type="button" onClick={() => setEditCustomerModal(null)} className="btn-secondary text-xs">Cancel</button>
              <button type="submit" className="btn-primary text-xs">Save Changes</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal && (
        <Modal
          open={!!deleteConfirmModal}
          onClose={() => setDeleteConfirmModal(null)}
          title="Delete Customer Profile"
          subtitle={`Are you sure you want to delete ${deleteConfirmModal.name}?`}
          size="sm"
        >
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              This action will permanently remove the customer record and credit history from the system.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button onClick={() => setDeleteConfirmModal(null)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={() => { deleteCustomer(deleteConfirmModal.id); setDeleteConfirmModal(null); }} className="btn-danger text-xs">
                Delete Customer
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
