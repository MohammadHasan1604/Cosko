'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

const dateRanges = ['Today', 'Yesterday', 'Last 7 Days', 'This Month', 'Last Month', 'This Quarter', 'This Year'];

export default function DashboardFilters() {
  const { selectedStore, setSelectedStore, datePeriod, setDatePeriod, currentUser, storesList } = useApp();
  const [storeOpen, setStoreOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);

  const storeChoices = [
    { code: 'All Stores', label: 'All Stores' },
    ...storesList.map((st) => ({ code: st.code, label: `${st.code} — ${st.name}` })),
  ];

  const handleExport = () => {
    toast.success(`Executive dashboard analytics report exported for ${selectedStore} (${datePeriod})`);
  };

  const handleSelectStore = (storeCode: string) => {
    if (currentUser.role !== 'Super Admin') {
      if (storeCode === 'All Stores') {
        toast.error('Store Scope Restricted: Enterprise "All Stores" scope is restricted to Super Admin accounts only.');
        setStoreOpen(false);
        return;
      }
      const assignedStore = (currentUser.store && currentUser.store !== 'All Stores') ? currentUser.store : 'CENTRAL';
      if (storeCode !== assignedStore) {
        toast.error(`Store Scope Restricted: As ${currentUser.role}, you can only access data for your assigned store (${assignedStore}).`);
        setStoreOpen(false);
        return;
      }
    }
    setSelectedStore(storeCode);
    setStoreOpen(false);
  };

  const sortedStores = [...storesList].sort((a, b) => {
    if (a.code === 'CENTRAL') return -1;
    if (b.code === 'CENTRAL') return 1;
    return a.code.localeCompare(b.code);
  });

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Store selector */}
      <div className="relative">
        <button
          onClick={() => { setStoreOpen((v) => !v); setRangeOpen(false); }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:border-ring transition-all duration-150 shadow-card"
        >
          <Icon name="MapPinIcon" size={14} className="text-muted-foreground" />
          <span className="max-w-[180px] truncate">
            {selectedStore === 'All Stores' ? 'All Stores (Consolidated)' : selectedStore}
          </span>
          {currentUser.role !== 'Super Admin' && (
            <span className="badge-warning text-2xs px-1.5 py-0.5">Assigned</span>
          )}
          <Icon name="ChevronDownIcon" size={13} className="text-muted-foreground" />
        </button>
        {storeOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-72 bg-card border border-border rounded-xl shadow-modal z-30 py-2 fade-in">
            {/* Section 1: Reporting Scope */}
            <div className="px-3 pb-1 pt-0.5">
              <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Enterprise Reporting Scope
              </span>
              <button
                onClick={() => handleSelectStore('All Stores')}
                disabled={currentUser.role !== 'Super Admin'}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors duration-100 flex items-center justify-between ${
                  currentUser.role !== 'Super Admin'
                    ? 'text-muted-foreground/50 opacity-60 cursor-not-allowed'
                    : selectedStore === 'All Stores'
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-foreground hover:bg-muted font-medium'
                }`}
              >
                <div>
                  <span className="block font-semibold">All Stores (Consolidated View)</span>
                  <span className="text-3xs text-muted-foreground">Aggregated reporting only</span>
                </div>
                {currentUser.role !== 'Super Admin' ? (
                  <Icon name="LockClosedIcon" size={13} className="text-muted-foreground flex-shrink-0" />
                ) : selectedStore === 'All Stores' ? (
                  <Icon name="CheckIcon" size={14} className="text-primary flex-shrink-0" />
                ) : null}
              </button>
            </div>

            <div className="my-1.5 border-t border-border" />

            {/* Section 2: Physical Stores */}
            <div className="px-3 pt-0.5">
              <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Physical Store Locations & Warehouses
              </span>
              <div className="space-y-0.5 max-h-52 overflow-y-auto scrollbar-thin">
                {sortedStores.map((st) => {
                  const assignedStore = (currentUser.store && currentUser.store !== 'All Stores') ? currentUser.store : 'CENTRAL';
                  const isLocked = currentUser.role !== 'Super Admin' && st.code !== assignedStore;
                  const isCentral = st.code === 'CENTRAL';
                  const isSelected = selectedStore === st.code;

                  return (
                    <button
                      key={`store-${st.code}`}
                      onClick={() => handleSelectStore(st.code)}
                      disabled={isLocked}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors duration-100 flex items-center justify-between ${
                        isLocked
                          ? 'text-muted-foreground/50 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'bg-primary/10 text-primary font-bold'
                          : 'text-foreground hover:bg-muted font-medium'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold truncate">{st.code} — {st.name}</span>
                          {isCentral && (
                            <span className="text-3xs bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded font-bold">
                              Permanent
                            </span>
                          )}
                        </div>
                        <span className="text-3xs text-muted-foreground block truncate">{st.city} · {st.registers} Registers</span>
                      </div>
                      {isLocked ? (
                        <Icon name="LockClosedIcon" size={13} className="text-muted-foreground flex-shrink-0" />
                      ) : isSelected ? (
                        <Icon name="CheckIcon" size={14} className="text-primary flex-shrink-0" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Date range selector */}
      <div className="relative">
        <button
          onClick={() => { setRangeOpen((v) => !v); setStoreOpen(false); }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:border-ring transition-all duration-150 shadow-card"
        >
          <Icon name="CalendarDaysIcon" size={14} className="text-muted-foreground" />
          <span>{datePeriod}</span>
          <Icon name="ChevronDownIcon" size={13} className="text-muted-foreground" />
        </button>
        {rangeOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-44 bg-card border border-border rounded-xl shadow-modal z-30 py-1 fade-in">
            {dateRanges.map((r) => (
              <button
                key={`range-${r}`}
                onClick={() => { setDatePeriod(r); setRangeOpen(false); toast.info(`Filtered dashboard view to ${r}`); }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-100 ${datePeriod === r ? 'bg-primary/5 text-primary font-semibold' : 'text-foreground hover:bg-muted'}`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Export */}
      <button onClick={handleExport} className="btn-secondary py-2 px-3 text-sm gap-1.5">
        <Icon name="ArrowDownTrayIcon" size={14} />
        Export Report
      </button>
    </div>
  );
}