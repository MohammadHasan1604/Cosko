'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import BottomSheet from '@/components/ui/BottomSheet';
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

  // Mobile filter sheet
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // Desktop dropdowns
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
    toast.success(
      `Executive dashboard analytics report exported for ${selectedStore} (${periodLabel})`
    );
  };

  const handleSelectStore = (storeCode: string) => {
    if (currentUser.role !== 'Super Admin') {
      if (storeCode === 'All Stores') {
        toast.error(
          'Store Scope Restricted: Enterprise "All Stores" scope is restricted to Super Admin accounts only.'
        );
        setStoreOpen(false);
        return;
      }
      const assignedStore =
        currentUser.store && currentUser.store !== 'All Stores' ? currentUser.store : 'CENTRAL';
      if (storeCode !== assignedStore) {
        toast.error(
          `Store Scope Restricted: As ${currentUser.role}, you can only access data for your assigned store (${assignedStore}).`
        );
        setStoreOpen(false);
        return;
      }
    }
    setSelectedStore(storeCode);
    setStoreOpen(false);
  };

  const handleSelectRange = (range: string) => {
    setRangeOpen(false);
    setFilterSheetOpen(false);
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

  const activeFilterCount =
    (selectedStore !== 'All Stores' ? 1 : 0) + (datePeriod !== 'This Month' ? 1 : 0);

  return (
    <>
      {/* ─── Mobile: Compact filter trigger ─── */}
      <div className="flex items-center gap-1.5 md:hidden">
        <button
          onClick={() => setFilterSheetOpen(true)}
          className="btn-outline text-xs px-3 gap-1.5"
          aria-label="Open filters"
        >
          <Icon name="FunnelIcon" size={14} />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-primary text-white text-3xs font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
        <button onClick={handleExport} className="btn-ghost btn-icon-sm" aria-label="Export report">
          <Icon name="ArrowDownTrayIcon" size={15} />
        </button>
      </div>

      {/* ─── Desktop: Inline filter controls ─── */}
      <div className="hidden md:flex items-center gap-2">
        {/* Store selector */}
        <div className="relative">
          <button
            onClick={() => {
              setStoreOpen((v) => !v);
              setRangeOpen(false);
            }}
            className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground hover:border-slate-300 transition-all shadow-2xs"
          >
            <Icon name="MapPinIcon" size={13} className="text-primary flex-shrink-0" />
            <span className="max-w-[160px] truncate">
              {selectedStore === 'All Stores' ? 'All Stores' : selectedStore}
            </span>
            <Icon
              name="ChevronDownIcon"
              size={12}
              className="text-muted-foreground flex-shrink-0"
            />
          </button>
          {storeOpen && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-card border border-border rounded-xl shadow-dropdown z-30 py-1.5 fade-in">
              <div className="px-2.5 pb-1 pt-0.5">
                <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Reporting Scope
                </span>
                <button
                  onClick={() => handleSelectStore('All Stores')}
                  disabled={currentUser.role !== 'Super Admin'}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between ${
                    currentUser.role !== 'Super Admin'
                      ? 'text-muted-foreground/50 opacity-60 cursor-not-allowed'
                      : selectedStore === 'All Stores'
                        ? 'bg-primary/8 text-primary font-bold'
                        : 'text-foreground hover:bg-muted font-medium'
                  }`}
                >
                  <div>
                    <span className="block font-semibold">All Stores (Consolidated)</span>
                    <span className="text-3xs text-muted-foreground">Aggregated reporting</span>
                  </div>
                  {currentUser.role !== 'Super Admin' ? (
                    <Icon
                      name="LockClosedIcon"
                      size={12}
                      className="text-muted-foreground flex-shrink-0"
                    />
                  ) : selectedStore === 'All Stores' ? (
                    <Icon name="CheckIcon" size={13} className="text-primary flex-shrink-0" />
                  ) : null}
                </button>
              </div>

              <div className="my-1 border-t border-border/60" />

              <div className="px-2.5 pt-0.5">
                <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Store Locations
                </span>
                <div className="space-y-0.5 max-h-48 overflow-y-auto scrollbar-thin">
                  {sortedStores.map((st) => {
                    const assignedStore =
                      currentUser.store && currentUser.store !== 'All Stores'
                        ? currentUser.store
                        : 'CENTRAL';
                    const isLocked =
                      currentUser.role !== 'Super Admin' && st.code !== assignedStore;
                    const isSelected = selectedStore === st.code;

                    return (
                      <button
                        key={`store-${st.code}`}
                        onClick={() => handleSelectStore(st.code)}
                        disabled={isLocked}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between ${
                          isLocked
                            ? 'text-muted-foreground/50 opacity-60 cursor-not-allowed'
                            : isSelected
                              ? 'bg-primary/8 text-primary font-bold'
                              : 'text-foreground hover:bg-muted font-medium'
                        }`}
                      >
                        <span className="truncate">
                          {st.code} — {st.name}
                        </span>
                        {isLocked ? (
                          <Icon
                            name="LockClosedIcon"
                            size={12}
                            className="text-muted-foreground flex-shrink-0"
                          />
                        ) : isSelected ? (
                          <Icon name="CheckIcon" size={13} className="text-primary flex-shrink-0" />
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
            onClick={() => {
              setRangeOpen((v) => !v);
              setStoreOpen(false);
            }}
            className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground hover:border-slate-300 transition-all shadow-2xs"
          >
            <Icon name="CalendarDaysIcon" size={13} className="text-primary flex-shrink-0" />
            <span className="max-w-[180px] truncate">{displayDatePeriod}</span>
            <Icon
              name="ChevronDownIcon"
              size={12}
              className="text-muted-foreground flex-shrink-0"
            />
          </button>
          {rangeOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-xl shadow-dropdown z-30 py-1 fade-in">
              {dateRanges.map((r) => {
                const isSelected = datePeriod === r;
                return (
                  <button
                    key={`range-${r}`}
                    onClick={() => handleSelectRange(r)}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded-lg mx-0.5 flex items-center justify-between ${
                      isSelected
                        ? 'bg-primary/8 text-primary font-bold'
                        : 'text-foreground hover:bg-muted'
                    }`}
                    style={{ width: 'calc(100% - 4px)' }}
                  >
                    <span>{r}</span>
                    {isSelected && <Icon name="CheckIcon" size={13} className="text-primary" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Export */}
        <button
          onClick={handleExport}
          className="btn-secondary h-8 px-3 text-xs font-semibold gap-1.5"
        >
          <Icon name="ArrowDownTrayIcon" size={13} />
          Export
        </button>
      </div>

      {/* ─── Mobile: Filter Bottom Sheet ─── */}
      <BottomSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        title="Dashboard Filters"
        footer={
          <button onClick={() => setFilterSheetOpen(false)} className="btn-primary w-full">
            Apply Filters
          </button>
        }
      >
        <div className="space-y-5">
          {/* Store scope */}
          <div>
            <label className="label-text">Store Scope</label>
            <div className="space-y-1">
              <button
                onClick={() => {
                  handleSelectStore('All Stores');
                }}
                disabled={currentUser.role !== 'Super Admin'}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center justify-between border ${
                  currentUser.role !== 'Super Admin'
                    ? 'text-muted-foreground opacity-50 cursor-not-allowed border-border/40'
                    : selectedStore === 'All Stores'
                      ? 'bg-primary/8 text-primary font-semibold border-primary/20'
                      : 'text-foreground border-border/60 active:bg-muted'
                }`}
              >
                <span>All Stores (Consolidated)</span>
                {selectedStore === 'All Stores' && (
                  <Icon name="CheckIcon" size={16} className="text-primary" />
                )}
              </button>
              {sortedStores.map((st) => {
                const assignedStore =
                  currentUser.store && currentUser.store !== 'All Stores'
                    ? currentUser.store
                    : 'CENTRAL';
                const isLocked = currentUser.role !== 'Super Admin' && st.code !== assignedStore;
                const isSelected = selectedStore === st.code;
                return (
                  <button
                    key={`mstore-${st.code}`}
                    onClick={() => handleSelectStore(st.code)}
                    disabled={isLocked}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center justify-between border ${
                      isLocked
                        ? 'text-muted-foreground opacity-50 cursor-not-allowed border-border/40'
                        : isSelected
                          ? 'bg-primary/8 text-primary font-semibold border-primary/20'
                          : 'text-foreground border-border/60 active:bg-muted'
                    }`}
                  >
                    <span>
                      {st.code} — {st.name}
                    </span>
                    {isSelected && <Icon name="CheckIcon" size={16} className="text-primary" />}
                    {isLocked && (
                      <Icon name="LockClosedIcon" size={14} className="text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date range */}
          <div>
            <label className="label-text">Date Period</label>
            <div className="grid grid-cols-2 gap-1.5">
              {dateRanges.map((r) => (
                <button
                  key={`mrange-${r}`}
                  onClick={() => handleSelectRange(r)}
                  className={`px-3 py-2.5 rounded-lg text-sm text-left border ${
                    datePeriod === r
                      ? 'bg-primary/8 text-primary font-semibold border-primary/20'
                      : 'text-foreground border-border/60 active:bg-muted'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </BottomSheet>

      {/* Custom Date Range Modal */}
      <Modal
        open={customModalOpen}
        onClose={() => setCustomModalOpen(false)}
        title="Custom Date Range"
        subtitle="Filter all dashboard metrics for a specific time window"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCustomModalOpen(false)}
              className="btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e: any) => handleApplyCustomRange(e)}
              className="btn-primary text-xs gap-1.5"
            >
              <Icon name="CheckIcon" size={13} />
              Apply Range
            </button>
          </div>
        }
      >
        <form onSubmit={handleApplyCustomRange} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-text">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="label-text">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="input-field text-sm"
              />
            </div>
          </div>

          <div className="p-3 bg-muted/30 rounded-lg border border-border/50 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Active Scope</p>
            <p>
              Store: <span className="font-semibold text-primary">{selectedStore}</span>
            </p>
          </div>
        </form>
      </Modal>
    </>
  );
}
