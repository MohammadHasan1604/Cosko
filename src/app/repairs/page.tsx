'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import { useApp } from '@/context/AppContext';

interface RepairItem {
  id: string;
  ticketNo: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  normalizedPhone: string;
  deviceType: string;
  deviceName: string;
  issueDescription: string;
  status: string;
  estimatedCost?: number;
  storeCode: string;
  enquiryDate: string;
  technicianNotes?: string | null;
  assignedTech?: string | null;
  linkedCoskoSaleNo?: string | null;
}

export default function RepairsPage() {
  const { selectedStore, storesList, addRepairEnquiry, updateRepairEnquiry, deleteRepairEnquiry } = useApp();
  const [repairs, setRepairs] = useState<RepairItem[]>([]);
  const [kpis, setKpis] = useState({
    totalEnquiries: 0,
    pendingCount: 0,
    inProgressCount: 0,
    completedCount: 0,
    customersWithRepairs: 0,
    repairAndPurchaseCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [storeFilter, setStoreFilter] = useState('All Stores');
  const [deviceFilter, setDeviceFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Create Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newDeviceType, setNewDeviceType] = useState('Mobile');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newIssueDescription, setNewIssueDescription] = useState('');
  const [newEstimatedCost, setNewEstimatedCost] = useState<number>(1500);
  const [newStoreCode, setNewStoreCode] = useState(selectedStore === 'All Stores' ? 'CENTRAL' : selectedStore);
  const [newAssignedTech, setNewAssignedTech] = useState('');
  const [newTechnicianNotes, setNewTechnicianNotes] = useState('');
  const [newStatus, setNewStatus] = useState('Pending Diagnosis');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRepair, setEditingRepair] = useState<RepairItem | null>(null);
  const [editStatus, setEditStatus] = useState('Pending Diagnosis');
  const [editDeviceName, setEditDeviceName] = useState('');
  const [editIssueDescription, setEditIssueDescription] = useState('');
  const [editEstimatedCost, setEditEstimatedCost] = useState<number>(0);
  const [editStoreCode, setEditStoreCode] = useState('CENTRAL');
  const [editAssignedTech, setEditAssignedTech] = useState('');
  const [editTechnicianNotes, setEditTechnicianNotes] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingRepair, setDeletingRepair] = useState<RepairItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Keep store filter in sync with global store if changed
  useEffect(() => {
    if (selectedStore !== 'All Stores') {
      setStoreFilter(selectedStore);
    }
  }, [selectedStore]);

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

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmittingCreate(true);
      const res = await addRepairEnquiry({
        customerName: newCustomerName,
        customerPhone: newCustomerPhone,
        deviceType: newDeviceType,
        deviceName: newDeviceName,
        issueDescription: newIssueDescription,
        estimatedCost: newEstimatedCost,
        storeCode: newStoreCode,
        assignedTech: newAssignedTech,
        technicianNotes: newTechnicianNotes,
        status: newStatus,
      });

      if (res?.success) {
        setCreateModalOpen(false);
        // Reset form
        setNewCustomerName('');
        setNewCustomerPhone('');
        setNewDeviceName('');
        setNewIssueDescription('');
        setNewEstimatedCost(1500);
        setNewTechnicianNotes('');
        setNewAssignedTech('');
        await fetchRepairs();
      }
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleOpenEdit = (repair: RepairItem) => {
    setEditingRepair(repair);
    setEditStatus(repair.status);
    setEditDeviceName(repair.deviceName);
    setEditIssueDescription(repair.issueDescription);
    setEditEstimatedCost(repair.estimatedCost || 0);
    setEditStoreCode(repair.storeCode);
    setEditAssignedTech(repair.assignedTech || '');
    setEditTechnicianNotes(repair.technicianNotes || '');
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRepair) return;
    try {
      setIsSubmittingEdit(true);
      const res = await updateRepairEnquiry(editingRepair.id, {
        status: editStatus,
        deviceName: editDeviceName,
        issueDescription: editIssueDescription,
        estimatedCost: editEstimatedCost,
        storeCode: editStoreCode,
        assignedTech: editAssignedTech,
        technicianNotes: editTechnicianNotes,
      });

      if (res?.success) {
        setEditModalOpen(false);
        setEditingRepair(null);
        await fetchRepairs();
      }
    } finally {
      setIsSubmittingEdit(false);
    }
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
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
              Repairs & Service Management
            </h1>
            <p className="text-sm text-muted-foreground">
              Directly query, track, log, and bridge device repair records with COSKO retail sales and Customer 360.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/customers/existing"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary transition-colors text-sm font-medium shadow-sm"
            >
              <Icon name="UsersIcon" className="w-4 h-4 text-primary" />
              <span>Existing Customers</span>
            </Link>
            <button
              onClick={() => {
                setNewStoreCode(selectedStore === 'All Stores' ? 'CENTRAL' : selectedStore);
                setCreateModalOpen(true);
              }}
              className="btn-primary gap-2 text-sm shadow-sm"
            >
              <Icon name="PlusIcon" size={16} />
              Log New Repair Ticket
            </button>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Enquiries</span>
            <div className="text-2xl font-bold text-foreground mt-1">{kpis.totalEnquiries}</div>
            <span className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <Icon name="ClipboardDocumentListIcon" className="w-3.5 h-3.5 text-primary" /> All Records
            </span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-medium text-muted-foreground">Pending Diagnosis</span>
            <div className="text-2xl font-bold text-amber-500 mt-1">{kpis.pendingCount}</div>
            <span className="text-[11px] text-amber-500/80 mt-1 flex items-center gap-1">
              <Icon name="ClockIcon" className="w-3.5 h-3.5" /> Action Needed
            </span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-medium text-muted-foreground">In Progress</span>
            <div className="text-2xl font-bold text-blue-500 mt-1">{kpis.inProgressCount}</div>
            <span className="text-[11px] text-blue-500/80 mt-1 flex items-center gap-1">
              <Icon name="WrenchIcon" className="w-3.5 h-3.5" /> On Workbench
            </span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-medium text-muted-foreground">Completed</span>
            <div className="text-2xl font-bold text-emerald-500 mt-1">{kpis.completedCount}</div>
            <span className="text-[11px] text-emerald-500/80 mt-1 flex items-center gap-1">
              <Icon name="CheckCircleIcon" className="w-3.5 h-3.5" /> Ready/Delivered
            </span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-medium text-muted-foreground">Unique Customers</span>
            <div className="text-2xl font-bold text-purple-500 mt-1">{kpis.customersWithRepairs}</div>
            <span className="text-[11px] text-purple-500/80 mt-1 flex items-center gap-1">
              <Icon name="UserGroupIcon" className="w-3.5 h-3.5" /> Distinct Phones
            </span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-medium text-muted-foreground">Retail Cross-Sale</span>
            <div className="text-2xl font-bold text-cyan-500 mt-1">{kpis.repairAndPurchaseCount}</div>
            <span className="text-[11px] text-cyan-500/80 mt-1 flex items-center gap-1">
              <Icon name="ShoppingBagIcon" className="w-3.5 h-3.5" /> Linked Purchases
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Icon name="MagnifyingGlassIcon" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket, customer name, phone, or device..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="All">All Statuses</option>
                <option value="Pending Diagnosis">Pending Diagnosis</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
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

              <select
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
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
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/40 text-muted-foreground text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-3 font-semibold">Ticket No</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Device</th>
                  <th className="px-4 py-3 font-semibold">Reported Issue</th>
                  <th className="px-4 py-3 font-semibold">Est. Cost</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Store</th>
                  <th className="px-4 py-3 font-semibold">Linked Sale</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span>Querying real-time MySQL repair records...</span>
                      </div>
                    </td>
                  </tr>
                ) : repairs.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                      No repair records matched the selected criteria.
                    </td>
                  </tr>
                ) : (
                  repairs.map((r) => (
                    <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3.5 font-mono text-xs font-bold text-primary">
                        {r.ticketNo}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        {r.enquiryDate}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-foreground text-xs">{r.customerName}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{r.customerPhone}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded-lg bg-primary/10 text-primary">
                            <Icon name={getDeviceIcon(r.deviceType)} className="w-4 h-4" />
                          </span>
                          <div>
                            <div className="font-medium text-foreground text-xs">{r.deviceName}</div>
                            <div className="text-[11px] text-muted-foreground">{r.deviceType}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-foreground max-w-xs truncate" title={r.issueDescription}>
                        {r.issueDescription}
                      </td>
                      <td className="px-4 py-3.5 font-tabular text-xs font-semibold text-foreground whitespace-nowrap">
                        ₹{(Number(r.estimatedCost) || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
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

      {/* Log New Repair Ticket Modal */}
      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Log New Repair Ticket" size="lg">
        <form onSubmit={handleCreateSubmit} className="space-y-4 py-2 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Customer Name *</label>
              <input
                required
                type="text"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                className="input-field py-2"
                placeholder="e.g. Priya Sharma"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Customer Phone *</label>
              <input
                required
                type="tel"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                className="input-field py-2 font-mono"
                placeholder="e.g. +91 98450 11223"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Device Type</label>
              <select value={newDeviceType} onChange={(e) => setNewDeviceType(e.target.value)} className="input-field py-2">
                {['Mobile', 'Tablet', 'Laptop', 'Smartwatch', 'EV', 'AC', 'TV', 'Washing Machine', 'Refrigerator', 'Other'].map((dt) => (
                  <option key={`dt-${dt}`} value={dt}>{dt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Device Name / Model *</label>
              <input
                required
                type="text"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                className="input-field py-2"
                placeholder="e.g. iPhone 14 Pro"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Store / Service Hub *</label>
              <select value={newStoreCode} onChange={(e) => setNewStoreCode(e.target.value)} className="input-field py-2 font-medium">
                {[...storesList]
                  .sort((a, b) => (a.code === 'CENTRAL' ? -1 : b.code === 'CENTRAL' ? 1 : a.code.localeCompare(b.code)))
                  .map((st) => (
                    <option key={`rep-store-${st.code}`} value={st.code}>
                      {st.code} — {st.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Issue Description *</label>
            <textarea
              required
              rows={2}
              value={newIssueDescription}
              onChange={(e) => setNewIssueDescription(e.target.value)}
              className="input-field py-2 text-sm"
              placeholder="Describe the defect, damage, or symptoms..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Estimated Cost (₹)</label>
              <input
                type="number"
                min="0"
                value={newEstimatedCost}
                onChange={(e) => setNewEstimatedCost(Number(e.target.value))}
                className="input-field py-2 font-tabular"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Initial Status</label>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="input-field py-2">
                <option value="Pending Diagnosis">Pending Diagnosis</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Assigned Technician</label>
              <input
                type="text"
                value={newAssignedTech}
                onChange={(e) => setNewAssignedTech(e.target.value)}
                className="input-field py-2"
                placeholder="e.g. Ramesh Babu"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Technician Notes</label>
            <textarea
              rows={2}
              value={newTechnicianNotes}
              onChange={(e) => setNewTechnicianNotes(e.target.value)}
              className="input-field py-2 text-sm"
              placeholder="Preliminary inspection observations..."
            />
          </div>

          <div className="pt-2 border-t border-border flex justify-end gap-2">
            <button type="button" onClick={() => setCreateModalOpen(false)} className="btn-ghost" disabled={isSubmittingCreate}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmittingCreate}>
              {isSubmittingCreate ? 'Saving...' : 'Generate Ticket'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Repair Ticket Modal */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title={`Edit Ticket (${editingRepair?.ticketNo || ''})`} size="lg">
        <form onSubmit={handleEditSubmit} className="space-y-4 py-2 text-sm">
          <div className="p-3 bg-secondary/30 rounded-xl border border-border/50 text-xs flex justify-between items-center">
            <div>
              <span className="font-semibold text-foreground">{editingRepair?.customerName}</span>
              <span className="text-muted-foreground ml-2 font-mono">({editingRepair?.customerPhone})</span>
            </div>
            <span className="font-mono font-bold text-primary">{editingRepair?.ticketNo}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Status</label>
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="input-field py-2 font-medium">
                <option value="Pending Diagnosis">Pending Diagnosis</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Ready for Delivery">Ready for Delivery</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Store / Hub</label>
              <select value={editStoreCode} onChange={(e) => setEditStoreCode(e.target.value)} className="input-field py-2">
                {[...storesList]
                  .sort((a, b) => (a.code === 'CENTRAL' ? -1 : b.code === 'CENTRAL' ? 1 : a.code.localeCompare(b.code)))
                  .map((st) => (
                    <option key={`edit-store-${st.code}`} value={st.code}>
                      {st.code} — {st.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Estimated Cost (₹)</label>
              <input
                type="number"
                min="0"
                value={editEstimatedCost}
                onChange={(e) => setEditEstimatedCost(Number(e.target.value))}
                className="input-field py-2 font-tabular"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Device Name / Model</label>
              <input
                required
                type="text"
                value={editDeviceName}
                onChange={(e) => setEditDeviceName(e.target.value)}
                className="input-field py-2"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Assigned Technician</label>
              <input
                type="text"
                value={editAssignedTech}
                onChange={(e) => setEditAssignedTech(e.target.value)}
                className="input-field py-2"
                placeholder="e.g. Ramesh Babu"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Issue Description</label>
            <textarea
              required
              rows={2}
              value={editIssueDescription}
              onChange={(e) => setEditIssueDescription(e.target.value)}
              className="input-field py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Technician Notes & Progress</label>
            <textarea
              rows={3}
              value={editTechnicianNotes}
              onChange={(e) => setEditTechnicianNotes(e.target.value)}
              className="input-field py-2 text-sm"
              placeholder="Record repairs done, parts swapped, or testing results..."
            />
          </div>

          <div className="pt-2 border-t border-border flex justify-end gap-2">
            <button type="button" onClick={() => setEditModalOpen(false)} className="btn-ghost" disabled={isSubmittingEdit}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmittingEdit}>
              {isSubmittingEdit ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

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
