'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import { useApp, StoreHub } from '@/context/AppContext';
import { toast } from 'sonner';

export default function StoresPage() {
  const { storesList, addStoreHub, updateStoreHub, deleteStoreHub, setSelectedStore, inventory, transferStock, currentUser } = useApp();

  const [addStoreModal, setAddStoreModal] = useState(false);
  const [editStoreModal, setEditStoreModal] = useState<StoreHub | null>(null);
  const [deleteStoreModal, setDeleteStoreModal] = useState<StoreHub | null>(null);
  const [transferModal, setTransferModal] = useState(false);

  // Form State for Add / Edit
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [manager, setManager] = useState('');
  const [phone, setPhone] = useState('');
  const [registers, setRegisters] = useState(2);
  const [skusCount, setSkusCount] = useState(500);
  const [monthlyRevenue, setMonthlyRevenue] = useState(500000);

  // Transfer State
  const [fromStore, setFromStore] = useState('BLR');
  const [toStore, setToStore] = useState('HYD');
  const [selectedItemId, setSelectedItemId] = useState(inventory[0]?.id || '');
  const [transferQty, setTransferQty] = useState(10);

  const handleCreateStore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) {
      toast.error('Store Code and Name are required');
      return;
    }

    addStoreHub({
      code: code.toUpperCase(),
      name,
      city: city || 'Mumbai',
      address: address || 'Commercial Hub, Main Road',
      manager: manager || 'Store Admin',
      phone: phone || '+91 99000 99000',
      registers,
      skusCount,
      monthlyRevenue,
      status: 'Active',
    });

    setAddStoreModal(false);
    resetForm();
  };

  const handleUpdateStoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStoreModal) return;
    updateStoreHub(editStoreModal.id, {
      name,
      city,
      address,
      manager,
      phone,
      registers,
      skusCount,
      monthlyRevenue,
    });
    setEditStoreModal(null);
    resetForm();
  };

  const handleDeleteStore = (id: string) => {
    const target = storesList.find((s) => s.id === id || s.code === id);
    if (target?.code === 'CENTRAL' || id === 'CENTRAL') {
      toast.error('The default Central Warehouse & Owner Store (CENTRAL) is permanent and cannot be deleted.');
      setDeleteStoreModal(null);
      return;
    }
    deleteStoreHub(id);
    setDeleteStoreModal(null);
  };

  const openEdit = (s: StoreHub) => {
    setEditStoreModal(s);
    setCode(s.code);
    setName(s.name);
    setCity(s.city);
    setAddress(s.address);
    setManager(s.manager);
    setPhone(s.phone);
    setRegisters(s.registers);
    setSkusCount(s.skusCount);
    setMonthlyRevenue(s.monthlyRevenue);
  };

  const resetForm = () => {
    setCode('');
    setName('');
    setCity('');
    setAddress('');
    setManager('');
    setPhone('');
    setRegisters(2);
    setSkusCount(500);
    setMonthlyRevenue(500000);
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fromStore === toStore) {
      toast.error('Source and destination stores must be different');
      return;
    }
    transferStock(fromStore, toStore, selectedItemId, transferQty);
    setTransferModal(false);
  };

  return (
    <AppLayout activeRoute="/stores">
      <div className="space-y-6 fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Multi-Store Locations Hubs</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Manage store outlets, register terminals, store managers, edit/delete hub locations, and inter-store transfers.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            <button onClick={() => setTransferModal(true)} className="btn-secondary gap-1.5 text-xs sm:text-sm">
              <Icon name="ArrowsRightLeftIcon" size={16} />
              Inter-Store Stock Transfer
            </button>
            {currentUser.role === 'Super Admin' && (
              <button onClick={() => { resetForm(); setAddStoreModal(true); }} className="btn-primary gap-1.5 text-xs sm:text-sm">
                <Icon name="PlusIcon" size={18} />
                Add New Store Hub
              </button>
            )}
          </div>
        </div>

        {/* Store Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {storesList.map((s) => {
            const isCentral = s.code === 'CENTRAL';
            return (
              <div key={`store-card-${s.id}`} className="card p-5 space-y-4 hover:shadow-md transition-all duration-150 relative group">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-2xs font-bold px-2 py-0.5 rounded-full ${
                        isCentral
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'badge-info'
                      }`}>
                        {s.code}
                      </span>
                      {isCentral && (
                        <span className="text-3xs bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                          Default Permanent Hub
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-foreground mt-1">{s.name}</h3>
                    <p className="text-2xs text-muted-foreground">{s.city}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setSelectedStore(s.code); toast.success(`Switched active store scope to ${s.name}`); }}
                      className="btn-ghost text-2xs text-primary font-bold hover:underline"
                    >
                      Select Scope
                    </button>

                    {/* Edit & Delete Controls (SUPER ADMIN ONLY) */}
                    {currentUser.role === 'Super Admin' && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(s)} className="p-1 text-muted-foreground hover:text-primary" title="Edit store hub">
                          <Icon name="PencilSquareIcon" size={15} />
                        </button>
                        {isCentral ? (
                          <span className="p-1 text-muted-foreground/60 cursor-help" title="The default Central Warehouse & Owner Store is permanent and cannot be deleted">
                            <Icon name="ShieldCheckIcon" size={16} className="text-primary" />
                          </span>
                        ) : (
                          <button onClick={() => setDeleteStoreModal(s)} className="p-1 text-muted-foreground hover:text-danger" title="Delete store hub">
                            <Icon name="TrashIcon" size={15} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              <div className="text-xs space-y-1 text-muted-foreground border-y border-border py-2.5">
                <p><strong className="text-foreground">Address:</strong> {s.address}</p>
                <p><strong className="text-foreground">Store Manager:</strong> {s.manager}</p>
                <p><strong className="text-foreground">Phone:</strong> {s.phone}</p>
                <p><strong className="text-foreground">Active Terminals:</strong> {s.registers} POS Registers</p>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 font-tabular">
                <div>
                  <span className="text-2xs text-muted-foreground uppercase block font-semibold">Live SKUs</span>
                  <span className="font-bold text-foreground">{s.skusCount} Items</span>
                </div>
                <div className="text-right">
                  <span className="text-2xs text-muted-foreground uppercase block font-semibold">Monthly Sales</span>
                  <span className="font-extrabold text-sm text-success">₹{s.monthlyRevenue.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>

      {/* Add New Store Hub Modal */}
      <Modal
        open={addStoreModal}
        onClose={() => setAddStoreModal(false)}
        title="Add New Store Hub"
        subtitle="Initialize a new retail outlet location hub in the network"
        size="md"
      >
        <form onSubmit={handleCreateStore} className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Store Code (3 Letters) *</label>
              <input type="text" required maxLength={4} placeholder="e.g. MUM" value={code} onChange={(e) => setCode(e.target.value)} className="input-field text-xs uppercase font-mono font-bold" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold text-foreground block mb-1">Store Outlet Name *</label>
              <input type="text" required placeholder="e.g. Mumbai Flagship Store" value={name} onChange={(e) => setName(e.target.value)} className="input-field text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">City *</label>
              <input type="text" required placeholder="Mumbai" value={city} onChange={(e) => setCity(e.target.value)} className="input-field text-xs" />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Store Manager Name</label>
              <input type="text" placeholder="Pooja Deshmukh" value={manager} onChange={(e) => setManager(e.target.value)} className="input-field text-xs" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Full Store Address</label>
            <input type="text" placeholder="Bandra Kurla Complex, Mumbai" value={address} onChange={(e) => setAddress(e.target.value)} className="input-field text-xs" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">POS Registers</label>
              <input type="number" min="1" value={registers} onChange={(e) => setRegisters(Number(e.target.value))} className="input-field text-xs" />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Initial SKUs</label>
              <input type="number" min="0" value={skusCount} onChange={(e) => setSkusCount(Number(e.target.value))} className="input-field text-xs" />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Target Monthly (₹)</label>
              <input type="number" min="0" value={monthlyRevenue} onChange={(e) => setMonthlyRevenue(Number(e.target.value))} className="input-field text-xs" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={() => setAddStoreModal(false)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs">Create Store Hub</button>
          </div>
        </form>
      </Modal>

      {/* Edit Store Modal */}
      {editStoreModal && (
        <Modal
          open={!!editStoreModal}
          onClose={() => setEditStoreModal(null)}
          title="Edit Store Hub Details"
          subtitle={`Update information for ${editStoreModal.name}`}
          size="md"
        >
          <form onSubmit={handleUpdateStoreSubmit} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Store Name *</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="input-field text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">City</label>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="input-field text-xs" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Store Manager</label>
                <input type="text" value={manager} onChange={(e) => setManager(e.target.value)} className="input-field text-xs" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Address</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="input-field text-xs" />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button type="button" onClick={() => setEditStoreModal(null)} className="btn-secondary text-xs">Cancel</button>
              <button type="submit" className="btn-primary text-xs">Save Changes</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete / Deactivate Store Modal */}
      {deleteStoreModal && (
        <Modal
          open={!!deleteStoreModal}
          onClose={() => setDeleteStoreModal(null)}
          title={`Deactivate / Delete Store "${deleteStoreModal.name}"`}
          subtitle={`Code: ${deleteStoreModal.code} · Location: ${deleteStoreModal.city}`}
          size="md"
        >
          <div className="space-y-4 py-2 text-xs">
            {(() => {
              const storeInventoryCount = inventory.filter((i) => i.store === deleteStoreModal.code).length;
              const hasHistory = storeInventoryCount > 0 || deleteStoreModal.monthlyRevenue > 0;

              return (
                <>
                  <div className={`p-4 rounded-xl border ${hasHistory ? 'bg-warning/10 border-warning/30 text-foreground' : 'bg-muted/40 border-border text-foreground'}`}>
                    <div className="flex items-start gap-2.5">
                      <Icon name={hasHistory ? 'ExclamationTriangleIcon' : 'InformationCircleIcon'} size={18} className={hasHistory ? 'text-warning shrink-0 mt-0.5' : 'text-primary shrink-0 mt-0.5'} />
                      <div>
                        <p className="font-bold text-sm">
                          {hasHistory ? 'Store Hub Has Active Inventory / Sales' : 'Unused Store Location'}
                        </p>
                        <p className="text-muted-foreground mt-1">
                          {hasHistory
                            ? `This store currently manages ${storeInventoryCount} product SKUs and historical sales records. To prevent data corruption, it will be safely Deactivated / Archived.`
                            : `This store has no linked inventory or sales records. You can safely remove it.`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-border">
                    <button onClick={() => setDeleteStoreModal(null)} className="btn-secondary text-xs">Cancel</button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteStoreHub(deleteStoreModal.id, false);
                        setDeleteStoreModal(null);
                      }}
                      className="btn-primary bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4"
                    >
                      Safe Deactivate
                    </button>
                    {!hasHistory && (
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteStoreHub(deleteStoreModal.id, true);
                          setDeleteStoreModal(null);
                        }}
                        className="btn-danger text-xs font-bold px-4"
                      >
                        Permanent Delete
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </Modal>
      )}

      {/* Stock Transfer Modal */}
      <Modal
        open={transferModal}
        onClose={() => setTransferModal(false)}
        title="Inter-Store Inventory Transfer"
        subtitle="Transfer stock lots between store warehouses"
        size="md"
      >
        <form onSubmit={handleTransferSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Source Store (From) *</label>
              <select value={fromStore} onChange={(e) => setFromStore(e.target.value)} className="input-field text-xs font-medium">
                {storesList.map((st) => (
                  <option key={`tr-from-${st.id}`} value={st.code}>
                    {st.code} — {st.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Destination Store (To) *</label>
              <select value={toStore} onChange={(e) => setToStore(e.target.value)} className="input-field text-xs font-medium">
                {storesList.map((st) => (
                  <option key={`tr-to-${st.id}`} value={st.code}>
                    {st.code} — {st.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Select Inventory SKU *</label>
            <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} className="input-field text-xs font-medium">
              {inventory.map((item) => (
                <option key={`tr-item-${item.id}`} value={item.id}>
                  {item.name} ({item.sku}) — {item.qtyOnHand} in stock
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Transfer Quantity *</label>
            <input type="number" min="1" required value={transferQty} onChange={(e) => setTransferQty(Number(e.target.value))} className="input-field text-xs" />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={() => setTransferModal(false)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs">Confirm Stock Transfer</button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
