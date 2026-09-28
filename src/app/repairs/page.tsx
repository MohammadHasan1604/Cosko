'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import RepairFormModal, { RepairItem } from '@/components/forms/RepairFormModal';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

export default function RepairsPage() {
  const { customers, storesList, currentUser, selectedStore, deleteRepairEnquiry } = useApp();

  const [repairs, setRepairs] = useState<RepairItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    totalEnquiries: 0,
    pendingCount: 0,
    inProgressCount: 0,
    completedCount: 0,
    customersWithRepairs: 0,
    repairAndPurchaseCount: 0,
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState('All');
  const [storeFilter, setStoreFilter] = useState('All Stores');
  const [deviceFilter, setDeviceFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Master Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingRepair, setEditingRepair] = useState<RepairItem | null>(null);

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingRepair, setDeletingRepair] = useState<RepairItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Keep store filter in sync with global store if changed
  useEffect(() => {
    if (currentUser.role !== 'Super Admin') {
      setStoreFilter(currentUser.store || 'BLR');
    } else if (selectedStore !== 'All Stores') {
      setStoreFilter(selectedStore);
    }
  }, [selectedStore, currentUser.role, currentUser.store]);

  const fetchRepairs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (storeFilter !== 'All Stores') params.append('store', storeFilter);
      if (deviceFilter !== 'All') params.append('deviceType', deviceFilter);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`/api/repairs?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRepairs(data.repairs || []);
        setKpis(data.kpis || {
          totalEnquiries: 0,
          pendingCount: 0,
          inProgressCount: 0,
          completedCount: 0,
          customersWithRepairs: 0,
          repairAndPurchaseCount: 0,
        });
      }
    } catch (err) {
      console.error('Failed to load repairs:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, storeFilter, deviceFilter, searchQuery]);

  useEffect(() => {
    fetchRepairs();
  }, [fetchRepairs]);

  const handleOpenEdit = (repair: RepairItem) => {
    setEditingRepair(repair);
  };

  const handleOpenDelete = (repair: RepairItem) => {
    setDeletingRepair(repair);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingRepair) return;
    try {
      setIsDeleting(true);
      const res = await deleteRepairEnquiry(deletingRepair.id);
      if (res?.success) {
        setDeleteModalOpen(false);
        setDeletingRepair(null);
        await fetchRepairs();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed':
      case 'Delivered':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'In Progress':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'Pending Diagnosis':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      default:
        return 'bg-secondary text-secondary-foreground border-border';
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'Mobile':
        return 'DevicePhoneMobileIcon';
      case 'EV':
        return 'BoltIcon';
      case 'TV':
        return 'TvIcon';
      case 'Laptop':
        return 'ComputerDesktopIcon';
      default:
        return 'WrenchScrewdriverIcon';
    }
  };

  return (
    <AppLayout activeRoute="/repairs">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Connected Service Engine
              </span>
              <span className="text-xs text-muted-foreground">Real-time MySQL Synchronized</span>
            </div>
            <h1 className="page-title">
              Repairs & Service Management
            </h1>
            <p className="page-subtitle">
              Directly query, track, log, and bridge device repair records with COSKO retail sales and Customer 360.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/customers/existing"
              className="btn-secondary gap-2 text-xs sm:text-sm font-semibold shadow-xs"
            >
              <Icon name="UsersIcon" size={16} className="text-primary" />
              <span>Existing Customers</span>
            </Link>
            <button
              onClick={() => {
                setEditingRepair(null);
                setCreateModalOpen(true);
              }}
              className="btn-primary gap-2 text-xs sm:text-sm font-semibold shadow-xs"
            >
              <Icon name="PlusIcon" size={16} />
              Log New Repair Ticket
            </button>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="card p-4 flex flex-col justify-between">
            <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">Total Enquiries</span>
            <div className="text-2xl font-extrabold text-foreground font-tabular mt-1">{kpis.totalEnquiries}</div>
            <span className="text-3xs text-muted-foreground mt-1 flex items-center gap-1 font-medium">
              <Icon name="ClipboardDocumentListIcon" size={12} className="text-primary" /> All Records
            </span>
          </div>

          <div className="card p-4 flex flex-col justify-between">
            <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">Pending Diagnosis</span>
            <div className="text-2xl font-extrabold text-amber-500 font-tabular mt-1">{kpis.pendingCount}</div>
            <span className="text-3xs text-amber-500 mt-1 flex items-center gap-1 font-semibold">
              <Icon name="ClockIcon" size={12} /> Action Needed
            </span>
          </div>

          <div className="card p-4 flex flex-col justify-between">
            <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">In Progress</span>
            <div className="text-2xl font-extrabold text-sky-500 font-tabular mt-1">{kpis.inProgressCount}</div>
            <span className="text-3xs text-sky-500 mt-1 flex items-center gap-1 font-semibold">
              <Icon name="WrenchIcon" size={12} /> On Workbench
            </span>
          </div>

          <div className="card p-4 flex flex-col justify-between">
            <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">Completed</span>
            <div className="text-2xl font-extrabold text-emerald-500 font-tabular mt-1">{kpis.completedCount}</div>
            <span className="text-3xs text-emerald-500 mt-1 flex items-center gap-1 font-semibold">
              <Icon name="CheckCircleIcon" size={12} /> Ready/Delivered
            </span>
          </div>

          <div className="card p-4 flex flex-col justify-between">
            <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">Unique Customers</span>
            <div className="text-2xl font-extrabold text-purple-500 font-tabular mt-1">{kpis.customersWithRepairs}</div>
            <span className="text-3xs text-purple-500 mt-1 flex items-center gap-1 font-semibold">
              <Icon name="UserGroupIcon" size={12} /> Distinct Phones
            </span>
          </div>

          <div className="card p-4 flex flex-col justify-between">
            <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">Retail Cross-Sale</span>
            <div className="text-2xl font-extrabold text-cyan-500 font-tabular mt-1">{kpis.repairAndPurchaseCount}</div>
            <span className="text-3xs text-cyan-500 mt-1 flex items-center gap-1 font-semibold">
              <Icon name="ShoppingBagIcon" size={12} /> Linked Purchases
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Icon name="MagnifyingGlassIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket, customer name, phone, or device..."
                className="input-field pl-9 text-xs font-medium"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="select-field text-xs py-1.5 w-auto min-w-[140px]"
              >
                <option value="All">All Statuses</option>
                <option value="Pending Diagnosis">Pending Diagnosis</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              {currentUser.role === 'Super Admin' && (
                <select
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value)}
                  className="select-field text-xs py-1.5 w-auto min-w-[140px]"
                >
                  <option value="All Stores">All Stores</option>
                  {[...storesList]
                    .sort((a, b) => (a.code === 'CENTRAL' ? -1 : b.code === 'CENTRAL' ? 1 : a.code.localeCompare(b.code)))
                    .map((st) => (
                      <option key={`filter-store-${st.code}`} value={st.code}>
                        {st.code} — {st.name}
                      </option>
                    ))}
                </select>
              )}

              <select
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
                className="select-field text-xs py-1.5 w-auto min-w-[140px]"
              >
                <option value="All">All Devices</option>
                <option value="Mobile">Mobile</option>
                <option value="EV">Electric Vehicle (EV)</option>
                <option value="TV">Television</option>
                <option value="AC">Air Conditioner</option>
                <option value="Washing Machine">Washing Machine</option>
                <option value="Laptop">Laptop / PC</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Repairs Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs min-w-[900px]">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3">Ticket No</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Device</th>
                  <th className="px-4 py-3">Reported Issue</th>
                  <th className="px-4 py-3 text-right font-tabular">Est. Cost</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-3">Linked Sale</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span>Querying real-time MySQL repair records...</span>
                      </div>
                    </td>
                  </tr>
                ) : repairs.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                      No repair records matched the selected criteria.
                    </td>
                  </tr>
                ) : (
                  repairs.map((r) => (
                    <tr key={r.id} className="table-row">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-primary">
                        {r.ticketNo}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {r.enquiryDate}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground text-xs">{r.customerName}</div>
                        <div className="text-3xs text-muted-foreground font-mono">{r.customerPhone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded-lg bg-primary/10 text-primary">
                            <Icon name={getDeviceIcon(r.deviceType)} size={14} />
                          </span>
                          <div>
                            <div className="font-semibold text-foreground text-xs">{r.deviceName}</div>
                            <div className="text-3xs text-muted-foreground">{r.deviceType}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground max-w-xs truncate" title={r.issueDescription}>
                        {r.issueDescription}
                      </td>
                      <td className="px-4 py-3 font-tabular text-xs font-extrabold text-foreground text-right whitespace-nowrap">
                        ₹{(Number(r.estimatedCost) || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-3xs font-bold border ${getStatusBadge(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                          {r.storeCode}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {r.linkedCoskoSaleNo ? (
                          <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            <Icon name="CheckCircleIcon" className="w-3.5 h-3.5" />
                            {r.linkedCoskoSaleNo}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                        <Link
                          href={`/repairs/${r.ticketNo}`}
                          className="inline-flex items-center px-2 py-1 rounded-lg border border-border bg-card text-foreground hover:bg-secondary text-xs font-medium"
                          title="View Details"
                        >
                          Details
                        </Link>
                        <Link
                          href={`/customers?phone=${encodeURIComponent(r.customerPhone)}`}
                          className="inline-flex items-center px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium"
                          title="Customer 360"
                        >
                          360
                        </Link>
                        <button
                          onClick={() => handleOpenEdit(r)}
                          className="p-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit Ticket"
                        >
                          <Icon name="PencilSquareIcon" size={14} />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(r)}
                          className="p-1.5 rounded-lg border border-rose-500/20 hover:bg-rose-500/10 text-rose-500 transition-colors"
                          title="Delete Ticket"
                        >
                          <Icon name="TrashIcon" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Master Single Source of Truth Repair Form Modal */}
      <RepairFormModal
        open={createModalOpen || Boolean(editingRepair)}
        onClose={() => {
          setCreateModalOpen(false);
          setEditingRepair(null);
        }}
        repair={editingRepair}
        onSuccess={() => {
          setCreateModalOpen(false);
          setEditingRepair(null);
          fetchRepairs();
        }}
      />

      {/* Delete Repair Ticket Modal */}
      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Repair Ticket" size="sm">
        <div className="py-2 space-y-3 text-sm">
          <p className="text-muted-foreground">
            Are you sure you want to delete repair ticket <span className="font-mono font-bold text-foreground">{deletingRepair?.ticketNo}</span> ({deletingRepair?.deviceName}) for <span className="font-bold text-foreground">{deletingRepair?.customerName}</span>?
          </p>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-600 dark:text-rose-400">
            This action permanently removes this ticket and its technician history from the MySQL database.
          </div>
          <div className="pt-2 border-t border-border flex justify-end gap-2">
            <button type="button" onClick={() => setDeleteModalOpen(false)} className="btn-ghost text-xs" disabled={isDeleting}>
              Cancel
            </button>
            <button type="button" onClick={handleConfirmDelete} className="btn-danger text-xs" disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete Ticket'}
            </button>
          </div>
        </div>
      </Modal>


    </AppLayout>
  );
}
