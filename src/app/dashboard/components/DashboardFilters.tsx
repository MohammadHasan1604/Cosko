'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

const dateRanges = [
  'Today',
  'Yesterday',
  'Last 7 Days',
  'This Week',
  'This Month',
  'Last Month',
  'This Quarter',
  'This Year',
  'Custom Range',
];

export default function DashboardFilters() {
  const {
    selectedStore,
    setSelectedStore,
    datePeriod,
    setDatePeriod,
    customDateRange,
    setCustomDateRange,
    currentUser,
    storesList,
  } = useApp();

  const [storeOpen, setStoreOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);

  // Custom Range Modal state
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [startDate, setStartDate] = useState(customDateRange?.start || '');
  const [endDate, setEndDate] = useState(customDateRange?.end || '');

  const handleExport = () => {
    const periodLabel =
      datePeriod === 'Custom Range' && customDateRange?.start && customDateRange?.end
        ? `${customDateRange.start} to ${customDateRange.end}`
        : datePeriod;
    toast.success(`Executive dashboard analytics report exported for ${selectedStore} (${periodLabel})`);
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

  const handleSelectRange = (range: string) => {
    setRangeOpen(false);
    if (range === 'Custom Range') {
      const now = new Date();
      if (!startDate) {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400 * 1000);
        setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
      }
      if (!endDate) {
        setEndDate(now.toISOString().split('T')[0]);
      }
      setCustomModalOpen(true);
      return;
    }

    setDatePeriod(range);
    toast.info(`Filtered dashboard view to ${range}`);
  };

  const handleApplyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error('Please select both Start Date and End Date');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error('Start date cannot be after End date');
      return;
    }

    setCustomDateRange({ start: startDate, end: endDate });
    setDatePeriod('Custom Range');
    setCustomModalOpen(false);
    toast.info(`Filtered dashboard to custom range: ${startDate} to ${endDate}`);
  };

  const sortedStores = [...storesList].sort((a, b) => {
    if (a.code === 'CENTRAL') return -1;
    if (b.code === 'CENTRAL') return 1;
    return a.code.localeCompare(b.code);
  });

  const displayDatePeriod =
    datePeriod === 'Custom Range' && customDateRange?.start && customDateRange?.end
      ? `${customDateRange.start} → ${customDateRange.end}`
      : datePeriod;

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
          <span className="max-w-[210px] truncate">{displayDatePeriod}</span>
          <Icon name="ChevronDownIcon" size={13} className="text-muted-foreground" />
        </button>
        {rangeOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-52 bg-card border border-border rounded-xl shadow-modal z-30 py-1.5 fade-in">
            {dateRanges.map((r) => {
              const isSelected = datePeriod === r;
              return (
                <button
                  key={`range-${r}`}
                  onClick={() => handleSelectRange(r)}
                  className={`w-full text-left px-4 py-2 text-xs transition-colors duration-100 flex items-center justify-between ${
                    isSelected ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <span>{r}</span>
                  {isSelected && <Icon name="CheckIcon" size={14} className="text-primary" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Export */}
      <button onClick={handleExport} className="btn-secondary py-2 px-3 text-sm gap-1.5">
        <Icon name="ArrowDownTrayIcon" size={14} />
        Export Report
      </button>

      {/* Custom Date Range Modal */}
      <Modal
        open={customModalOpen}
        onClose={() => setCustomModalOpen(false)}
        title="Select Custom Date Range"
        subtitle="Filter all dashboard KPIs, charts, and metrics for a specific time window"
        size="sm"
      >
        <form onSubmit={handleApplyCustomRange} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="input-field w-full text-xs font-medium"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="input-field w-full text-xs font-medium"
              />
            </div>
          </div>

          <div className="p-3 bg-muted/40 rounded-xl border border-border/50 text-2xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Active Filter Scope</p>
            <p>Store Scope: <span className="font-semibold text-primary">{selectedStore}</span></p>
            <p>Changing date window immediately recalculates all revenue, profit, payables, and ranking analytics.</p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setCustomModalOpen(false)}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary text-xs px-4 py-1.5 gap-1.5"
            >
              <Icon name="CheckIcon" size={13} />
              Apply Custom Filter
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}