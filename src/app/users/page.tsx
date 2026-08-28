'use client';
import React, { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import { useApp, UserAccount } from '@/context/AppContext';
import { RBACEngine, RBACUser, PERMISSION_CATALOGUE, SUPER_ADMIN_PROTECTED_PERMISSIONS, PermissionDefinition, ROLE_SECURITY_LEVELS } from '@/lib/rbacEngine';
import { toast } from 'sonner';

export default function UsersPage() {
  const {
    usersList,
    currentUser,
    addUserAccount,
    updateUserAccount,
    toggleUserShiftStatus,
    toggleUserStatus,
    setUserPermissionOverride,
    toggleUserStoreAccess,
    deleteUserAccount,
    sales,
    purchases,
    inventory,
    expenses,
    auditLogs,
    storesList,
  } = useApp();

  const [inviteModal, setInviteModal] = useState(false);
  const [editUserModal, setEditUserModal] = useState<UserAccount | null>(null);
  const [permissionsModalUser, setPermissionsModalUser] = useState<UserAccount | null>(null);
  const [performanceModalUser, setPerformanceModalUser] = useState<UserAccount | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<UserAccount | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Status Filter State
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive' | 'Suspended'>('All');

  // Permission UI Category Expand/Collapse State
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserAccount['role']>('Store Manager');
  const [store, setStore] = useState('BLR');
  const [userStatus, setUserStatusState] = useState<'Active' | 'Inactive' | 'Suspended'>('Active');

  // Convert context users to RBACUser format for engine evaluation
  const rbacCurrentUser: RBACUser = {
    id: currentUser.id,
    name: currentUser.name,
    email: currentUser.email,
    role: currentUser.role,
    securityLevel: (ROLE_SECURITY_LEVELS as any)[currentUser.role] || 20,
    storeScope: currentUser.store,
    status: 'Active',
    permissions: ['ALL_PERMISSIONS'],
  };

  const rbacUsers: RBACUser[] = usersList.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    securityLevel: (u.securityLevel as any) || (ROLE_SECURITY_LEVELS as any)[u.role] || 20,
    storeScope: u.store,
    allowedStores: u.allowedStores || [u.store],
    status: u.status,
    permissions: u.permissions || [],
    overrides: u.overrides || [],
    avatarUrl: u.avatarUrl,
    shiftStatus: u.shiftStatus,
  }));

  // Server-Side Visibility Protection: Filter protected accounts based on caller security level
  const visibleUsers = RBACEngine.filterVisibleUsers(rbacCurrentUser, rbacUsers).filter((u) => {
    if (statusFilter === 'All') return true;
    return u.status === statusFilter;
  });

  const toggleCategoryCollapse = (cat: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error('Full Name, Email, and Password are required');
      return;
    }

    if (role === 'Super Admin' && currentUser.role !== 'Super Admin') {
      toast.error('Deny Access: Only existing Level 100 Super Admins can create new Super Admin accounts.');
      return;
    }

    addUserAccount({
      name,
      email,
      phone: phone || '+91 98765 43210',
      password,
      role,
      store,
      allowedStores: [store],
      status: userStatus,
      shiftStatus: 'On Shift',
    });
    setInviteModal(false);
    resetForm();
  };

  const handleUpdateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserModal) return;

    if (editUserModal.role === 'Super Admin' && currentUser.role !== 'Super Admin') {
      toast.error('Deny Access: Lower-level roles cannot modify Super Admin security records.');
      return;
    }

    updateUserAccount(editUserModal.id, {
      name,
      email,
      phone,
      password: password || editUserModal.password,
      role,
      store,
      status: userStatus,
    });
    setEditUserModal(null);
    resetForm();
  };

  const handleDeleteClick = (u: UserAccount) => {
    if (u.role === 'Super Admin' && currentUser.role !== 'Super Admin') {
      toast.error('Deny Access: Protected Boundary. Lower-level roles cannot delete Super Admin accounts.');
      return;
    }
    setDeleteConfirmModal(u);
  };

  const openEdit = (u: UserAccount) => {
    if (u.role === 'Super Admin' && currentUser.role !== 'Super Admin') {
      toast.error('Deny Access: Protected Boundary. Lower-level roles cannot edit Super Admin accounts.');
      return;
    }
    setEditUserModal(u);
    setName(u.name);
    setEmail(u.email);
    setPhone(u.phone || '');
    setPassword(u.password || '');
    setRole(u.role);
    setStore(u.store);
    setUserStatusState(u.status);
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setShowPassword(false);
    setRole('Store Manager');
    setStore('BLR');
    setUserStatusState('Active');
  };

  // Group permissions by Category for UI Sections
  const categoriesList = useMemo(() => {
    const cats: Record<string, PermissionDefinition[]> = {};
    PERMISSION_CATALOGUE.forEach((perm) => {
      if (!cats[perm.category]) cats[perm.category] = [];
      cats[perm.category].push(perm);
    });
    return cats;
  }, []);

  // Compute User Performance Analytics from real data
  const getUserPerformance = (user: UserAccount) => {
    const userSales = sales.filter((s) => s.customerName.toLowerCase().includes(user.name.toLowerCase()) || s.store === user.store);
    const userRevenue = userSales.reduce((sum, s) => sum + s.total, 0);
    const avgOrderValue = userSales.length > 0 ? userRevenue / userSales.length : 0;

    const userAuditCount = auditLogs.filter((a) => a.userName.toLowerCase() === user.name.toLowerCase()).length;
    const userPurchasesCount = purchases.filter((p) => p.store === user.store).length;
    const userExpensesCount = expenses.filter((e) => e.store === user.store).length;

    return {
      salesCount: userSales.length,
      revenue: userRevenue,
      aov: avgOrderValue,
      auditCount: userAuditCount,
      purchasesCount: userPurchasesCount,
      expensesCount: userExpensesCount,
    };
  };

  const roleDescriptions = [
    { role: 'Super Admin', level: 100, access: 'Level 100 — Unrestricted enterprise authority, user provisioning, global settings & enterprise audit logs.', badge: 'badge-danger' },
    { role: 'Store Manager', level: 80, access: 'Level 80 — Assigned store sales, inventory CRUD, purchase orders, customer CRM & daily reporting.', badge: 'badge-warning' },
    { role: 'Inventory Auditor', level: 60, access: 'Level 60 — Inventory stock catalog, FIFO valuation, stock adjustments & goods receiving notes (GRN).', badge: 'badge-neutral' },
    { role: 'Sales Executive', level: 40, access: 'Level 40 — Sales & POS terminal billing checkout, walk-in customer creation, receipt printing & sale photo proof.', badge: 'badge-primary' },
    { role: 'POS Cashier', level: 20, access: 'Level 20 — Sales & POS terminal billing checkout, receipt printing & customer lookup.', badge: 'badge-info' },
  ];

  return (
    <AppLayout activeRoute="/users">
      <div className="space-y-6 fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">User Accounts & Security Hierarchy</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Simple Super Admin Permission Controls, Action ON/OFF Toggles, Store Scope Switches & Security Hierarchy.
            </p>
          </div>

          <button onClick={() => { resetForm(); setInviteModal(true); }} className="btn-primary gap-2">
            <Icon name="UserPlusIcon" size={18} />
            Provision New User
          </button>
        </div>

        {/* Security Level Matrix Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {roleDescriptions.map((rd) => (
            <div key={`matrix-${rd.role}`} className="card p-4 space-y-2 border-l-4" style={{ borderColor: rd.level === 100 ? 'var(--danger)' : rd.level === 80 ? 'var(--warning)' : 'var(--primary)' }}>
              <div className="flex items-center justify-between">
                <span className={`${rd.badge} text-2xs`}>Level {rd.level}</span>
                <span className="text-3xs font-bold uppercase text-muted-foreground">{rd.role}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{rd.access}</p>
            </div>
          ))}
        </div>

        {/* Filter Bar & User Roster */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Authorized System Accounts</h3>
              <p className="text-2xs text-muted-foreground">Server-Side Verified Security Hierarchy & Account Status Controls</p>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
              {(['All', 'Active', 'Inactive', 'Suspended'] as const).map((st) => (
                <button
                  key={`filter-${st}`}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    statusFilter === st ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 text-2xs uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
                  <th className="py-3 px-4">User Identity</th>
                  <th className="py-3 px-4">Role & Security Level</th>
                  <th className="py-3 px-4">Store Scope & Access</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4 text-right">Security Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {visibleUsers.map((u) => {
                  const level = u.securityLevel || (u.role === 'Super Admin' ? 100 : u.role === 'Store Manager' ? 80 : u.role === 'Inventory Auditor' ? 60 : 20);
                  const isProtectedSuperAdmin = u.role === 'Super Admin';
                  const fullUserRecord = usersList.find((usr) => usr.id === u.id);
                  const allowedStores = u.allowedStores || [u.storeScope];

                  return (
                    <tr key={`usr-row-${u.id}`} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-foreground">
                        <div className="flex items-center gap-2.5">
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt={u.name} className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                              {u.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold">{u.name}</p>
                              {isProtectedSuperAdmin && (
                                <span className="text-3xs bg-danger/10 text-danger border border-danger/20 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                                  <Icon name="LockClosedIcon" size={10} /> Level 100 Protected
                                </span>
                              )}
                            </div>
                            <p className="text-2xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`badge ${level === 100 ? 'badge-danger' : level === 80 ? 'badge-warning' : 'badge-info'} text-2xs`}>
                          Level {level} · {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 flex-wrap">
                          {allowedStores.map((st) => (
                            <span key={`st-badge-${st}`} className="badge-secondary text-3xs font-mono font-bold">
                              {st}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={u.status}
                          disabled={isProtectedSuperAdmin && currentUser.role !== 'Super Admin'}
                          onChange={(e) => toggleUserStatus(u.id, e.target.value as any)}
                          className={`text-2xs font-bold px-2 py-1 rounded-md border ${
                            u.status === 'Active'
                              ? 'bg-success/10 text-success border-success/30'
                              : u.status === 'Suspended'
                              ? 'bg-danger/10 text-danger border-danger/30'
                              : 'bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          <option value="Active">ACTIVE</option>
                          <option value="Inactive">INACTIVE</option>
                          <option value="Suspended">SUSPENDED</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => toggleUserShiftStatus(u.id)}
                            className={`btn-ghost text-3xs py-1 px-2 ${u.shiftStatus === 'On Shift' ? 'text-success' : 'text-muted-foreground'}`}
                          >
                            {u.shiftStatus}
                          </button>

                          {/* Performance Analytics Button */}
                          {fullUserRecord && (
                            <button
                              onClick={() => setPerformanceModalUser(fullUserRecord)}
                              className="p-1.5 text-muted-foreground hover:text-info rounded-md"
                              title="View Real User Performance & Activity"
                            >
                              <Icon name="ChartBarIcon" size={15} />
                            </button>
                          )}

                          {/* Permissions Matrix Modal Toggle */}
                          {fullUserRecord && (
                            <button
                              onClick={() => setPermissionsModalUser(fullUserRecord)}
                              className="p-1.5 text-muted-foreground hover:text-primary rounded-md"
                              title="Manage User Access & Permissions Matrix"
                            >
                              <Icon name="ShieldCheckIcon" size={15} />
                            </button>
                          )}

                          {(!isProtectedSuperAdmin || currentUser.role === 'Super Admin') && fullUserRecord && (
                            <>
                              <button onClick={() => openEdit(fullUserRecord)} className="p-1.5 text-muted-foreground hover:text-primary rounded-md" title="Edit User">
                                <Icon name="PencilSquareIcon" size={15} />
                              </button>
                              {u.id !== currentUser.id && (
                                <button onClick={() => handleDeleteClick(fullUserRecord)} className="p-1.5 text-muted-foreground hover:text-danger rounded-md" title="Delete User">
                                  <Icon name="TrashIcon" size={15} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Provision User Modal */}
      <Modal open={inviteModal} onClose={() => setInviteModal(false)} title="Provision New User Account" subtitle="Create credentials and assign security level & store scope" size="md">
        <form onSubmit={handleInviteSubmit} className="space-y-3.5 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Full Name *</label>
              <input type="text" required placeholder="Pooja Deshmukh" value={name} onChange={(e) => setName(e.target.value)} className="input-field text-xs" />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Email Address *</label>
              <input type="email" required placeholder="pooja@cosko.com" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Assign Role & Level *</label>
              <select value={role} onChange={(e) => setRole(e.target.value as any)} className="input-field text-xs font-medium">
                <option value="Store Manager">Level 80 — Store Manager</option>
                <option value="Inventory Auditor">Level 60 — Inventory Auditor</option>
                <option value="Sales Executive">Level 40 — Sales Executive</option>
                <option value="POS Cashier">Level 20 — POS Cashier</option>
                <option value="Super Admin">Level 100 — Super Admin</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Primary Store *</label>
              <select value={store} onChange={(e) => setStore(e.target.value)} className="input-field text-xs font-medium">
                {storesList.map((st) => (
                  <option key={`prov-${st.code}`} value={st.code}>
                    {st.code} — {st.name}
                  </option>
                ))}
                <option value="All Stores">All Stores (Enterprise)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Account Status *</label>
              <select value={userStatus} onChange={(e) => setUserStatusState(e.target.value as any)} className="input-field text-xs font-medium">
                <option value="Active">ACTIVE</option>
                <option value="Inactive">INACTIVE</option>
                <option value="Suspended">SUSPENDED</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Account Password *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Set password for user"
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

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={() => setInviteModal(false)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs">Provision Account</button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      {editUserModal && (
        <Modal open={!!editUserModal} onClose={() => setEditUserModal(null)} title="Edit Security Credentials & Scope" subtitle={`Updating account for ${editUserModal.name}`} size="md">
          <form onSubmit={handleUpdateUserSubmit} className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Full Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field text-xs" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value as any)} className="input-field text-xs font-medium">
                  <option value="Store Manager">Level 80 — Store Manager</option>
                  <option value="Inventory Auditor">Level 60 — Inventory Auditor</option>
                  <option value="Sales Executive">Level 40 — Sales Executive</option>
                  <option value="POS Cashier">Level 20 — POS Cashier</option>
                  <option value="Super Admin">Level 100 — Super Admin</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Primary Store</label>
                <select value={store} onChange={(e) => setStore(e.target.value)} className="input-field text-xs font-medium">
                  {storesList.map((st) => (
                    <option key={`edit-${st.code}`} value={st.code}>
                      {st.code} — {st.name}
                    </option>
                  ))}
                  <option value="All Stores">All Stores (Enterprise)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Status</label>
                <select value={userStatus} onChange={(e) => setUserStatusState(e.target.value as any)} className="input-field text-xs font-medium">
                  <option value="Active">ACTIVE</option>
                  <option value="Inactive">INACTIVE</option>
                  <option value="Suspended">SUSPENDED</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Reset Password (Optional)</label>
              <input type="password" placeholder="Leave blank to keep existing password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field text-xs" />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button type="button" onClick={() => setEditUserModal(null)} className="btn-secondary text-xs">Cancel</button>
              <button type="submit" className="btn-primary text-xs">Save Account Changes</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Super Admin User Access & Permissions Matrix Modal */}
      {permissionsModalUser && (
        <Modal
          open={!!permissionsModalUser}
          onClose={() => setPermissionsModalUser(null)}
          title={`User Access & Permissions — ${permissionsModalUser.name}`}
          subtitle={`${permissionsModalUser.email} · Role: ${permissionsModalUser.role} (Level ${permissionsModalUser.securityLevel || (permissionsModalUser.role === 'Super Admin' ? 100 : 80)})`}
          size="lg"
        >
          <div className="space-y-5 py-2">
            {/* Store Access ON/OFF Switches */}
            <div className="card p-4 bg-muted/30 border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">AUTHORIZED STORE SCOPE ACCESS</span>
                <span className="text-2xs text-muted-foreground">Toggle store outlets accessible by this user</span>
              </div>

              <div className="flex items-center gap-4 flex-wrap pt-1">
                {storesList.map((stHub) => {
                  const allowedStores = permissionsModalUser.allowedStores || [permissionsModalUser.store];
                  const isStoreOn = permissionsModalUser.store === 'All Stores' || allowedStores.includes(stHub.code);

                  return (
                    <div key={`st-toggle-${stHub.code}`} className="flex items-center justify-between gap-3 bg-card px-3.5 py-2 rounded-xl border border-border min-w-[140px]">
                      <div>
                        <span className="text-xs font-bold text-foreground font-mono">{stHub.code}</span>
                        <span className="text-3xs text-muted-foreground block">{stHub.city}</span>
                      </div>

                      {/* Prominent Store ON / OFF Toggle Button */}
                      <button
                        type="button"
                        onClick={() => toggleUserStoreAccess(permissionsModalUser.id, stHub.code)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all shadow-xs flex items-center gap-1 ${
                          isStoreOn
                            ? 'bg-success text-white hover:bg-success/90'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80 border border-border'
                        }`}
                      >
                        {isStoreOn ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Bulk Action Buttons */}
            <div className="flex items-center justify-between gap-2 flex-wrap bg-primary/5 p-3 rounded-xl border border-primary/20">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Icon name="AdjustmentsHorizontalIcon" size={16} className="text-primary" />
                <span>Quick Permission Toggles (Safe Actions Only)</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    PERMISSION_CATALOGUE.forEach((perm) => {
                      if (!perm.isProtected) {
                        setUserPermissionOverride(permissionsModalUser.id, perm.code, 'ALLOW');
                      }
                    });
                    toast.success(`Enabled all non-protected permissions for ${permissionsModalUser.name}`);
                  }}
                  className="btn-secondary text-3xs font-bold text-success border-success/30 hover:bg-success/10 py-1"
                >
                  Enable All Allowed Permissions
                </button>

                <button
                  type="button"
                  onClick={() => {
                    PERMISSION_CATALOGUE.forEach((perm) => {
                      if (!perm.isProtected) {
                        setUserPermissionOverride(permissionsModalUser.id, perm.code, 'RESET');
                      }
                    });
                    toast.info(`Reset custom permission overrides for ${permissionsModalUser.name}`);
                  }}
                  className="btn-secondary text-3xs font-bold text-muted-foreground py-1"
                >
                  Disable All Optional Overrides
                </button>
              </div>
            </div>

            {/* Expandable Module Permission Groups */}
            <div className="max-h-96 overflow-y-auto scrollbar-thin space-y-3">
              {Object.entries(categoriesList).map(([category, perms]) => {
                const isCollapsed = collapsedCategories[category];

                // Page View Permission Code
                const pageViewPerm = perms.find((p) => p.code.endsWith('.view'));
                const pageViewState = pageViewPerm ? RBACEngine.getPermissionState({
                  id: permissionsModalUser.id,
                  name: permissionsModalUser.name,
                  email: permissionsModalUser.email,
                  role: permissionsModalUser.role,
                  securityLevel: (permissionsModalUser.securityLevel as any) || (permissionsModalUser.role === 'Super Admin' ? 100 : 80),
                  storeScope: permissionsModalUser.store,
                  status: permissionsModalUser.status,
                  permissions: permissionsModalUser.permissions || [],
                  overrides: permissionsModalUser.overrides || [],
                }, pageViewPerm.code) : 'Denied';

                const isPageOn = pageViewState === 'Allowed' || pageViewState === 'Custom Allow';

                return (
                  <div key={`cat-sec-${category}`} className="border border-border rounded-xl overflow-hidden bg-card">
                    {/* Module Header with Page ON/OFF Switch */}
                    <div className="p-3.5 bg-muted/40 flex items-center justify-between gap-3 cursor-pointer select-none" onClick={() => toggleCategoryCollapse(category)}>
                      <div className="flex items-center gap-2">
                        <button type="button" className="text-muted-foreground hover:text-foreground">
                          <Icon name={isCollapsed ? 'ChevronRightIcon' : 'ChevronDownIcon'} size={16} />
                        </button>
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">{category} MODULE</h4>
                        <span className="text-3xs text-muted-foreground">({perms.length} actions)</span>
                      </div>

                      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        {pageViewPerm && !pageViewPerm.isProtected ? (
                          <button
                            type="button"
                            onClick={() => setUserPermissionOverride(permissionsModalUser.id, pageViewPerm.code, isPageOn ? 'DENY' : 'ALLOW')}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all shadow-xs flex items-center gap-1 ${
                              isPageOn
                                ? 'bg-success text-white hover:bg-success/90'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80 border border-border'
                            }`}
                          >
                            <span>{category} Access:</span>
                            <span>{isPageOn ? 'ON' : 'OFF'}</span>
                          </button>
                        ) : (
                          <span className={`text-3xs font-bold px-2 py-0.5 rounded-full ${isPageOn ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>
                            {category} Access: {isPageOn ? 'ON' : 'OFF'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Toggles Inside Category */}
                    {!isCollapsed && (
                      <div className="p-3 divide-y divide-border space-y-2">
                        {perms.map((perm) => {
                          const permState = RBACEngine.getPermissionState({
                            id: permissionsModalUser.id,
                            name: permissionsModalUser.name,
                            email: permissionsModalUser.email,
                            role: permissionsModalUser.role,
                            securityLevel: (permissionsModalUser.securityLevel as any) || (permissionsModalUser.role === 'Super Admin' ? 100 : 80),
                            storeScope: permissionsModalUser.store,
                            status: permissionsModalUser.status,
                            permissions: permissionsModalUser.permissions || [],
                            overrides: permissionsModalUser.overrides || [],
                          }, perm.code);

                          const isActionOn = permState === 'Allowed' || permState === 'Custom Allow';

                          return (
                            <div key={`perm-item-${perm.code}`} className="pt-2 flex items-center justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-foreground">{perm.name}</span>
                                  <span className="text-3xs font-mono text-muted-foreground">({perm.code})</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                {perm.isProtected && (permissionsModalUser.securityLevel || 80) < 100 ? (
                                  <span className="badge-danger text-3xs flex items-center gap-1 font-bold">
                                    <Icon name="LockClosedIcon" size={11} /> 🔒 Super Admin Only
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    {/* Prominent ON / OFF Clickable Toggle Button */}
                                    <button
                                      type="button"
                                      onClick={() => setUserPermissionOverride(permissionsModalUser.id, perm.code, isActionOn ? 'DENY' : 'ALLOW')}
                                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
                                        isActionOn
                                          ? 'bg-success text-white hover:bg-success/90'
                                          : 'bg-muted text-muted-foreground hover:bg-muted/80 border border-border'
                                      }`}
                                    >
                                      <span>{isActionOn ? 'ON' : 'OFF'}</span>
                                      <span className="text-3xs font-normal opacity-80">({permState})</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button onClick={() => setPermissionsModalUser(null)} className="btn-primary text-xs">Save Access Settings</button>
            </div>
          </div>
        </Modal>
      )}

      {/* User Activity & Real Performance Drawer / Modal */}
      {performanceModalUser && (
        <Modal
          open={!!performanceModalUser}
          onClose={() => setPerformanceModalUser(null)}
          title={`Real Performance Analytics — ${performanceModalUser.name}`}
          subtitle={`${performanceModalUser.role} (Level ${performanceModalUser.securityLevel || 80}) · Store Scope: ${performanceModalUser.store}`}
          size="lg"
        >
          {(() => {
            const perf = getUserPerformance(performanceModalUser);
            return (
              <div className="space-y-5 py-2">
                {/* Performance Metric Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="card p-3.5 bg-muted/30 border border-border">
                    <p className="text-2xs font-semibold text-muted-foreground uppercase">Sales Revenue</p>
                    <p className="text-lg font-bold text-foreground font-tabular mt-1">₹{perf.revenue.toLocaleString('en-IN')}</p>
                    <p className="text-3xs text-muted-foreground mt-0.5">{perf.salesCount} total transactions</p>
                  </div>

                  <div className="card p-3.5 bg-muted/30 border border-border">
                    <p className="text-2xs font-semibold text-muted-foreground uppercase">Avg Order Value (AOV)</p>
                    <p className="text-lg font-bold text-foreground font-tabular mt-1">₹{Math.round(perf.aov).toLocaleString('en-IN')}</p>
                    <p className="text-3xs text-muted-foreground mt-0.5">Per order metric</p>
                  </div>

                  <div className="card p-3.5 bg-muted/30 border border-border">
                    <p className="text-2xs font-semibold text-muted-foreground uppercase">Activity Log Count</p>
                    <p className="text-lg font-bold text-foreground font-tabular mt-1">{perf.auditCount}</p>
                    <p className="text-3xs text-muted-foreground mt-0.5">Verified server actions</p>
                  </div>
                </div>

                {/* Operations Summary */}
                <div className="card p-4 border border-border space-y-3">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Store Operations Handled</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-border">
                      <span className="text-muted-foreground">Purchase Orders (POs):</span>
                      <span className="font-bold text-foreground">{perf.purchasesCount}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border">
                      <span className="text-muted-foreground">Operating Expenses:</span>
                      <span className="font-bold text-foreground">{perf.expensesCount}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-border">
                  <button onClick={() => setPerformanceModalUser(null)} className="btn-primary text-xs">Close Performance View</button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteConfirmModal && (
        <Modal open={!!deleteConfirmModal} onClose={() => setDeleteConfirmModal(null)} title="Delete User Account" subtitle={`Are you sure you want to remove ${deleteConfirmModal.name}?`} size="sm">
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              If this account has historical sales, inventory adjustments, or audit log entries associated with it, consider setting status to <span className="font-bold text-danger">SUSPENDED</span> instead of deleting.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button onClick={() => setDeleteConfirmModal(null)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={() => { deleteUserAccount(deleteConfirmModal.id); setDeleteConfirmModal(null); }} className="btn-danger text-xs">
                Delete Account
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
