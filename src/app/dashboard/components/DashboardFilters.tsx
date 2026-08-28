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
      const assignedStore = (currentUser.store && currentUser.store !== 'All Stores') ? currentUser.store : 'BLR';
      if (storeCode !== assignedStore) {
        toast.error(`Store Scope Restricted: As ${currentUser.role}, you can only access data for your assigned store (${assignedStore}).`);
        setStoreOpen(false);
        return;
      }
    }
    setSelectedStore(storeCode);
    setStoreOpen(false);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Store selector */}
      <div className="relative">
        <button
          onClick={() => { setStoreOpen((v) => !v); setRangeOpen(false); }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:border-ring transition-all duration-150 shadow-card"
        >
          <Icon name="MapPinIcon" size={14} className="text-muted-foreground" />
          <span className="max-w-[180px] truncate">{selectedStore}</span>
          {currentUser.role !== 'Super Admin' && (
            <span className="badge-warning text-2xs px-1.5 py-0.5">Assigned</span>
          )}
          <Icon name="ChevronDownIcon" size={13} className="text-muted-foreground" />
        </button>
        {storeOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-60 bg-card border border-border rounded-xl shadow-modal z-30 py-1 fade-in">
            {storeChoices.map((s) => {
              const assignedStore = (currentUser.store && currentUser.store !== 'All Stores') ? currentUser.store : 'BLR';
              const isLocked = currentUser.role !== 'Super Admin' && (s.code === 'All Stores' || s.code !== assignedStore);
              return (
                <button
                  key={`store-${s.code}`}
                  onClick={() => handleSelectStore(s.code)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-100 flex items-center justify-between ${
                    isLocked
                      ? 'text-muted-foreground/50 opacity-60 cursor-not-allowed'
                      : selectedStore === s.code
                      ? 'bg-primary/5 text-primary font-semibold'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <span>{s.label}</span>
                  {isLocked && <Icon name="LockClosedIcon" size={13} className="text-muted-foreground flex-shrink-0" />}
                </button>
              );
            })}
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