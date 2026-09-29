'use client';
import React, { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import Icon from '@/components/ui/AppIcon';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import { useApp, UserAccount } from '@/context/AppContext';
import { toast } from 'sonner';

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  user?: UserAccount | null;
  onSuccess?: (user: UserAccount) => void;
  zIndex?: number;
}

// 🔒 STRICT RBAC: Exactly 2 assignable roles. Super Admin is singleton.
const AVAILABLE_ROLES: Array<{
  role: 'Store Manager' | 'Sales Manager';
  level: number;
  desc: string;
}> = [
  { role: 'Store Manager', level: 80, desc: 'Full Store Operations, Staff & Inventory Control' },
  { role: 'Sales Manager', level: 40, desc: 'POS Sales, Inventory View & Customer Management' },
];

export default function UserFormModal({
  open,
  onClose,
  user,
  onSuccess,
  zIndex = 100,
}: UserFormModalProps) {
  const { currentUser, storesList, addUserAccount, updateUserAccount, confirmAction } = useApp();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'Store Manager' | 'Sales Manager'>('Store Manager');
  // Single source of truth for store access: assignedStores
  const [assignedStores, setAssignedStores] = useState<string[]>(['BLR']);
  const [storeSearch, setStoreSearch] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'Suspended'>('Active');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = Boolean(user);
  const isProtectedSuperAdmin = user?.role === 'Super Admin';
  const isCallerSuperAdmin = currentUser.role === 'Super Admin';

  // Rule 11: Role selector must show only roles caller is permitted to create. Hide forbidden roles.
  const permittedRoles = useMemo(() => {
    if (isCallerSuperAdmin) {
      return AVAILABLE_ROLES;
    }
    if (currentUser.role === 'Store Manager') {
      return AVAILABLE_ROLES.filter((r) => r.role === 'Sales Manager');
    }
    return [];
  }, [isCallerSuperAdmin, currentUser.role]);

  // Caller's allowed stores to assign
  const callerAccessibleStores = useMemo(() => {
    if (isCallerSuperAdmin) {
      return storesList.map((s) => s.code);
    }
    return currentUser.allowedStores && currentUser.allowedStores.length > 0
      ? currentUser.allowedStores
      : [currentUser.store || 'BLR'];
  }, [isCallerSuperAdmin, storesList, currentUser]);

  // Stores available in the selector
  const availableStoreHubs = useMemo(() => {
    return storesList
      .filter((s) => callerAccessibleStores.includes(s.code))
      .sort((a, b) => {
        if (a.code === 'CENTRAL') return -1;
        if (b.code === 'CENTRAL') return 1;
        return a.code.localeCompare(b.code);
      });
  }, [storesList, callerAccessibleStores]);

  // Filtered stores based on search
  const filteredStoreHubs = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    if (!q) return availableStoreHubs;
    return availableStoreHubs.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q)
    );
  }, [availableStoreHubs, storeSearch]);

  useEffect(() => {
    if (open) {
      setStoreSearch('');
      if (user) {
        setName(user.name || '');
        setEmail(user.email || '');
        setPhone(user.phone || '');
        setPassword('');
        setShowPassword(false);
        if (user.role !== 'Super Admin') {
          const userRole = (user.role as any) || 'Sales Manager';
          setRole(
            permittedRoles.some((r) => r.role === userRole)
              ? userRole
              : permittedRoles[0]?.role || 'Sales Manager'
          );
        }
        const initialStores = isCallerSuperAdmin
          ? user.allowedStores && user.allowedStores.length > 0
            ? user.allowedStores
            : user.store
              ? [user.store]
              : [callerAccessibleStores[0] || 'BLR']
          : [currentUser.store || 'BLR'];
        setAssignedStores(initialStores);
        setStatus((user.status as any) || 'Active');
      } else {
        setName('');
        setEmail('');
        setPhone('');
        setPassword('');
        setShowPassword(false);
        // Default role: Super Admin can choose Store Manager, Store Manager only gets Sales Manager
        setRole(isCallerSuperAdmin ? 'Store Manager' : 'Sales Manager');
        // Store Manager always automatically uses manager's own store
        const defaultStore = isCallerSuperAdmin
          ? callerAccessibleStores[0] || 'BLR'
          : currentUser.store || 'BLR';
        setAssignedStores([defaultStore]);
        setStatus('Active');
      }
    }
  }, [open, user, callerAccessibleStores, isCallerSuperAdmin, currentUser.store, permittedRoles]);

  // Rule 11: Sales Manager must not access user creation
  if (!open || currentUser.role === 'Sales Manager') return null;

  // Toggle store assignment ON/OFF
  const toggleStoreAssignment = (code: string) => {
    if (isProtectedSuperAdmin) {
      toast.info('Super Admin holds unconditional access across all enterprise stores.');
      return;
    }
    setAssignedStores((prev) => {
      if (prev.includes(code)) {
        if (prev.length === 1) {
          toast.error('A team member must be assigned to at least one store.');
          return prev;
        }
        return prev.filter((c) => c !== code);
      }
      return [...prev, code];
    });
  };

  const handleSelectAllStores = () => {
    if (!isCallerSuperAdmin) return;
    setAssignedStores(availableStoreHubs.map((s) => s.code));
    toast.success(`Assigned all ${availableStoreHubs.length} store locations.`);
  };

  const handleClearStores = () => {
    const fallback = callerAccessibleStores[0] || 'BLR';
    setAssignedStores([fallback]);
    toast.info(`Reset to single default store: ${fallback}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail) {
      toast.error('Full Name and Email are required.');
      return;
    }

    if (!isEdit && !password) {
      toast.error('Account initial password is required.');
      return;
    }

    if (!isProtectedSuperAdmin && assignedStores.length === 0) {
      toast.error('Please assign the team member to at least one store.');
      return;
    }

    const assignedSummary = isProtectedSuperAdmin
      ? 'All Stores (Enterprise Unrestricted)'
      : assignedStores.join(', ');

    const confirmed = await confirmAction({
      actionType: isEdit ? 'update' : 'create',
      title: isEdit ? `Confirm Team Member Update: ${cleanName}` : 'Confirm Register Team Member',
      subtitle: 'Please review credentials, operational role, and assigned store access.',
      confirmLabel: isEdit ? 'Confirm & Update Member' : 'Confirm & Register Member',
      summaryItems: [
        { label: 'Full Name', value: cleanName, highlighted: true },
        { label: 'Official Email', value: cleanEmail },
        {
          label: 'Operational Role',
          value: isProtectedSuperAdmin ? 'Super Admin (Level 100)' : role,
        },
        {
          label: 'Assigned Store(s)',
          value: `${assignedSummary} (${assignedStores.length} store${assignedStores.length > 1 ? 's' : ''})`,
        },
        { label: 'Account Status', value: status },
      ],
      warningMessage: isProtectedSuperAdmin
        ? 'NOTE: Modifying profile details for the protected system Super Admin.'
        : 'Team member permissions and assigned store access will be synchronized across MySQL and real-time sessions.',
    });

    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const primaryStore = assignedStores[0] || 'BLR';

      if (isEdit && user) {
        const updatePayload: any = {
          name: cleanName,
          email: cleanEmail,
          phone: phone.trim() || undefined,
          status,

          assignedStores: isProtectedSuperAdmin ? undefined : assignedStores,
          allowedStores: isProtectedSuperAdmin ? undefined : assignedStores,
          store: isProtectedSuperAdmin ? 'All Stores' : primaryStore,
        };

        if (!isProtectedSuperAdmin) {
          updatePayload.role = role;
        }

        if (password) {
          updatePayload.password = password;
        }

        const res = await updateUserAccount(user.id, updatePayload);
        if (res?.success !== false) {
          toast.success(`Team member "${cleanName}" updated successfully!`);
          if (onSuccess) {
            onSuccess({
              ...user,
              name: cleanName,
              email: cleanEmail,
              phone: phone.trim(),
              role: isProtectedSuperAdmin ? 'Super Admin' : role,
              store: isProtectedSuperAdmin ? 'All Stores' : primaryStore,
              allowedStores: assignedStores,
              status,
            });
          }
          onClose();
        }
      } else {
        const res = await addUserAccount({
          name: cleanName,
          email: cleanEmail,
          password,
          phone: phone.trim() || '+91 99000 12345',
          role,
          store: primaryStore,
          assignedStores,
          allowedStores: assignedStores,
          status,
        } as any);

        if (res?.success !== false) {
          toast.success(`Team member "${cleanName}" registered successfully!`);
          if (onSuccess && res) onSuccess((res as any).user || res);
          onClose();
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save team member');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Team Member: ${user?.name}` : 'Register New Team Member'}
      subtitle={
        isEdit
          ? `Manage operational profile and store assignments for ${user?.email}`
          : 'Provision new staff account, operational role, and assigned store access'
      }
      size="md"
      zIndex={zIndex}
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        {/* Protected Super Admin Notice Banner */}
        {isProtectedSuperAdmin && (
          <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="ShieldCheckIcon" size={18} />
              <div>
                <p className="font-bold text-xs">Protected System Root Account</p>
                <p className="text-3xs text-danger/80">
                  Role: Super Admin (Level 100) · Unrestricted System Authority
                </p>
              </div>
            </div>
            <span className="badge-danger text-3xs font-extrabold flex items-center gap-1">
              <Icon name="LockClosedIcon" size={11} /> Locked
            </span>
          </div>
        )}

        {/* 1. Name & Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              Full Name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Ananya Rao"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              Official Email <span className="text-danger">*</span>
            </label>
            <input
              type="email"
              required
              placeholder="ananya@cosko.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field text-xs"
            />
          </div>
        </div>

        {/* 2. Phone & Password */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Contact Phone</label>
            <input
              type="tel"
              placeholder="+91 99000 12345"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field text-xs font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              {isEdit ? 'Change Password (Leave blank to keep)' : 'Initial Password *'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required={!isEdit}
                placeholder={isEdit ? '••••••••' : 'Min 8 characters'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field text-xs pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* 3. Operational Role & RBAC Level */}
        <div>
          <label className="text-xs font-bold text-foreground block mb-1">
            System Role & RBAC Clearance <span className="text-danger">*</span>
          </label>
          {isProtectedSuperAdmin ? (
            <div className="input-field text-xs font-semibold bg-muted text-muted-foreground flex items-center justify-between cursor-not-allowed">
              <span>Super Admin (Level 100 — System Root)</span>
              <Icon name="LockClosedIcon" size={13} className="text-muted-foreground" />
            </div>
          ) : (
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="input-field text-xs font-medium"
            >
              {permittedRoles.map((r) => (
                <option key={r.role} value={r.role}>
                  {r.role} (Level {r.level}) — {r.desc}
                </option>
              ))}
            </select>
          )}
          <p className="text-3xs text-muted-foreground mt-1">
            Defines module access clearances, financial reporting authorities, and POS terminal
            privileges.
          </p>
        </div>

        {/* 4. Assigned Store(s) — Rule 11: Super Admin may see Assigned Store. Store Manager creating Sales Manager: control MUST NOT render, optionally read-only */}
        {isCallerSuperAdmin ? (
          <div className="space-y-2 p-3.5 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <Icon name="BuildingStorefrontIcon" size={15} className="text-primary" />
                  <label className="text-xs font-bold text-foreground">
                    Assigned Store(s) <span className="text-danger">*</span>
                  </label>
                </div>
                <p className="text-3xs text-muted-foreground mt-0.5">
                  Single source of truth: User will strictly only access stores assigned here.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="badge-primary text-3xs font-bold">
                  {assignedStores.length} Store{assignedStores.length !== 1 ? 's' : ''} Assigned
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleSelectAllStores}
                    className="text-3xs text-primary hover:underline font-semibold"
                  >
                    Select All
                  </button>
                  <span className="text-muted-foreground text-3xs">·</span>
                  <button
                    type="button"
                    onClick={handleClearStores}
                    className="text-3xs text-muted-foreground hover:text-foreground font-semibold"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* Search Box for Store Selector */}
            <div className="relative">
              <Icon
                name="MagnifyingGlassIcon"
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="Search store code, branch name, or city..."
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                className="input-field text-xs pl-8 py-1.5 bg-muted/40"
              />
            </div>

            {/* Store List with Clear ON / OFF Access Toggles */}
            <div className="max-h-48 overflow-y-auto scrollbar-thin divide-y divide-border/60 border border-border/80 rounded-lg bg-muted/10">
              {filteredStoreHubs.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  No store branches match "{storeSearch}"
                </div>
              ) : (
                filteredStoreHubs.map((st) => {
                  const isAssigned = isProtectedSuperAdmin || assignedStores.includes(st.code);

                  return (
                    <div
                      key={`assign-store-${st.code}`}
                      className="p-2.5 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground font-mono">
                            {st.code}
                          </span>
                          <span className="text-xs font-medium text-foreground truncate">
                            {st.name}
                          </span>
                          {st.code === 'CENTRAL' && (
                            <span className="badge-warning text-3xs px-1.5 py-0">Central Hub</span>
                          )}
                        </div>
                        <p className="text-3xs text-muted-foreground truncate">{st.city}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`text-3xs font-extrabold px-1.5 py-0.5 rounded ${
                            isAssigned
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {isAssigned ? 'ASSIGNED' : 'OFF'}
                        </span>
                        <ToggleSwitch
                          checked={isAssigned}
                          disabled={isProtectedSuperAdmin}
                          onChange={() => toggleStoreAssignment(st.code)}
                          size="sm"
                          onText="ON"
                          offText="OFF"
                          title={`Toggle access for ${st.name} (${st.code})`}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* Store Manager creating staff: Control MUST NOT render; store is displayed as read-only contextual info */
          <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <span className="font-bold text-foreground block">Assigned Store Location</span>
              <p className="text-3xs text-muted-foreground">
                Staff member will automatically be assigned to your branch (
                {currentUser.store || 'BLR'}).
              </p>
            </div>
            <span className="badge-primary text-xs font-mono font-bold px-2.5 py-1 rounded-lg">
              {currentUser.store || 'BLR'}
            </span>
          </div>
        )}

        {/* 5. Account Status */}
        <div className="p-3 rounded-xl border border-border bg-card">
          <div>
            <label className="text-2xs font-semibold text-foreground block mb-1">
              Account Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="input-field text-xs font-medium"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex justify-end items-center gap-2 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary text-xs gap-1.5 font-bold"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Icon name="CheckIcon" size={14} />
                {isEdit ? 'Update Team Member' : 'Register Team Member'}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
