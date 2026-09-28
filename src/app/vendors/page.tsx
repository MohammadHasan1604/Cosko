'use client';

import React, { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import { useApp, Vendor, PurchaseOrder } from '@/context/AppContext';
import VendorFormModal from '@/components/forms/VendorFormModal';
import SupplierPaymentModal from '@/components/forms/SupplierPaymentModal';
import ProofViewerModal, { ProofViewerData } from '@/components/ui/ProofViewerModal';
import { toast } from 'sonner';
import { validateAndNormalizeGstin } from '@/lib/gstUtils';

export default function VendorsPage() {
  const {
    vendors,
    addVendor,
    updateVendor,
    deleteVendor,
    purchases,
    recordPurchasePayment,
    refreshAllData,
    currentUser,
  } = useApp();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterPayableOnly, setFilterPayableOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Vendor Onboarding / Edit / Delete modals
  const [onboardModal, setOnboardModal] = useState(false);
  const [editVendorModal, setEditVendorModal] = useState<Vendor | null>(null);
  const [deleteVendorModal, setDeleteVendorModal] = useState<Vendor | null>(null);

  // Drill-Down: Vendor Payables & Bills Drawer/Modal
  const [selectedVendorForBills, setSelectedVendorForBills] = useState<Vendor | null>(null);
  const [billsFilter, setBillsFilter] = useState<'pending' | 'all' | 'overdue'>('pending');
  const [expandedPaymentPoId, setExpandedPaymentPoId] = useState<string | null>(null);

  // Pay Now Modal State (Master Single Source of Truth SupplierPaymentModal)
  const [payModalPo, setPayModalPo] = useState<any | null>(null);

  // Printable Receipt Voucher State & Proof Viewer
  const [receiptVoucherModal, setReceiptVoucherModal] = useState<any | null>(null);
  const [proofViewerData, setProofViewerData] = useState<ProofViewerData | null>(null);

  // Synchronize authoritative vendor payables directly from DB records
  // Formula: Outstanding Balance = Total Bill - Valid Payments - Credits
  const vendorFinancials = useMemo(() => {
    const map: Record<
      string,
      {
        totalBilled: number;
        totalPaid: number;
        totalCredits: number;
        outstanding: number;
        unpaidCount: number;
        overdueCount: number;
        bills: any[];
      }
    > = {};

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Group purchases by vendor
    purchases.forEach((p) => {
      if (p.status === 'Cancelled' || p.status === 'Archived') return;

      const vKey = p.vendorId || p.vendorName?.toLowerCase().trim();
      if (!vKey) return;

      if (!map[vKey]) {
        map[vKey] = {
          totalBilled: 0,
          totalPaid: 0,
          totalCredits: 0,
          outstanding: 0,
          unpaidCount: 0,
          overdueCount: 0,
          bills: [],
        };
      }

      const totalCost = Number(p.totalAmount) || 0;
      const credit = Number(p.creditAmount) || 0;
      const realPaid =
        p.payments?.reduce((sum: number, pay: any) => sum + (Number(pay.amount) || 0), 0) ??
        (Number(p.paidAmount) || 0);
      const balance = Math.max(0, Math.round((totalCost - realPaid - credit) * 100) / 100);

      map[vKey].totalBilled += totalCost;
      map[vKey].totalPaid += realPaid;
      map[vKey].totalCredits += credit;
      map[vKey].outstanding += balance;

      // Overdue calculation
      const effDue = p.dueDate || p.expectedDate;
      let overdueDays = 0;
      let overdueStatus = 'Upcoming';

      if (balance <= 0.005) {
        overdueStatus = 'Settled';
      } else {
        map[vKey].unpaidCount++;
        if (effDue) {
          const dueD = new Date(effDue);
          const dueMidnight = new Date(
            dueD.getFullYear(),
            dueD.getMonth(),
            dueD.getDate()
          ).getTime();
          const diff = Math.round((todayMidnight - dueMidnight) / (1000 * 60 * 60 * 24));
          if (diff > 0) {
            overdueDays = diff;
            overdueStatus = 'Overdue';
            map[vKey].overdueCount++;
          } else if (diff === 0) {
            overdueStatus = 'Due Today';
          }
        }
      }

      map[vKey].bills.push({
        ...p,
        totalCost,
        paidAmount: realPaid,
        creditAmount: credit,
        balance,
        effectiveDueDate: effDue,
        overdueDays,
        overdueStatus,
      });
    });

    return map;
  }, [purchases]);

  // Aggregate enriched vendors
  const enrichedVendors = useMemo(() => {
    return vendors.map((v) => {
      const fin = vendorFinancials[v.id] ||
        vendorFinancials[v.name.toLowerCase().trim()] || {
          totalBilled: v.totalBilledAmount || 0,
          totalPaid: v.totalPaidAmount || 0,
          totalCredits: v.totalCreditsAmount || 0,
          outstanding: v.outstandingPayable || 0,
          unpaidCount: v.unpaidBillsCount || 0,
          overdueCount: v.overdueBillsCount || 0,
          bills: [],
        };

      return {
        ...v,
        totalBilledAmount: fin.totalBilled,
        totalPaidAmount: fin.totalPaid,
        totalCreditsAmount: fin.totalCredits,
        outstandingPayable: fin.outstanding,
        unpaidBillsCount: fin.unpaidCount,
        overdueBillsCount: fin.overdueCount,
        bills: fin.bills,
      };
    });
  }, [vendors, vendorFinancials]);

  // Overall Directory High-Level Metrics
  const summaryMetrics = useMemo(() => {
    const totalVendors = enrichedVendors.length;
    const totalBilled = enrichedVendors.reduce((acc, v) => acc + v.totalBilledAmount, 0);
    const totalPaid = enrichedVendors.reduce((acc, v) => acc + v.totalPaidAmount, 0);
    const totalOutstanding = enrichedVendors.reduce((acc, v) => acc + v.outstandingPayable, 0);
    const totalOverdueBills = enrichedVendors.reduce(
      (acc, v) => acc + (v.overdueBillsCount || 0),
      0
    );
    const totalUnpaidBills = enrichedVendors.reduce((acc, v) => acc + (v.unpaidBillsCount || 0), 0);

    return {
      totalVendors,
      totalBilled,
      totalPaid,
      totalOutstanding,
      totalOverdueBills,
      totalUnpaidBills,
    };
  }, [enrichedVendors]);

  // Filtered vendors
  const filteredVendors = useMemo(() => {
    return enrichedVendors.filter((v) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        v.name.toLowerCase().includes(q) ||
        v.code.toLowerCase().includes(q) ||
        (v.contactPerson && v.contactPerson.toLowerCase().includes(q)) ||
        (v.phone && v.phone.includes(q)) ||
        (v.gstin && v.gstin.toLowerCase().includes(q)) ||
        (v.category && v.category.toLowerCase().includes(q));

      const matchCategory = filterCategory === 'All' || v.category === filterCategory;
      const matchPayable = !filterPayableOnly || v.outstandingPayable > 0;

      return matchQuery && matchCategory && matchPayable;
    });
  }, [enrichedVendors, searchQuery, filterCategory, filterPayableOnly]);

  // All distinct categories
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    vendors.forEach((v) => {
      if (v.category) set.add(v.category);
    });
    return Array.from(set).sort();
  }, [vendors]);

  // Selected vendor's bills for modal
  const selectedVendorBills = useMemo(() => {
    if (!selectedVendorForBills) return [];
    const vMatch = enrichedVendors.find((v) => v.id === selectedVendorForBills.id);
    const bills = vMatch?.bills || [];

    if (billsFilter === 'pending') {
      return bills.filter((b: any) => b.balance > 0.005);
    }
    if (billsFilter === 'overdue') {
      return bills.filter((b: any) => b.balance > 0.005 && b.overdueStatus === 'Overdue');
    }
    return bills;
  }, [selectedVendorForBills, enrichedVendors, billsFilter]);

  const openEdit = (v: Vendor) => {
    setEditVendorModal(v);
  };

  // Open Pay Now Modal
  const openPayNow = (bill: any) => {
    setPayModalPo(bill);
  };

  // Print voucher
  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <AppLayout activeRoute="/vendors">
      <div className="space-y-4 md:space-y-6 fade-in">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="page-header">
            <h1 className="page-title">Vendors</h1>
            <p className="page-subtitle">Supplier payables, bills & payment processing</p>
          </div>
          <button
            onClick={() => setOnboardModal(true)}
            className="btn-primary gap-1.5 text-xs flex-shrink-0"
          >
            <Icon name="PlusIcon" size={14} />
            <span className="hidden sm:inline">Onboard Supplier</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>

        {/* High-Level Financial KPI Cards */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-[var(--page-gutter)] px-[var(--page-gutter)] md:mx-0 md:px-0 md:grid md:grid-cols-4 md:gap-3 pb-1 md:pb-0">
          <div className="card p-3 md:p-4 border border-border min-w-[170px] md:min-w-0 flex-shrink-0 md:flex-shrink">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                Active Suppliers
              </span>
              <span className="p-2 rounded-xl bg-primary/10 text-primary">
                <Icon name="BuildingStorefrontIcon" size={18} />
              </span>
            </div>
            <p className="text-2xl font-extrabold text-foreground font-tabular mt-1.5">
              {summaryMetrics.totalVendors}
            </p>
            <p className="text-3xs text-muted-foreground mt-1">
              {summaryMetrics.totalUnpaidBills} active bill
              {summaryMetrics.totalUnpaidBills === 1 ? '' : 's'} recorded
            </p>
          </div>

          <div className="card p-3 md:p-4 border border-border min-w-[170px] md:min-w-0 flex-shrink-0 md:flex-shrink">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                Total Procurement Billed
              </span>
              <span className="p-2 rounded-xl bg-info/10 text-info">
                <Icon name="DocumentTextIcon" size={18} />
              </span>
            </div>
            <p className="text-2xl font-extrabold text-foreground font-tabular mt-1.5">
              ₹{summaryMetrics.totalBilled.toLocaleString('en-IN')}
            </p>
            <p className="text-3xs text-muted-foreground mt-1">
              Across all verified purchase orders
            </p>
          </div>

          <div className="card p-3 md:p-4 border border-border min-w-[170px] md:min-w-0 flex-shrink-0 md:flex-shrink">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                Settled Payments
              </span>
              <span className="p-2 rounded-xl bg-positive/10 text-positive">
                <Icon name="CheckCircleIcon" size={18} />
              </span>
            </div>
            <p className="text-2xl font-extrabold text-positive font-tabular mt-1.5">
              ₹{summaryMetrics.totalPaid.toLocaleString('en-IN')}
            </p>
            <p className="text-3xs text-muted-foreground mt-1">
              Verified bank, UPI & cash disbursements
            </p>
          </div>

          <div
            className={`card p-4 border transition-all duration-150 cursor-pointer ${
              summaryMetrics.totalOutstanding > 0
                ? 'border-danger/30 bg-danger/5 hover:border-danger/60'
                : 'border-emerald-500/30 bg-emerald-500/5'
            }`}
            onClick={() => setFilterPayableOnly(!filterPayableOnly)}
            title="Click to toggle filter for vendors with outstanding payables"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                Net Outstanding Payables
              </span>
              <span
                className={`p-2 rounded-xl ${summaryMetrics.totalOutstanding > 0 ? 'bg-danger/10 text-danger' : 'bg-emerald-500/10 text-emerald-600'}`}
              >
                <Icon name="BanknotesIcon" size={18} />
              </span>
            </div>
            <p
              className={`text-2xl font-extrabold font-tabular mt-1.5 ${summaryMetrics.totalOutstanding > 0 ? 'text-danger' : 'text-emerald-600'}`}
            >
              ₹{summaryMetrics.totalOutstanding.toLocaleString('en-IN')}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              {summaryMetrics.totalOverdueBills > 0 ? (
                <span className="text-3xs font-bold bg-danger/20 text-danger px-1.5 py-0.5 rounded">
                  {summaryMetrics.totalOverdueBills} Overdue
                </span>
              ) : (
                <span className="text-3xs text-emerald-600 font-semibold">✓ No overdue bills</span>
              )}
              <span className="text-3xs text-muted-foreground">· Click to filter</span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="card p-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 max-w-md">
              <Icon
                name="MagnifyingGlassIcon"
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search vendor name, GSTIN, phone, contact..."
                className="input-field pl-9 text-xs"
              />
            </div>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="input-field text-xs py-2 w-44"
            >
              <option value="All">All Categories</option>
              {categoriesList.map((cat) => (
                <option key={`cat-opt-${cat}`} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={() => setFilterPayableOnly(!filterPayableOnly)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-all flex items-center gap-1.5 ${
                filterPayableOnly
                  ? 'bg-danger/15 text-danger border-danger/40'
                  : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              <Icon name="ExclamationTriangleIcon" size={14} />
              Unpaid Payables Only
            </button>

            <div className="flex items-center border border-border rounded-lg overflow-hidden bg-muted/20">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                title="Grid View"
              >
                <Icon name="Squares2X2Icon" size={16} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                title="Table View"
              >
                <Icon name="Bars3Icon" size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Vendors Directory Display */}
        {filteredVendors.length === 0 ? (
          <div className="card p-12 text-center text-muted-foreground">
            <Icon name="BuildingStorefrontIcon" size={40} className="mx-auto mb-2 opacity-30" />
            <h3 className="text-sm font-semibold text-foreground">No Suppliers Found</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Try modifying your search or filter settings, or onboard a new supplier.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVendors.map((v) => {
              const hasPayable = v.outstandingPayable > 0.005;
              const hasOverdue = (v.overdueBillsCount || 0) > 0;

              return (
                <div
                  key={`vend-${v.id}`}
                  className={`card p-5 space-y-4 hover:shadow-card-hover transition-all duration-200 relative group border ${
                    hasOverdue
                      ? 'border-danger/50'
                      : hasPayable
                        ? 'border-border/90'
                        : 'border-border/60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-3xs font-mono font-bold text-muted-foreground">
                          {v.code}
                        </span>
                        {hasOverdue && (
                          <span className="badge-danger text-3xs font-extrabold px-1.5 py-0.2">
                            {v.overdueBillsCount} Overdue
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-foreground mt-0.5">{v.name}</h3>
                      <p className="text-2xs text-muted-foreground">{v.category || 'General'}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="badge-warning text-3xs flex items-center gap-1 font-bold">
                        ★ {v.rating || 5.0}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(v)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Edit Vendor"
                        >
                          <Icon name="PencilSquareIcon" size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteVendorModal(v)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                          title="Archive / Delete"
                        >
                          <Icon name="TrashIcon" size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs space-y-1.5 text-muted-foreground border-y border-border/60 py-2.5">
                    {v.contactPerson && (
                      <p className="flex items-center gap-1.5">
                        <Icon name="UserIcon" size={13} className="text-muted-foreground/70" />
                        <span className="text-foreground font-medium">{v.contactPerson}</span>
                      </p>
                    )}
                    {v.phone && (
                      <p className="flex items-center gap-1.5 font-mono text-2xs">
                        <Icon name="PhoneIcon" size={13} className="text-muted-foreground/70" />
                        <span>{v.phone}</span>
                      </p>
                    )}
                    {v.gstin && (
                      <p className="flex items-center gap-1.5">
                        <Icon
                          name="DocumentTextIcon"
                          size={13}
                          className="text-muted-foreground/70"
                        />
                        <span>GSTIN:</span>
                        <span className="font-mono text-primary font-bold text-2xs">{v.gstin}</span>
                      </p>
                    )}
                    {v.paymentTerms && (
                      <p className="text-2xs text-muted-foreground">
                        Terms: <strong className="text-foreground">{v.paymentTerms}</strong> · Lead:{' '}
                        {v.leadTimeDays || 3}d
                      </p>
                    )}
                  </div>

                  {/* Interactive Outstanding Payable Button */}
                  <div
                    onClick={() => {
                      setSelectedVendorForBills(v);
                      setBillsFilter('pending');
                      setExpandedPaymentPoId(null);
                    }}
                    className={`p-3 rounded-xl border transition-all duration-150 cursor-pointer flex items-center justify-between ${
                      hasPayable
                        ? 'bg-danger/5 hover:bg-danger/10 border-danger/25 text-danger'
                        : 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/25 text-emerald-600'
                    }`}
                    title="Click to view full purchase bills breakdown and record payment"
                  >
                    <div>
                      <span className="text-2xs uppercase tracking-wider font-bold block text-muted-foreground">
                        Outstanding Payable
                      </span>
                      <span className="font-extrabold text-base font-tabular">
                        ₹{v.outstandingPayable.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-2xs font-semibold">
                      <span>
                        {hasPayable ? `${v.unpaidBillsCount || 0} bills pending` : 'All Settled'}
                      </span>
                      <Icon
                        name="ChevronRightIcon"
                        size={14}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="card overflow-hidden border border-border/80">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left min-w-[850px]">
                <thead>
                  <tr className="table-header">
                    <th className="px-4 py-3">Code / Supplier</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Contact & Phone</th>
                    <th className="px-4 py-3">GSTIN</th>
                    <th className="px-4 py-3">Payment Terms</th>
                    <th className="px-4 py-3 font-tabular text-right">Total Billed</th>
                    <th className="px-4 py-3 font-tabular text-right">Outstanding Payable</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-xs font-tabular">
                  {filteredVendors.map((v) => {
                    const hasPayable = v.outstandingPayable > 0.005;
                    return (
                      <tr key={`v-row-${v.id}`} className="table-row">
                        <td className="px-4 py-3">
                          <span className="font-mono text-3xs font-bold text-muted-foreground block">
                            {v.code}
                          </span>
                          <span className="font-bold text-foreground">{v.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="badge-neutral text-3xs">{v.category || 'General'}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <div className="font-medium text-foreground">
                            {v.contactPerson || '—'}
                          </div>
                          <div className="font-mono text-3xs">{v.phone}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-2xs text-primary font-semibold">
                          {v.gstin || '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {v.paymentTerms || 'Net 30'} ({v.leadTimeDays || 3}d)
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">
                          ₹{v.totalBilledAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedVendorForBills(v);
                              setBillsFilter('pending');
                            }}
                            className={`px-2.5 py-1 rounded-lg font-bold text-xs inline-flex items-center gap-1.5 transition-all ${
                              hasPayable
                                ? 'bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30'
                                : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                            }`}
                          >
                            ₹{v.outstandingPayable.toLocaleString('en-IN')}
                            <Icon name="ArrowTopRightOnSquareIcon" size={12} />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEdit(v)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              title="Edit"
                            >
                              <Icon name="PencilSquareIcon" size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteVendorModal(v)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                              title="Archive / Delete"
                            >
                              <Icon name="TrashIcon" size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VENDOR PAYABLES & BILLS BREAKDOWN MODAL                       */}
        {/* ------------------------------------------------------------- */}
        {selectedVendorForBills && (
          <Modal
            open={!!selectedVendorForBills}
            onClose={() => setSelectedVendorForBills(null)}
            title={`Outstanding Payables & Bills — ${selectedVendorForBills.name}`}
            subtitle={`Supplier Code: ${selectedVendorForBills.code} · Terms: ${selectedVendorForBills.paymentTerms || 'Net 30'}`}
            size="lg"
          >
            <div className="space-y-4 py-1 text-xs">
              {/* Financial Reconciled Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-muted/40 border border-border rounded-xl">
                <div>
                  <span className="text-3xs uppercase font-bold text-muted-foreground block">
                    Total Billed
                  </span>
                  <span className="text-base font-bold text-foreground font-tabular">
                    ₹{(selectedVendorForBills.totalBilledAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-3xs uppercase font-bold text-muted-foreground block">
                    Settled Payments
                  </span>
                  <span className="text-base font-bold text-emerald-600 font-tabular">
                    ₹{(selectedVendorForBills.totalPaidAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-3xs uppercase font-bold text-muted-foreground block">
                    Vendor Credits
                  </span>
                  <span className="text-base font-bold text-info font-tabular">
                    ₹{(selectedVendorForBills.totalCreditsAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="border-l border-border pl-3">
                  <span className="text-3xs uppercase font-bold text-muted-foreground block">
                    Net Balance Due
                  </span>
                  <span
                    className={`text-lg font-extrabold font-tabular ${
                      selectedVendorForBills.outstandingPayable > 0
                        ? 'text-danger'
                        : 'text-emerald-600'
                    }`}
                  >
                    ₹{(selectedVendorForBills.outstandingPayable || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Bills Filter Tabs */}
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setBillsFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      billsFilter === 'pending'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Unpaid Bills ({selectedVendorForBills.unpaidBillsCount || 0})
                  </button>
                  <button
                    onClick={() => setBillsFilter('overdue')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      billsFilter === 'overdue'
                        ? 'bg-danger text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Overdue Bills ({selectedVendorForBills.overdueBillsCount || 0})
                  </button>
                  <button
                    onClick={() => setBillsFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      billsFilter === 'all'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    All Purchase Bills ({selectedVendorBills.length})
                  </button>
                </div>

                <span className="text-3xs text-muted-foreground hidden sm:inline">
                  Formula: Total − Paid − Credits = Balance
                </span>
              </div>

              {/* Bills Listing */}
              {selectedVendorBills.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <Icon
                    name="CheckCircleIcon"
                    size={36}
                    className="mx-auto mb-2 text-positive/60"
                  />
                  <p className="font-bold text-foreground">No matching purchase bills found</p>
                  <p className="text-2xs text-muted-foreground mt-0.5">
                    {billsFilter === 'pending'
                      ? 'All purchase bills for this vendor are fully paid and settled.'
                      : 'No purchase records matching this criteria.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1 scrollbar-thin">
                  {selectedVendorBills.map((bill: any) => {
                    const isExpanded = expandedPaymentPoId === bill.id;
                    const isOverdue = bill.overdueStatus === 'Overdue';
                    const isSettled = bill.balance <= 0.005;

                    return (
                      <div
                        key={`bill-${bill.id}`}
                        className={`rounded-xl border transition-all p-3.5 space-y-2.5 ${
                          isOverdue
                            ? 'border-danger/40 bg-danger/5'
                            : isSettled
                              ? 'border-emerald-500/30 bg-emerald-500/5'
                              : 'border-border bg-card'
                        }`}
                      >
                        {/* Bill Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs text-primary">
                              {bill.invoiceNo || bill.poNo}
                            </span>
                            {bill.invoiceNo && bill.invoiceNo !== bill.poNo && (
                              <span className="text-3xs text-muted-foreground font-mono">
                                ({bill.poNo})
                              </span>
                            )}
                            <span className="badge-neutral text-3xs">
                              {bill.store || bill.storeCode}
                            </span>

                            {/* Overdue Badge */}
                            {isOverdue ? (
                              <span className="badge-danger text-3xs font-extrabold flex items-center gap-1">
                                <Icon name="ClockIcon" size={11} />
                                Overdue by {bill.overdueDays} day{bill.overdueDays === 1 ? '' : 's'}
                              </span>
                            ) : bill.overdueStatus === 'Due Today' ? (
                              <span className="badge-warning text-3xs font-extrabold">
                                Due Today
                              </span>
                            ) : isSettled ? (
                              <span className="badge-positive text-3xs font-bold flex items-center gap-1">
                                <Icon name="CheckIcon" size={11} /> Settled
                              </span>
                            ) : (
                              <span className="badge-neutral text-3xs">Pending</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Payment History Toggle */}
                            <button
                              onClick={() => setExpandedPaymentPoId(isExpanded ? null : bill.id)}
                              className="btn-secondary text-3xs py-1 px-2.5 gap-1"
                            >
                              <Icon name="DocumentTextIcon" size={12} />
                              {bill.payments?.length || 0} Payment
                              {bill.payments?.length === 1 ? '' : 's'}
                              <Icon
                                name="ChevronDownIcon"
                                size={12}
                                className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                              />
                            </button>

                            {/* Pay Now Button */}
                            {!isSettled && (
                              <button
                                onClick={() => openPayNow(bill)}
                                className="btn-primary text-3xs py-1 px-3 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                              >
                                <Icon name="BanknotesIcon" size={12} />
                                Pay Now
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Bill Financial Breakdown Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-2xs font-tabular pt-1 border-t border-border/70">
                          <div>
                            <span className="text-muted-foreground block">Order Date:</span>
                            <span className="font-semibold text-foreground">
                              {bill.orderDate
                                ? new Date(bill.orderDate).toLocaleDateString('en-IN')
                                : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Due Date:</span>
                            <span
                              className={`font-semibold ${isOverdue ? 'text-danger' : 'text-foreground'}`}
                            >
                              {bill.effectiveDueDate
                                ? new Date(bill.effectiveDueDate).toLocaleDateString('en-IN')
                                : 'Net 30'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Original Amount:</span>
                            <span className="font-bold text-foreground">
                              ₹{bill.totalCost.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Paid Amount:</span>
                            <span className="font-semibold text-emerald-600">
                              ₹{(bill.paidAmount || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block font-bold">
                              Outstanding Balance:
                            </span>
                            <span
                              className={`font-extrabold text-xs ${bill.balance > 0 ? 'text-danger' : 'text-emerald-600'}`}
                            >
                              ₹{bill.balance.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>

                        {/* Expandable Payment History Table */}
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-border/70 fade-in space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">
                                Verified Payment Transactions
                              </span>
                              <span className="text-3xs text-muted-foreground">
                                Source: Real DB Purchase Payments
                              </span>
                            </div>

                            {!bill.payments || bill.payments.length === 0 ? (
                              <p className="text-3xs text-muted-foreground italic py-1">
                                No payment transactions recorded yet.
                              </p>
                            ) : (
                              <div className="overflow-x-auto border border-border rounded-lg">
                                <table className="w-full text-left text-3xs">
                                  <thead>
                                    <tr className="bg-muted text-muted-foreground font-bold uppercase">
                                      <th className="px-2.5 py-1.5">Voucher #</th>
                                      <th className="px-2.5 py-1.5">Date</th>
                                      <th className="px-2.5 py-1.5 font-tabular text-right">
                                        Amount
                                      </th>
                                      <th className="px-2.5 py-1.5">Method</th>
                                      <th className="px-2.5 py-1.5">Reference / UTR</th>
                                      <th className="px-2.5 py-1.5">Remarks</th>
                                      <th className="px-2.5 py-1.5">Recorded By</th>
                                      <th className="px-2.5 py-1.5 text-center">Receipt</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border font-tabular">
                                    {bill.payments.map((p: any) => (
                                      <tr key={`pay-row-${p.id}`} className="hover:bg-muted/20">
                                        <td className="px-2.5 py-1.5 font-mono text-primary font-bold">
                                          {p.voucherNo || 'PV-LEGACY'}
                                        </td>
                                        <td className="px-2.5 py-1.5 text-muted-foreground">
                                          {new Date(
                                            p.paymentDate || p.createdAt
                                          ).toLocaleDateString('en-IN')}
                                        </td>
                                        <td className="px-2.5 py-1.5 text-right font-extrabold text-emerald-600">
                                          ₹{Number(p.amount).toLocaleString('en-IN')}
                                        </td>
                                        <td className="px-2.5 py-1.5">{p.paymentMethod}</td>
                                        <td className="px-2.5 py-1.5 font-mono text-muted-foreground">
                                          {p.referenceNo || 'N/A'}
                                        </td>
                                        <td
                                          className="px-2.5 py-1.5 text-muted-foreground max-w-[160px] truncate"
                                          title={p.notes || ''}
                                        >
                                          {p.notes || '—'}
                                        </td>
                                        <td className="px-2.5 py-1.5 text-muted-foreground">
                                          {p.recordedBy}
                                        </td>
                                        <td className="px-2.5 py-1.5 text-center">
                                          {p.receiptUrl ? (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setProofViewerData({
                                                  proofUrl: p.receiptUrl,
                                                  title: `Payment Proof — Voucher #${p.voucherNo || 'PV'}`,
                                                  amount: Number(p.amount),
                                                  paymentMethod: p.paymentMethod,
                                                  referenceNo: p.referenceNo,
                                                  paymentDate: p.paymentDate,
                                                  recordedBy: p.recordedBy,
                                                  entityName: selectedVendorForBills?.name,
                                                  billNo: bill.invoiceNo || bill.poNo,
                                                  notes: p.notes,
                                                })
                                              }
                                              className="text-primary hover:underline font-bold inline-flex items-center gap-0.5"
                                            >
                                              <Icon name="DocumentIcon" size={11} /> View Proof
                                            </button>
                                          ) : (
                                            <span className="text-muted-foreground/50">—</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-border">
                <button
                  onClick={() => setSelectedVendorForBills(null)}
                  className="btn-secondary text-xs"
                >
                  Close Payables Drawer
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Master Single Source of Truth Supplier Payment Modal */}
        <SupplierPaymentModal
          open={Boolean(payModalPo)}
          onClose={() => setPayModalPo(null)}
          purchase={payModalPo}
          onSuccess={async (_, receiptVoucher) => {
            setPayModalPo(null);
            if (receiptVoucher) {
              setReceiptVoucherModal(receiptVoucher);
            }
            await refreshAllData();
          }}
        />

        {/* ------------------------------------------------------------- */}
        {/* PRINTABLE PAYMENT RECEIPT VOUCHER MODAL                       */}
        {/* ------------------------------------------------------------- */}
        {receiptVoucherModal && (
          <Modal
            open={!!receiptVoucherModal}
            onClose={() => setReceiptVoucherModal(null)}
            title="Official Payment Receipt Voucher"
            subtitle={`Voucher #${receiptVoucherModal.voucherNo} · Status: Verified`}
            size="md"
          >
            <div className="space-y-4 py-2 text-xs">
              {/* Printable Voucher Card */}
              <div
                id="payment-voucher-print-area"
                className="p-5 border border-border rounded-xl bg-card space-y-4"
              >
                <div className="flex items-start justify-between border-b border-border pb-3">
                  <div>
                    <h2 className="text-base font-extrabold text-foreground tracking-tight">
                      COSKO ENTERPRISE RETAIL
                    </h2>
                    <p className="text-3xs text-muted-foreground">
                      Procurement & Accounts Payable Department
                    </p>
                    <p className="text-3xs text-muted-foreground font-mono mt-0.5">
                      Voucher: {receiptVoucherModal.voucherNo}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="badge-positive text-2xs font-bold px-2 py-0.5">
                      PAID / SETTLED
                    </span>
                    <p className="text-3xs text-muted-foreground mt-1">
                      {new Date(receiptVoucherModal.paymentDate).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-2xs">
                  <div>
                    <span className="text-muted-foreground uppercase text-3xs font-bold block">
                      Vendor Beneficiary:
                    </span>
                    <strong className="text-foreground text-xs block">
                      {receiptVoucherModal.vendorName}
                    </strong>
                    {receiptVoucherModal.vendorGstin && (
                      <span className="text-muted-foreground font-mono block">
                        GSTIN: {receiptVoucherModal.vendorGstin}
                      </span>
                    )}
                    {receiptVoucherModal.vendorPhone && (
                      <span className="text-muted-foreground block">
                        Phone: {receiptVoucherModal.vendorPhone}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground uppercase text-3xs font-bold block">
                      Bill Details:
                    </span>
                    <strong className="text-primary font-mono text-xs block">
                      Invoice #{receiptVoucherModal.billNo}
                    </strong>
                    <span className="text-muted-foreground font-mono text-3xs block">
                      PO Ref: {receiptVoucherModal.poNo}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-1.5 font-tabular text-2xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Bill Value:</span>
                    <span className="font-bold text-foreground">
                      ₹{Number(receiptVoucherModal.totalCost).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Method:</span>
                    <span className="font-bold text-foreground">
                      {receiptVoucherModal.paymentMethod}
                    </span>
                  </div>
                  {receiptVoucherModal.referenceNo && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transaction Reference (UTR):</span>
                      <span className="font-mono font-bold text-foreground">
                        {receiptVoucherModal.referenceNo}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1.5 border-t border-border font-extrabold text-sm text-emerald-600">
                    <span>Disbursed Amount:</span>
                    <span>₹{Number(receiptVoucherModal.amount).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/60">
                    <span>Remaining Balance on Bill:</span>
                    <span className="font-bold text-foreground">
                      ₹{Number(receiptVoucherModal.remainingBalance).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {receiptVoucherModal.receiptUrl && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                    <div className="flex items-center gap-2">
                      <Icon
                        name="DocumentCheckIcon"
                        size={16}
                        className="text-emerald-600 shrink-0"
                      />
                      <div>
                        <span className="font-bold text-2xs block">Payment Proof Attached</span>
                        <span className="text-4xs text-muted-foreground font-mono">
                          Permanently stored in database ledger
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setProofViewerData({
                          proofUrl: receiptVoucherModal.receiptUrl,
                          title: `Payment Proof — Voucher #${receiptVoucherModal.voucherNo}`,
                          amount: Number(receiptVoucherModal.amount),
                          paymentMethod: receiptVoucherModal.paymentMethod,
                          referenceNo: receiptVoucherModal.referenceNo,
                          paymentDate: receiptVoucherModal.paymentDate,
                          recordedBy: receiptVoucherModal.recordedBy,
                          entityName: receiptVoucherModal.vendorName,
                          billNo: receiptVoucherModal.billNo,
                        })
                      }
                      className="btn-secondary text-2xs py-1 px-2.5 gap-1 font-bold shadow-2xs"
                    >
                      <Icon name="EyeIcon" size={12} />
                      View Proof
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between text-3xs text-muted-foreground pt-2 border-t border-border">
                  <span>
                    Authorized by:{' '}
                    <strong>{receiptVoucherModal.recordedBy || currentUser?.name}</strong>
                  </span>
                  <span>Digitally Recorded via COSKO StoreCommand</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-3xs text-muted-foreground">
                  Print or export copy for vendor file.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrintReceipt}
                    className="btn-secondary text-xs gap-1.5 font-bold"
                  >
                    <Icon name="PrinterIcon" size={14} />
                    Print Receipt Voucher
                  </button>
                  <button
                    onClick={() => setReceiptVoucherModal(null)}
                    className="btn-primary text-xs font-bold"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* Reusable Single-Source-of-Truth Vendor Form Modal */}
        <VendorFormModal
          open={onboardModal || !!editVendorModal}
          onClose={() => {
            setOnboardModal(false);
            setEditVendorModal(null);
          }}
          vendor={editVendorModal}
        />

        {/* ------------------------------------------------------------- */}
        {/* DELETE / ARCHIVE CONFIRMATION MODAL                           */}
        {/* ------------------------------------------------------------- */}
        {deleteVendorModal && (
          <Modal
            open={!!deleteVendorModal}
            onClose={() => setDeleteVendorModal(null)}
            title={`Archive / Delete "${deleteVendorModal.name}"`}
            subtitle="Relational validation against purchase orders and financial history"
            size="md"
          >
            <div className="space-y-4 py-2 text-xs">
              {(() => {
                const poCount =
                  (deleteVendorModal as any).totalBillsCount ||
                  (deleteVendorModal.outstandingPayable > 0 ? 1 : 0);
                return (
                  <>
                    <div
                      className={`p-4 rounded-xl border ${
                        poCount > 0
                          ? 'bg-warning/10 border-warning/30 text-foreground'
                          : 'bg-muted/40 border-border text-foreground'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <Icon
                          name={poCount > 0 ? 'ExclamationTriangleIcon' : 'InformationCircleIcon'}
                          size={18}
                          className={
                            poCount > 0
                              ? 'text-warning shrink-0 mt-0.5'
                              : 'text-primary shrink-0 mt-0.5'
                          }
                        />
                        <div>
                          <p className="font-bold text-sm">
                            {poCount > 0
                              ? 'Linked Procurement & Financial Records Found'
                              : 'Unused Supplier Profile'}
                          </p>
                          <p className="text-muted-foreground mt-1">
                            {poCount > 0
                              ? `This vendor has purchase bills or an outstanding balance of ₹${deleteVendorModal.outstandingPayable.toLocaleString(
                                  'en-IN'
                                )}. To protect warehouse inventory ledgers, tax records, and accounting history, it will be safely Archived.`
                              : `This vendor has no linked purchase orders. You can safely archive it or permanently delete it.`}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-border">
                      <button
                        onClick={() => setDeleteVendorModal(null)}
                        className="btn-secondary text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteVendor(deleteVendorModal.id, false);
                          setDeleteVendorModal(null);
                        }}
                        className="btn-primary bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4"
                      >
                        Safe Archive
                      </button>
                      {poCount === 0 && currentUser?.role === 'Super Admin' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteVendor(deleteVendorModal.id, true);
                            setDeleteVendorModal(null);
                          }}
                          className="btn-danger text-xs font-bold px-4"
                        >
                          Permanent Delete
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </Modal>
        )}
        {/* Reusable Proof Viewer Modal */}
        <ProofViewerModal
          open={!!proofViewerData}
          onClose={() => setProofViewerData(null)}
          data={proofViewerData}
        />
      </div>
    </AppLayout>
  );
}
