'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import { PaymentMethodItem } from '@/context/AppContext';

interface PaymentMethodsTabProps {
  paymentMethods: PaymentMethodItem[];
  pmSearch: string;
  setPmSearch: (search: string) => void;
  pmStatusFilter: 'All' | 'Active' | 'Inactive';
  setPmStatusFilter: (status: 'All' | 'Active' | 'Inactive') => void;
  onAddNew: () => void;
  onEdit: (pm: PaymentMethodItem) => void;
  onToggleStatus: (id: string, newChecked: boolean) => Promise<void>;
  onDelete: (pm: PaymentMethodItem) => Promise<void>;
  isSuperAdmin: boolean;
}

export const PaymentMethodsTab: React.FC<PaymentMethodsTabProps> = ({
  paymentMethods,
  pmSearch,
  setPmSearch,
  pmStatusFilter,
  setPmStatusFilter,
  onAddNew,
  onEdit,
  onToggleStatus,
  onDelete,
  isSuperAdmin,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Icon name="CreditCardIcon" size={18} className="text-primary" />
            <span>Payment Methods Master (Single Source of Truth)</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Centralized master registry of payment instruments. Modifications immediately
            synchronize across Sales/POS, Purchases, Vendor Payments, Customer Payments, Expenses,
            and Financial Ledgers.
          </p>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={onAddNew}
            className="btn-primary gap-1.5 text-xs font-bold shadow-xs whitespace-nowrap self-start sm:self-auto cursor-pointer"
          >
            <Icon name="PlusIcon" size={14} />
            <span>+ Add New Payment Method</span>
          </button>
        )}
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Instruments
            </span>
            <span className="w-2 h-2 rounded-full bg-primary" />
          </div>
          <p className="text-xl font-extrabold text-foreground font-tabular mt-1">
            {paymentMethods.length}
          </p>
          <p className="text-3xs text-muted-foreground mt-0.5">Configured in Master DB</p>
        </div>

        <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">
              Active Everywhere
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-tabular mt-1">
            {paymentMethods.filter((pm) => pm.status === 'Active').length}
          </p>
          <p className="text-3xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
            Live on POS & Voucher dropdowns
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">
              Deactivated
            </span>
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          </div>
          <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400 font-tabular mt-1">
            {paymentMethods.filter((pm) => pm.status === 'Inactive').length}
          </p>
          <p className="text-3xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
            Preserved for historical audit integrity
          </p>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Icon
            name="MagnifyingGlassIcon"
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search by name, instrument code, or classification..."
            value={pmSearch}
            onChange={(e) => setPmSearch(e.target.value)}
            className="input-field pl-9 pr-3 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          {(['All', 'Active', 'Inactive'] as const).map((st) => (
            <button
              key={`pm-filter-${st}`}
              type="button"
              onClick={() => setPmStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                pmStatusFilter === st
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-card border-border/80 text-muted-foreground hover:text-foreground'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Payment Methods Table */}
      <div className="border border-border/80 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 sticky left-0 z-20 bg-muted border-r border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                  Payment Method Name
                </th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Instrument Code</th>
                <th className="px-4 py-3">Classification</th>
                <th className="px-4 py-3">Description / Details</th>
                <th className="px-4 py-3 text-center">Live Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {paymentMethods
                .filter((pm) => {
                  const matchesQuery =
                    !pmSearch.trim() ||
                    pm.name.toLowerCase().includes(pmSearch.toLowerCase()) ||
                    pm.code.toLowerCase().includes(pmSearch.toLowerCase()) ||
                    pm.type?.toLowerCase().includes(pmSearch.toLowerCase()) ||
                    pm.description?.toLowerCase().includes(pmSearch.toLowerCase());
                  const matchesStatus = pmStatusFilter === 'All' || pm.status === pmStatusFilter;
                  return matchesQuery && matchesStatus;
                })
                .sort(
                  (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
                )
                .map((pm) => {
                  const isActive = pm.status === 'Active';
                  return (
                    <tr key={`pm-row-${pm.id}`} className="table-row group">
                      <td className="px-4 py-3 sticky left-0 z-10 bg-card group-hover:bg-muted/40 border-r border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground text-xs">{pm.name}</span>
                          {pm.isSystem && (
                            <span className="px-1.5 py-0.2 rounded text-4xs font-bold uppercase tracking-wider bg-secondary text-muted-foreground border border-border">
                              System Core
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground text-3xs">
                        #{pm.sortOrder ?? 0}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-primary text-2xs">
                        {pm.code}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-3xs font-semibold bg-muted text-foreground border border-border/80">
                          {pm.type || 'Instrument'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-3xs max-w-xs truncate">
                        {pm.description || '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isSuperAdmin ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <ToggleSwitch
                              checked={isActive}
                              onChange={(newChecked) => onToggleStatus(pm.id, newChecked)}
                              size="sm"
                              onText="ON"
                              offText="OFF"
                            />
                          </div>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded-full text-3xs font-bold ${
                              isActive
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {pm.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => onEdit(pm)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors inline-flex items-center cursor-pointer"
                              title="Edit Payment Method"
                            >
                              <Icon name="PencilSquareIcon" size={14} />
                            </button>
                          )}

                          {isSuperAdmin && !pm.isSystem && (
                            <button
                              type="button"
                              onClick={() => onDelete(pm)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors inline-flex items-center cursor-pointer"
                              title="Delete Custom Payment Method"
                            >
                              <Icon name="TrashIcon" size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              {paymentMethods.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-xs">
                    No payment methods configured. Click &quot;+ Add New Payment Method&quot; to
                    define your first instrument.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
