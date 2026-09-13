'use client';

import React, { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import { useApp, Vendor, PurchaseOrder } from '@/context/AppContext';
import { toast } from 'sonner';
import { validateAndNormalizeGstin } from '@/lib/gstUtils';

export default function VendorsPage() {
  const { vendors, addVendor, updateVendor, deleteVendor, purchases, recordPurchasePayment, refreshAllData, currentUser } = useApp();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterPayableOnly, setFilterPayableOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Vendor Onboarding / Edit / Delete modals
  const [onboardModal, setOnboardModal] = useState(false);
  const [editVendorModal, setEditVendorModal] = useState<Vendor | null>(null);
  const [deleteVendorModal, setDeleteVendorModal] = useState<Vendor | null>(null);

  // Vendor Form Fields
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [leadTimeDays, setLeadTimeDays] = useState<number | ''>('');

  // Drill-Down: Vendor Payables & Bills Drawer/Modal
  const [selectedVendorForBills, setSelectedVendorForBills] = useState<Vendor | null>(null);
  const [billsFilter, setBillsFilter] = useState<'pending' | 'all' | 'overdue'>('pending');
  const [expandedPaymentPoId, setExpandedPaymentPoId] = useState<string | null>(null);

  // Pay Now Modal State
  const [payModalPo, setPayModalPo] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [payMethod, setPayMethod] = useState('Bank Transfer');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [receiptProof, setReceiptProof] = useState<string | null>(null);
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Pre-Payment Confirmation Guard
  const [confirmPaymentModal, setConfirmPaymentModal] = useState(false);

  // Printable Receipt Voucher State
  const [receiptVoucherModal, setReceiptVoucherModal] = useState<any | null>(null);

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
      const realPaid = p.payments?.reduce((sum: number, pay: any) => sum + (Number(pay.amount) || 0), 0) ?? (Number(p.paidAmount) || 0);
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
          const dueMidnight = new Date(dueD.getFullYear(), dueD.getMonth(), dueD.getDate()).getTime();
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
      const fin = vendorFinancials[v.id] || vendorFinancials[v.name.toLowerCase().trim()] || {
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
    const totalOverdueBills = enrichedVendors.reduce((acc, v) => acc + (v.overdueBillsCount || 0), 0);
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

  // Handle Form Resets
  const resetForm = () => {
    setName('');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setCategory('');
    setGstin('');
    setAddress('');
    setPaymentTerms('Net 30');
    setLeadTimeDays('');
  };

  const openEdit = (v: Vendor) => {
    setEditVendorModal(v);
    setName(v.name || '');
    setContactPerson(v.contactPerson || '');
    setEmail(v.email || '');
    setPhone(v.phone || '');
    setCategory(v.category || '');
    setGstin(v.gstin || '');
    setAddress(v.address || '');
    setPaymentTerms(v.paymentTerms || 'Net 30');
    setLeadTimeDays(v.leadTimeDays || 3);
  };

  // Onboard Submit
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Vendor name is required');
      return;
    }
    const gstinCheck = validateAndNormalizeGstin(gstin);
    if (!gstinCheck.isValid) {
      toast.error(gstinCheck.error || 'Invalid GSTIN format');
      return;
    }
    const cleanGstin = gstinCheck.normalized;

    try {
      await addVendor({
        name: name.trim(),
        contactPerson: contactPerson.trim() || 'Account Manager',
        email: email.trim() || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@supplier.com`,
        phone: phone.trim() || '+91 00000 00000',
        category: category.trim() || 'General',
        gstin: cleanGstin || undefined,
        address: address.trim() || undefined,
        paymentTerms: paymentTerms.trim() || 'Net 30',
        leadTimeDays: Number(leadTimeDays) || 3,
        outstandingPayable: 0,
        rating: 5.0,
      });
      setOnboardModal(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || 'Failed to onboard supplier');
    }
  };

  // Update Submit
  const handleUpdateVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVendorModal) return;
    const gstinCheck = validateAndNormalizeGstin(gstin);
    if (!gstinCheck.isValid) {
      toast.error(gstinCheck.error || 'Invalid GSTIN format');
      return;
    }
    const cleanGstin = gstinCheck.normalized;

    try {
      await updateVendor(editVendorModal.id, {
        name: name.trim(),
        contactPerson: contactPerson.trim(),
        email: email.trim(),
        phone: phone.trim(),
        category: category.trim() || 'General',
        gstin: cleanGstin,
        address: address.trim() || undefined,
        paymentTerms: paymentTerms.trim() || 'Net 30',
        leadTimeDays: Number(leadTimeDays) || 3,
      });
      setEditVendorModal(null);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update supplier');
    }
  };

  // Open Pay Now Modal
  const openPayNow = (bill: any) => {
    setPayModalPo(bill);
    setPayAmount(bill.balance > 0 ? bill.balance : '');
    setPayMethod('Bank Transfer');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayRef('');
    setPayNotes(`Payment for Bill #${bill.invoiceNo || bill.poNo}`);
    setReceiptProof(null);
  };

  // Handle proof upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setReceiptProof(reader.result as string);
      toast.success(`Attached receipt: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  // Trigger Confirmation Step
  const handlePrePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalPo || !payAmount || Number(payAmount) <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    const amt = Number(payAmount);
    if (amt > payModalPo.balance + 0.01) {
      toast.error(`Payment amount cannot exceed remaining balance (₹${payModalPo.balance.toLocaleString('en-IN')})`);
      return;
    }

    // Open pre-payment confirmation dialog
    setConfirmPaymentModal(true);
  };

  // Execute Payment
  const executePayment = async () => {
    if (!payModalPo || !payAmount || Number(payAmount) <= 0) return;
    setIsSubmittingPay(true);
    try {
      const res = await recordPurchasePayment({
        purchaseId: payModalPo.id,
        amount: Number(payAmount),
        paymentMethod: payMethod,
        paymentDate: payDate,
        referenceNo: payRef.trim() || undefined,
        notes: payNotes.trim() || undefined,
        receiptUrl: receiptProof || undefined,
      });

      if (res.success) {
        setConfirmPaymentModal(false);
        setPayModalPo(null);
        // Open printable receipt voucher modal
        if (res.receiptVoucher) {
          setReceiptVoucherModal(res.receiptVoucher);
        }
        await refreshAllData();
      }
    } finally {
      setIsSubmittingPay(false);
    }
  };

  // Print voucher
  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <AppLayout activeRoute="/vendors">
      <div className="space-y-6 fade-in">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Vendor & Supplier Management</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              100% database-reconciled procurement payables, overdue bills drill-down, and atomic payment processing.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                resetForm();
                setOnboardModal(true);
              }}
              className="btn-primary gap-2 text-xs sm:text-sm font-semibold shadow-xs"
            >
              <Icon name="PlusIcon" size={18} />
              Onboard Supplier
            </button>
          </div>
        </div>

        {/* High-Level Financial KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4 border border-border">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Active Suppliers</span>
              <span className="p-2 rounded-xl bg-primary/10 text-primary">
                <Icon name="BuildingStorefrontIcon" size={18} />
              </span>
            </div>
            <p className="text-2xl font-extrabold text-foreground font-tabular mt-1.5">{summaryMetrics.totalVendors}</p>
            <p className="text-3xs text-muted-foreground mt-1">
              {summaryMetrics.totalUnpaidBills} active bill{summaryMetrics.totalUnpaidBills === 1 ? '' : 's'} recorded
            </p>
          </div>

          <div className="card p-4 border border-border">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Total Procurement Billed</span>
              <span className="p-2 rounded-xl bg-info/10 text-info">
                <Icon name="DocumentTextIcon" size={18} />
              </span>
            </div>
            <p className="text-2xl font-extrabold text-foreground font-tabular mt-1.5">
              ₹{summaryMetrics.totalBilled.toLocaleString('en-IN')}
            </p>
            <p className="text-3xs text-muted-foreground mt-1">Across all verified purchase orders</p>
          </div>

          <div className="card p-4 border border-border">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Settled Payments</span>
              <span className="p-2 rounded-xl bg-positive/10 text-positive">
                <Icon name="CheckCircleIcon" size={18} />
              </span>
            </div>
            <p className="text-2xl font-extrabold text-positive font-tabular mt-1.5">
              ₹{summaryMetrics.totalPaid.toLocaleString('en-IN')}
            </p>
            <p className="text-3xs text-muted-foreground mt-1">Verified bank, UPI & cash disbursements</p>
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
              <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Net Outstanding Payables</span>
              <span className={`p-2 rounded-xl ${summaryMetrics.totalOutstanding > 0 ? 'bg-danger/10 text-danger' : 'bg-emerald-500/10 text-emerald-600'}`}>
                <Icon name="BanknotesIcon" size={18} />
              </span>
            </div>
            <p className={`text-2xl font-extrabold font-tabular mt-1.5 ${summaryMetrics.totalOutstanding > 0 ? 'text-danger' : 'text-emerald-600'}`}>
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
              <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
            <p className="text-xs text-muted-foreground mt-1">Try modifying your search or filter settings, or onboard a new supplier.</p>
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
                    hasOverdue ? 'border-danger/50' : hasPayable ? 'border-border/90' : 'border-border/60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-3xs font-mono font-bold text-muted-foreground">{v.code}</span>
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
                        <button onClick={() => openEdit(v)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Edit Vendor">
                          <Icon name="PencilSquareIcon" size={14} />
                        </button>
                        <button onClick={() => setDeleteVendorModal(v)} className="p-1.5 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors" title="Archive / Delete">
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
                        <Icon name="DocumentTextIcon" size={13} className="text-muted-foreground/70" />
                        <span>GSTIN:</span>
                        <span className="font-mono text-primary font-bold text-2xs">{v.gstin}</span>
                      </p>
                    )}
                    {v.paymentTerms && (
                      <p className="text-2xs text-muted-foreground">
                        Terms: <strong className="text-foreground">{v.paymentTerms}</strong> · Lead: {v.leadTimeDays || 3}d
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
                      <span>{hasPayable ? `${v.unpaidBillsCount || 0} bills pending` : 'All Settled'}</span>
                      <Icon name="ChevronRightIcon" size={14} className="transition-transform group-hover:translate-x-0.5" />
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
                          <span className="font-mono text-3xs font-bold text-muted-foreground block">{v.code}</span>
                          <span className="font-bold text-foreground">{v.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="badge-neutral text-3xs">{v.category || 'General'}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <div className="font-medium text-foreground">{v.contactPerson || '—'}</div>
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
                            <button onClick={() => openEdit(v)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Edit">
                              <Icon name="PencilSquareIcon" size={14} />
                            </button>
                            <button onClick={() => setDeleteVendorModal(v)} className="p-1.5 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors" title="Archive / Delete">
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
                  <span className="text-3xs uppercase font-bold text-muted-foreground block">Total Billed</span>
                  <span className="text-base font-bold text-foreground font-tabular">
                    ₹{(selectedVendorForBills.totalBilledAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-3xs uppercase font-bold text-muted-foreground block">Settled Payments</span>
                  <span className="text-base font-bold text-emerald-600 font-tabular">
                    ₹{(selectedVendorForBills.totalPaidAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-3xs uppercase font-bold text-muted-foreground block">Vendor Credits</span>
                  <span className="text-base font-bold text-info font-tabular">
                    ₹{(selectedVendorForBills.totalCreditsAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="border-l border-border pl-3">
                  <span className="text-3xs uppercase font-bold text-muted-foreground block">Net Balance Due</span>
                  <span
                    className={`text-lg font-extrabold font-tabular ${
                      selectedVendorForBills.outstandingPayable > 0 ? 'text-danger' : 'text-emerald-600'
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
                  <Icon name="CheckCircleIcon" size={36} className="mx-auto mb-2 text-positive/60" />
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
                              <span className="text-3xs text-muted-foreground font-mono">({bill.poNo})</span>
                            )}
                            <span className="badge-neutral text-3xs">{bill.store || bill.storeCode}</span>

                            {/* Overdue Badge */}
                            {isOverdue ? (
                              <span className="badge-danger text-3xs font-extrabold flex items-center gap-1">
                                <Icon name="ClockIcon" size={11} />
                                Overdue by {bill.overdueDays} day{bill.overdueDays === 1 ? '' : 's'}
                              </span>
                            ) : bill.overdueStatus === 'Due Today' ? (
                              <span className="badge-warning text-3xs font-extrabold">Due Today</span>
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
                              {bill.payments?.length || 0} Payment{bill.payments?.length === 1 ? '' : 's'}
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
                              {bill.orderDate ? new Date(bill.orderDate).toLocaleDateString('en-IN') : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Due Date:</span>
                            <span className={`font-semibold ${isOverdue ? 'text-danger' : 'text-foreground'}`}>
                              {bill.effectiveDueDate ? new Date(bill.effectiveDueDate).toLocaleDateString('en-IN') : 'Net 30'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Original Amount:</span>
                            <span className="font-bold text-foreground">₹{bill.totalCost.toLocaleString('en-IN')}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Paid Amount:</span>
                            <span className="font-semibold text-emerald-600">₹{(bill.paidAmount || 0).toLocaleString('en-IN')}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block font-bold">Outstanding Balance:</span>
                            <span className={`font-extrabold text-xs ${bill.balance > 0 ? 'text-danger' : 'text-emerald-600'}`}>
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
                              <span className="text-3xs text-muted-foreground">Source: Real DB Purchase Payments</span>
                            </div>

                            {(!bill.payments || bill.payments.length === 0) ? (
                              <p className="text-3xs text-muted-foreground italic py-1">No payment transactions recorded yet.</p>
                            ) : (
                              <div className="overflow-x-auto border border-border rounded-lg">
                                <table className="w-full text-left text-3xs">
                                  <thead>
                                    <tr className="bg-muted text-muted-foreground font-bold uppercase">
                                      <th className="px-2.5 py-1.5">Voucher #</th>
                                      <th className="px-2.5 py-1.5">Date</th>
                                      <th className="px-2.5 py-1.5 font-tabular text-right">Amount</th>
                                      <th className="px-2.5 py-1.5">Method</th>
                                      <th className="px-2.5 py-1.5">Reference / UTR</th>
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
                                          {new Date(p.paymentDate || p.createdAt).toLocaleDateString('en-IN')}
                                        </td>
                                        <td className="px-2.5 py-1.5 text-right font-extrabold text-emerald-600">
                                          ₹{Number(p.amount).toLocaleString('en-IN')}
                                        </td>
                                        <td className="px-2.5 py-1.5">{p.paymentMethod}</td>
                                        <td className="px-2.5 py-1.5 font-mono text-muted-foreground">
                                          {p.referenceNo || 'N/A'}
                                        </td>
                                        <td className="px-2.5 py-1.5 text-muted-foreground">{p.recordedBy}</td>
                                        <td className="px-2.5 py-1.5 text-center">
                                          {p.receiptUrl ? (
                                            <a
                                              href={p.receiptUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="text-primary hover:underline font-bold inline-flex items-center gap-0.5"
                                            >
                                              <Icon name="DocumentIcon" size={11} /> Proof
                                            </a>
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
                <button onClick={() => setSelectedVendorForBills(null)} className="btn-secondary text-xs">
                  Close Payables Drawer
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* ------------------------------------------------------------- */}
        {/* PAY NOW / RECORD PAYMENT MODAL                                */}
        {/* ------------------------------------------------------------- */}
        {payModalPo && (
          <Modal
            open={!!payModalPo}
            onClose={() => setPayModalPo(null)}
            title="Record Supplier Payment"
            subtitle={`Bill #${payModalPo.invoiceNo || payModalPo.poNo} — ${selectedVendorForBills?.name || payModalPo.vendorName}`}
            size="md"
          >
            <form onSubmit={handlePrePaymentSubmit} className="space-y-4 py-2 text-xs">
              {/* Bill Details Summary Card */}
              <div className="p-3.5 bg-muted/40 border border-border rounded-xl space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vendor Name:</span>
                  <span className="font-bold text-foreground">{selectedVendorForBills?.name || payModalPo.vendorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Bill Cost:</span>
                  <span className="font-bold text-foreground">₹{payModalPo.totalCost.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Previously Paid:</span>
                  <span className="font-semibold text-emerald-600">₹{(payModalPo.paidAmount || 0).toLocaleString('en-IN')}</span>
                </div>
                {Number(payModalPo.creditAmount) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Credits Applied:</span>
                    <span className="font-semibold text-info">-₹{Number(payModalPo.creditAmount).toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-border font-bold">
                  <span className="text-foreground">Remaining Balance Due:</span>
                  <span className="text-danger font-tabular text-sm">
                    ₹{payModalPo.balance.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Quick Amount Selector */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPayAmount(payModalPo.balance)}
                  className="btn-secondary text-2xs py-1 px-2.5 font-bold flex-1"
                >
                  Pay Full Balance (₹{payModalPo.balance.toLocaleString('en-IN')})
                </button>
                <button
                  type="button"
                  onClick={() => setPayAmount(Math.round((payModalPo.balance / 2) * 100) / 100)}
                  className="btn-secondary text-2xs py-1 px-2.5 font-semibold"
                >
                  Pay 50%
                </button>
              </div>

              {/* Amount & Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Payment Amount (₹) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={payModalPo.balance}
                    required
                    placeholder="Enter amount"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="input-field text-xs font-bold text-emerald-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Payment Method *</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="input-field text-xs font-medium"
                  >
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                    <option value="Credit Card">Credit Card</option>
                  </select>
                </div>
              </div>

              {/* Date & Reference */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="input-field text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">UTR / Ref / Cheque #</label>
                  <input
                    type="text"
                    placeholder="e.g. UTR9283741829"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    className="input-field text-xs font-mono"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Payment Remarks / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Cleared invoice batch 1"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="input-field text-xs"
                />
              </div>

              {/* Receipt / Proof Attachment Upload */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">Receipt / Proof Upload (Optional)</label>
                <div className="flex items-center gap-3">
                  <label className="btn-secondary text-2xs py-1.5 px-3 cursor-pointer inline-flex items-center gap-1.5">
                    <Icon name="ArrowUpTrayIcon" size={13} />
                    <span>Attach Payment Screenshot / Receipt</span>
                    <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" />
                  </label>
                  {receiptProof && (
                    <div className="flex items-center gap-1.5 text-2xs text-positive font-bold">
                      <Icon name="CheckCircleIcon" size={14} />
                      <span>Proof Attached</span>
                      <button
                        type="button"
                        onClick={() => setReceiptProof(null)}
                        className="text-danger hover:underline ml-1 font-normal"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button type="button" onClick={() => setPayModalPo(null)} className="btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs gap-1.5 font-bold">
                  <Icon name="ShieldCheckIcon" size={14} />
                  Proceed to Review & Confirm
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* ------------------------------------------------------------- */}
        {/* PRE-PAYMENT CONFIRMATION MODAL                                */}
        {/* ------------------------------------------------------------- */}
        {confirmPaymentModal && payModalPo && (
          <Modal
            open={confirmPaymentModal}
            onClose={() => setConfirmPaymentModal(false)}
            title="Confirm Payment Disbursement"
            subtitle="Please review the transaction details carefully before finalizing"
            size="sm"
          >
            <div className="space-y-4 py-2 text-xs">
              <div className="p-4 rounded-xl border border-warning/30 bg-warning/10 text-foreground space-y-2">
                <div className="flex items-center gap-2 text-warning font-bold text-sm">
                  <Icon name="ExclamationTriangleIcon" size={18} />
                  <span>Financial Authorization Required</span>
                </div>
                <p className="text-muted-foreground">
                  You are recording an irrevocable vendor disbursement. This will update the vendor balance, deduct from
                  accounts payable, and generate an audit log entry.
                </p>
              </div>

              <div className="p-3.5 bg-muted/40 rounded-xl border border-border space-y-1.5 font-tabular text-2xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recipient:</span>
                  <span className="font-bold text-foreground">{selectedVendorForBills?.name || payModalPo.vendorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bill Ref:</span>
                  <span className="font-mono text-primary font-bold">{payModalPo.invoiceNo || payModalPo.poNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disbursement Method:</span>
                  <span className="font-medium text-foreground">{payMethod}</span>
                </div>
                {payRef && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transaction UTR:</span>
                    <span className="font-mono text-foreground font-bold">{payRef}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1.5 border-t border-border text-xs font-bold">
                  <span>Amount to Pay:</span>
                  <span className="text-emerald-600 font-extrabold text-sm">
                    ₹{Number(payAmount).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  disabled={isSubmittingPay}
                  onClick={() => setConfirmPaymentModal(false)}
                  className="btn-secondary text-xs"
                >
                  Back & Edit
                </button>
                <button
                  type="button"
                  disabled={isSubmittingPay}
                  onClick={executePayment}
                  className="btn-primary text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Icon name="CheckCircleIcon" size={14} />
                  {isSubmittingPay ? 'Recording...' : 'Confirm & Authorize Payment'}
                </button>
              </div>
            </div>
          </Modal>
        )}

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
              <div id="payment-voucher-print-area" className="p-5 border border-border rounded-xl bg-card space-y-4">
                <div className="flex items-start justify-between border-b border-border pb-3">
                  <div>
                    <h2 className="text-base font-extrabold text-foreground tracking-tight">COSKO ENTERPRISE RETAIL</h2>
                    <p className="text-3xs text-muted-foreground">Procurement & Accounts Payable Department</p>
                    <p className="text-3xs text-muted-foreground font-mono mt-0.5">Voucher: {receiptVoucherModal.voucherNo}</p>
                  </div>
                  <div className="text-right">
                    <span className="badge-positive text-2xs font-bold px-2 py-0.5">PAID / SETTLED</span>
                    <p className="text-3xs text-muted-foreground mt-1">
                      {new Date(receiptVoucherModal.paymentDate).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-2xs">
                  <div>
                    <span className="text-muted-foreground uppercase text-3xs font-bold block">Vendor Beneficiary:</span>
                    <strong className="text-foreground text-xs block">{receiptVoucherModal.vendorName}</strong>
                    {receiptVoucherModal.vendorGstin && (
                      <span className="text-muted-foreground font-mono block">GSTIN: {receiptVoucherModal.vendorGstin}</span>
                    )}
                    {receiptVoucherModal.vendorPhone && (
                      <span className="text-muted-foreground block">Phone: {receiptVoucherModal.vendorPhone}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground uppercase text-3xs font-bold block">Bill Details:</span>
                    <strong className="text-primary font-mono text-xs block">Invoice #{receiptVoucherModal.billNo}</strong>
                    <span className="text-muted-foreground font-mono text-3xs block">PO Ref: {receiptVoucherModal.poNo}</span>
                  </div>
                </div>

                <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-1.5 font-tabular text-2xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Bill Value:</span>
                    <span className="font-bold text-foreground">₹{Number(receiptVoucherModal.totalCost).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Method:</span>
                    <span className="font-bold text-foreground">{receiptVoucherModal.paymentMethod}</span>
                  </div>
                  {receiptVoucherModal.referenceNo && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transaction Reference (UTR):</span>
                      <span className="font-mono font-bold text-foreground">{receiptVoucherModal.referenceNo}</span>
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

                <div className="flex items-center justify-between text-3xs text-muted-foreground pt-2 border-t border-border">
                  <span>Authorized by: <strong>{receiptVoucherModal.recordedBy || currentUser?.name}</strong></span>
                  <span>Digitally Recorded via COSKO StoreCommand</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-3xs text-muted-foreground">Print or export copy for vendor file.</span>
                <div className="flex items-center gap-2">
                  <button onClick={handlePrintReceipt} className="btn-secondary text-xs gap-1.5 font-bold">
                    <Icon name="PrinterIcon" size={14} />
                    Print Receipt Voucher
                  </button>
                  <button onClick={() => setReceiptVoucherModal(null)} className="btn-primary text-xs font-bold">
                    Done
                  </button>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* ------------------------------------------------------------- */}
        {/* ONBOARD SUPPLIER MODAL                                        */}
        {/* ------------------------------------------------------------- */}
        <Modal
          open={onboardModal}
          onClose={() => setOnboardModal(false)}
          title="Onboard New Supplier"
          subtitle="Register verified supplier into procurement and payables directory"
          size="md"
        >
          <form onSubmit={handleOnboardSubmit} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Company / Supplier Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Havells India Limited"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Suresh Menon"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Category</label>
                <input
                  type="text"
                  placeholder="e.g. Electronics, Hardware"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-field text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Email</label>
                <input
                  type="email"
                  placeholder="e.g. orders@supplier.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">GSTIN (Optional / 15-char)</label>
                <input
                  type="text"
                  maxLength={18}
                  placeholder="e.g. 29AABCS1429B1ZB or URP"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  className="input-field text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Payment Terms</label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="input-field text-xs"
                >
                  <option value="Net 30">Net 30 Days</option>
                  <option value="Net 15">Net 15 Days</option>
                  <option value="Net 60">Net 60 Days</option>
                  <option value="Immediate">Immediate / Cash on Delivery</option>
                  <option value="Advance">100% Advance</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Lead Time (Days)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="3"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(e.target.value === '' ? '' : Number(e.target.value))}
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Address (City / Hub)</label>
                <input
                  type="text"
                  placeholder="e.g. Electronic City, Bengaluru"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="input-field text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button type="button" onClick={() => setOnboardModal(false)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button type="submit" className="btn-primary text-xs font-bold">
                Onboard Supplier
              </button>
            </div>
          </form>
        </Modal>

        {/* ------------------------------------------------------------- */}
        {/* EDIT SUPPLIER MODAL                                           */}
        {/* ------------------------------------------------------------- */}
        {editVendorModal && (
          <Modal
            open={!!editVendorModal}
            onClose={() => setEditVendorModal(null)}
            title={`Edit Supplier — ${editVendorModal.name}`}
            subtitle={`Supplier Code: ${editVendorModal.code}`}
            size="md"
          >
            <form onSubmit={handleUpdateVendorSubmit} className="space-y-4 py-2">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Supplier Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="input-field text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="input-field text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input-field text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">GSTIN (Optional / 15-char)</label>
                  <input
                    type="text"
                    maxLength={18}
                    placeholder="e.g. 29AABCS1429B1ZB or URP"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    className="input-field text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Payment Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="input-field text-xs"
                  >
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Net 15">Net 15 Days</option>
                    <option value="Net 60">Net 60 Days</option>
                    <option value="Immediate">Immediate / Cash on Delivery</option>
                    <option value="Advance">100% Advance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Lead Time (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={leadTimeDays}
                    onChange={(e) => setLeadTimeDays(e.target.value === '' ? '' : Number(e.target.value))}
                    className="input-field text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="input-field text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button type="button" onClick={() => setEditVendorModal(null)} className="btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs font-bold">
                  Save Changes
                </button>
              </div>
            </form>
          </Modal>
        )}

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
                const poCount = (deleteVendorModal as any).totalBillsCount || (deleteVendorModal.outstandingPayable > 0 ? 1 : 0);
                return (
                  <>
                    <div
                      className={`p-4 rounded-xl border ${
                        poCount > 0 ? 'bg-warning/10 border-warning/30 text-foreground' : 'bg-muted/40 border-border text-foreground'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <Icon
                          name={poCount > 0 ? 'ExclamationTriangleIcon' : 'InformationCircleIcon'}
                          size={18}
                          className={poCount > 0 ? 'text-warning shrink-0 mt-0.5' : 'text-primary shrink-0 mt-0.5'}
                        />
                        <div>
                          <p className="font-bold text-sm">
                            {poCount > 0 ? 'Linked Procurement & Financial Records Found' : 'Unused Supplier Profile'}
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
                      <button onClick={() => setDeleteVendorModal(null)} className="btn-secondary text-xs">
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
      </div>
    </AppLayout>
  );
}
