'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import { useApp, UserAccount } from '@/context/AppContext';
import { toast } from 'sonner';

export default function EmployeesPage() {
  const {
    currentUser,
    selectedStore,
    usersList,
    storesList,
    addUserAccount,
    updateUserAccount,
    deleteUserAccount,
    toggleUserShiftStatus,
  } = useApp();

  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState<UserAccount | null>(null);
  const [deleteEmpModal, setDeleteEmpModal] = useState<UserAccount | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [role, setRole] = useState<'Store Manager' | 'POS Cashier' | 'Inventory Auditor' | 'Sales Executive'>('Store Manager');
  const [store, setStore] = useState('BLR');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const filteredEmployees = usersList.filter((e) => {
    // Hide Super Admin employee records from lower-level roles
    if (e.role === 'Super Admin' && currentUser.role !== 'Super Admin') return false;
    // Filter by store location for Store Managers & staff
    if (currentUser.role !== 'Super Admin') {
      const allowed = e.allowedStores || [e.store];
      return allowed.includes(currentUser.store) || e.store === currentUser.store;
    }
    return selectedStore === 'All Stores' ? true : (e.store === selectedStore || (e.allowedStores && e.allowedStores.includes(selectedStore)));
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error('Full Name, Email, and Account Password are required');
      return;
    }

    if ((role as string) === 'Super Admin' && currentUser.role !== 'Super Admin') {
      toast.error('Deny Access: Only Super Admins can register Level 100 Super Admin accounts.');
      return;
    }

    const employeeEmail = email.trim().toLowerCase();

    // Create User Account Credentials in AppContext & MySQL database
    const res = await addUserAccount({
      name,
      email: employeeEmail,
      password,
      phone: phone || '+91 99000 12345',
      role: role as any,
      store,
      allowedStores: [store],
      status: 'Active',
      shiftStatus: 'On Shift',
    });

    if (res?.success !== false) {
      setAddModal(false);
      resetForm();
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    await updateUserAccount(editModal.id, {
      name,
      role: role as any,
      store,
      email,
      phone,
    });
    setEditModal(null);
    resetForm();
  };

  const openEdit = (emp: UserAccount) => {
    setEditModal(emp);
    setName(emp.name);
    setRole(emp.role as any);
    setStore(emp.store);
    setEmail(emp.email);
    setPhone(emp.phone || '');
  };

  const resetForm = () => {
    setName('');
    setRole('Store Manager');
    setStore('BLR');
    setEmail('');
    setPhone('');
    setPassword('');
    setShowPassword(false);
  };

  return (
    <AppLayout activeRoute="/employees">
      <div className="space-y-6 fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Employee Roster & Attendance</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Staff management, shift schedules, active location assignments, and login credential provisioning backed by MySQL.
            </p>
          </div>

          <button onClick={() => { resetForm(); setAddModal(true); }} className="btn-primary gap-2 self-start sm:self-auto text-xs sm:text-sm">
            <Icon name="UserPlusIcon" size={18} />
            Register Team Member
          </button>
        </div>

        {/* Employee Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredEmployees.map((emp) => (
            <div key={`emp-card-${emp.id}`} className="card p-4 space-y-3 relative">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-foreground text-sm">{emp.name}</h3>
                  <span className="badge-warning text-3xs font-semibold mt-1 inline-block">{emp.role}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(emp)} className="p-1 text-muted-foreground hover:text-primary" title="Edit employee">
                    <Icon name="PencilSquareIcon" size={15} />
                  </button>
                  <button onClick={() => setDeleteEmpModal(emp)} className="p-1 text-muted-foreground hover:text-danger" title="Remove employee">
                    <Icon name="TrashIcon" size={15} />
                  </button>
                </div>
              </div>

              <div className="text-xs space-y-1.5 text-muted-foreground border-y border-border py-3">
                <p><strong className="text-foreground">Store Location:</strong> <span className="badge-info text-3xs font-mono font-bold">{emp.store}</span></p>
                <p><strong className="text-foreground">Email:</strong> {emp.email}</p>
                <p><strong className="text-foreground">Phone:</strong> {emp.phone || 'N/A'}</p>
                <p><strong className="text-foreground">Status:</strong> <span className={emp.status === 'Active' ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>{emp.status}</span></p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-2xs text-muted-foreground font-semibold">Current Shift Status:</span>
                <button
                  onClick={() => toggleUserShiftStatus(emp.id)}
                  className={`btn-ghost text-xs px-2.5 py-1 ${
                    emp.shiftStatus === 'On Shift' ? 'text-success font-bold' : 'text-warning font-bold'
                  }`}
                >
                  ● {emp.shiftStatus} (Click to toggle)
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Register Employee & Account Credentials Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Register New Team Member" subtitle="Create employee record and login credentials" size="md">
        <form onSubmit={handleAddSubmit} className="space-y-3.5 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Full Name *</label>
              <input type="text" required placeholder="Pooja Deshmukh" value={name} onChange={(e) => setName(e.target.value)} className="input-field text-xs" />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Role Title *</label>
              <select value={role} onChange={(e) => setRole(e.target.value as any)} className="input-field text-xs font-medium">
                <option value="Store Manager">Store Manager (Level 80)</option>
                <option value="Inventory Auditor">Inventory Auditor (Level 60)</option>
                <option value="POS Cashier">POS Cashier (Level 20)</option>
                <option value="Sales Executive">Sales Executive (Level 20)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Store Outlet *</label>
              <select value={store} onChange={(e) => setStore(e.target.value)} className="input-field text-xs font-medium">
                {storesList.map((s) => (
                  <option key={`st-opt-${s.code}`} value={s.code}>{s.code} — {s.city}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Phone Number</label>
              <input type="text" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field text-xs" />
            </div>
          </div>

          {/* Email Address & Password Credentials Section */}
          <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-xl border border-border">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Email Address (Login ID) *</label>
              <input type="email" required placeholder="pooja@cosko.com" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field text-xs" />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Account Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Set account password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field text-xs pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={() => setAddModal(false)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs">Register Employee & Create Account</button>
          </div>
        </form>
      </Modal>

      {/* Edit Employee Modal */}
      {editModal && (
        <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Employee Details" size="md">
          <form onSubmit={handleEditSubmit} className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Full Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field text-xs" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Role Title</label>
                <input type="text" value={role} onChange={(e) => setRole(e.target.value as any)} className="input-field text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field text-xs" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Phone Number</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field text-xs" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button type="button" onClick={() => setEditModal(null)} className="btn-secondary text-xs">Cancel</button>
              <button type="submit" className="btn-primary text-xs">Save Changes</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete / Deactivate Employee Modal */}
      {deleteEmpModal && (
        <Modal
          open={!!deleteEmpModal}
          onClose={() => setDeleteEmpModal(null)}
          title={`Deactivate / Remove Employee "${deleteEmpModal.name}"`}
          subtitle={`Role: ${deleteEmpModal.role} · Store: ${deleteEmpModal.store} · Email: ${deleteEmpModal.email}`}
          size="md"
        >
          <div className="space-y-4 py-2 text-xs">
            {(() => {
              const isSelf = currentUser.email && currentUser.email.toLowerCase() === deleteEmpModal.email.toLowerCase();

              return (
                <>
                  <div className={`p-4 rounded-xl border ${isSelf ? 'bg-danger/10 border-danger/30 text-foreground' : 'bg-muted/40 border-border text-foreground'}`}>
                    <div className="flex items-start gap-2.5">
                      <Icon name={isSelf ? 'ExclamationCircleIcon' : 'InformationCircleIcon'} size={18} className={isSelf ? 'text-danger shrink-0 mt-0.5' : 'text-primary shrink-0 mt-0.5'} />
                      <div>
                        <p className="font-bold text-sm">
                          {isSelf ? 'Cannot Remove Active Logged-In Account' : 'Team Member Lifecycle Management'}
                        </p>
                        <p className="text-muted-foreground mt-1">
                          {isSelf
                            ? 'You are currently logged into this account. System security rules prohibit deleting your own session.'
                            : `Removing ${deleteEmpModal.name} will synchronize with user permissions and authentication records.`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-border">
                    <button onClick={() => setDeleteEmpModal(null)} className="btn-secondary text-xs">Cancel</button>
                    {!isSelf && (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteUserAccount(deleteEmpModal.id, false);
                            setDeleteEmpModal(null);
                          }}
                          className="btn-primary bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4"
                        >
                          Deactivate Account
                        </button>
                        {currentUser.role === 'Super Admin' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteUserAccount(deleteEmpModal.id, true);
                              setDeleteEmpModal(null);
                            }}
                            className="btn-danger text-xs font-bold px-4"
                          >
                            Permanent Delete
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
