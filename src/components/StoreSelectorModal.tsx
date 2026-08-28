'use client';
import React, { useState } from 'react';
import { useApp, StoreHub } from '@/context/AppContext';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import Modal from '@/components/ui/Modal';
import { toast } from 'sonner';

export default function StoreSelectorModal() {
  const { storeSelectorOpen, setStoreSelectorOpen, selectedStore, setSelectedStore, storesList, addStoreHub, updateStoreHub, deleteStoreHub, currentUser, branding, addAuditLog } = useApp();

  const [addStoreModal, setAddStoreModal] = useState(false);
  const [editStoreModal, setEditStoreModal] = useState<StoreHub | null>(null);
  const [deleteStoreModal, setDeleteStoreModal] = useState<StoreHub | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [manager, setManager] = useState('');
  const [phone, setPhone] = useState('');
  const [registers, setRegisters] = useState(2);
  const [skusCount, setSkusCount] = useState(500);

  if (!storeSelectorOpen) return null;

  const handleSelect = (storeCode: string, storeName: string) => {
    const targetStore = storeCode === 'ALL' ? 'All Stores' : storeCode;

    // Scope Permission Check
    if (currentUser.role !== 'Super Admin') {
      if (targetStore === 'All Stores') {
        toast.error('Store Scope Restricted: Enterprise "All Stores" scope is restricted to Super Admin accounts only.');
        return;
      }
      const assignedStore = (currentUser.store && currentUser.store !== 'All Stores') ? currentUser.store : 'BLR';
      if (targetStore !== assignedStore) {
        toast.error(`Store Scope Restricted: As ${currentUser.role}, you are bound to ${assignedStore} location.`);
        return;
      }
    }

    setSelectedStore(targetStore);
    addAuditLog('Organization', 'Switch Store Scope', `Switched active store view context to "${storeName}" (${storeCode})`);
    setStoreSelectorOpen(false);
    toast.success(`Active store scope set to: ${storeName}`);
  };

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
      address: address || 'Commercial Center, Main Rd',
      manager: manager || 'Store Admin',
      phone: phone || '+91 99000 99000',
      registers,
      skusCount,
      monthlyRevenue: 500000,
      status: 'Active',
    });
    setAddStoreModal(false);
    resetForm();
  };

  const handleUpdateStore = (e: React.FormEvent) => {
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
    });
    setEditStoreModal(null);
    resetForm();
  };

  const openEdit = (e: React.MouseEvent, st: StoreHub) => {
    e.stopPropagation();
    setEditStoreModal(st);
    setCode(st.code);
    setName(st.name);
    setCity(st.city);
    setAddress(st.address);
    setManager(st.manager);
    setPhone(st.phone);
    setRegisters(st.registers);
    setSkusCount(st.skusCount);
  };

  const openDelete = (e: React.MouseEvent, st: StoreHub) => {
    e.stopPropagation();
    setDeleteStoreModal(st);
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
  };

  // Prepend Enterprise "All Stores" option
  const allStoresScopeOption = {
    id: 'all',
    code: 'ALL',
    name: 'All Stores (Enterprise)',
    city: 'Enterprise View',
    address: `Enterprise Multi-Store Scope (${storesList.length} Hubs)`,
    manager: 'Super Admin',
    phone: '',
    registers: storesList.reduce((acc, s) => acc + s.registers, 0),
    skusCount: storesList.reduce((acc, s) => acc + s.skusCount, 0),
    monthlyRevenue: storesList.reduce((acc, s) => acc + s.monthlyRevenue, 0),
    status: 'Active' as const,
  };

  const fullStoreList = [allStoresScopeOption, ...storesList];

  return (
    <Modal
      open={storeSelectorOpen}
      onClose={() => setStoreSelectorOpen(false)}
      title="Select Active Store Scope"
      subtitle={`${branding.appName} Location & Hub Selection — Select an active store location scope`}
      size="md"
    >
      <div className="space-y-4 py-2">
        {/* Business Branding & Add Store Button */}
        <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.appName} className="w-10 h-10 object-contain rounded-lg border border-border" />
            ) : (
              <AppLogo size={36} />
            )}
            <div>
              <h4 className="text-sm font-bold text-foreground">{branding.appName}</h4>
              <p className="text-2xs text-muted-foreground">{branding.tagline || 'Multi-Store Enterprise Retail System'}</p>
            </div>
          </div>

          {currentUser.role === 'Super Admin' && (
            <button onClick={() => { resetForm(); setAddStoreModal(true); }} className="btn-primary text-2xs py-1.5 px-3 gap-1">
              <Icon name="PlusIcon" size={13} />
              Add Store Hub
            </button>
          )}
        </div>

        {/* Dynamic Store Hubs List */}
        <div className="space-y-2.5 max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
          {fullStoreList.map((st) => {
            const targetStoreCode = st.code === 'ALL' ? 'All Stores' : st.code;
            const isSelected = selectedStore === targetStoreCode;
            const assignedStore = (currentUser.store && currentUser.store !== 'All Stores') ? currentUser.store : 'BLR';
            const isLocked = currentUser.role !== 'Super Admin' && (targetStoreCode === 'All Stores' || targetStoreCode !== assignedStore);
            const isEnterpriseAll = st.code === 'ALL';

            return (
              <div
                key={`scope-${st.id}`}
                onClick={() => handleSelect(st.code, st.name)}
                className={`p-4 rounded-xl border transition-all duration-150 flex items-center justify-between ${
                  isLocked
                    ? 'bg-muted/40 border-border opacity-60 cursor-not-allowed'
                    : isSelected
                    ? 'bg-primary/10 border-primary shadow-xs cursor-pointer'
                    : 'bg-card border-border hover:border-primary/50 hover:bg-muted/50 cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${isSelected ? 'bg-primary text-white' : 'bg-muted text-foreground'}`}>
                    {st.code}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-foreground truncate">{st.name}</p>
                      <span className="badge-info text-3xs">{st.status}</span>
                      {isLocked && (
                        <span className="badge-danger text-3xs flex items-center gap-1">
                          <Icon name="LockClosedIcon" size={11} /> Restricted
                        </span>
                      )}
                    </div>
                    <p className="text-2xs text-muted-foreground mt-0.5 truncate">{st.address}</p>
                    <div className="flex items-center gap-3 text-2xs text-muted-foreground mt-1 font-tabular">
                      <span>{st.registers} POS Registers</span>
                      <span>·</span>
                      <span>{st.skusCount.toLocaleString('en-IN')} SKUs Catalog</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Edit & Delete Action Buttons for Store Hubs (SUPER ADMIN ONLY) */}
                  {!isEnterpriseAll && currentUser.role === 'Super Admin' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => openEdit(e, st)}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                        title="Edit Store Hub details"
                      >
                        <Icon name="PencilSquareIcon" size={15} />
                      </button>
                      <button
                        onClick={(e) => openDelete(e, st)}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-danger transition-colors"
                        title="Delete Store Hub"
                      >
                        <Icon name="TrashIcon" size={15} />
                      </button>
                    </div>
                  )}

                  {isSelected ? (
                    <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center">
                      <Icon name="CheckIcon" size={14} />
                    </div>
                  ) : isLocked ? (
                    <Icon name="LockClosedIcon" size={16} className="text-muted-foreground" />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Store Hub Modal */}
      <Modal open={addStoreModal} onClose={() => setAddStoreModal(false)} title="Add New Store Location Hub" size="sm">
        <form onSubmit={handleCreateStore} className="space-y-3 py-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Code *</label>
              <input type="text" required maxLength={4} placeholder="MUM" value={code} onChange={(e) => setCode(e.target.value)} className="input-field text-xs font-mono uppercase font-bold" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold text-foreground block mb-1">Store Name *</label>
              <input type="text" required placeholder="Mumbai Central Hub" value={name} onChange={(e) => setName(e.target.value)} className="input-field text-xs" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Address</label>
            <input type="text" placeholder="Bandra Kurla Complex, Mumbai" value={address} onChange={(e) => setAddress(e.target.value)} className="input-field text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">City</label>
              <input type="text" placeholder="Mumbai" value={city} onChange={(e) => setCity(e.target.value)} className="input-field text-xs" />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Manager</label>
              <input type="text" placeholder="Manager Name" value={manager} onChange={(e) => setManager(e.target.value)} className="input-field text-xs" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={() => setAddStoreModal(false)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs">Create Store Hub</button>
          </div>
        </form>
      </Modal>

      {/* Edit Store Hub Modal */}
      {editStoreModal && (
        <Modal open={!!editStoreModal} onClose={() => setEditStoreModal(null)} title="Edit Store Hub Details" size="sm">
          <form onSubmit={handleUpdateStore} className="space-y-3 py-2">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Store Hub Name *</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="input-field text-xs font-bold" />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Address</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="input-field text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">City</label>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="input-field text-xs" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Store Manager</label>
                <input type="text" value={manager} onChange={(e) => setManager(e.target.value)} className="input-field text-xs" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button type="button" onClick={() => setEditStoreModal(null)} className="btn-secondary text-xs">Cancel</button>
              <button type="submit" className="btn-primary text-xs">Save Changes</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Store Hub Modal */}
      {deleteStoreModal && (
        <Modal open={!!deleteStoreModal} onClose={() => setDeleteStoreModal(null)} title="Delete Store Hub" size="sm">
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Are you sure you want to delete store hub <strong className="text-foreground">{deleteStoreModal.name} ({deleteStoreModal.code})</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button onClick={() => setDeleteStoreModal(null)} className="btn-secondary text-xs">Cancel</button>
              <button
                onClick={() => {
                  deleteStoreHub(deleteStoreModal.id);
                  setDeleteStoreModal(null);
                }}
                className="btn-danger text-xs"
              >
                Delete Store Hub
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
