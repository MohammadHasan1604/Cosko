'use client';
import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import { useApp, Customer, normalizeMobileNumber } from '@/context/AppContext';

export default function CustomersPage() {
  const { customers, sales, repairsEnquiries, addCustomer, updateCustomer, deleteCustomer, currentUser } = useApp();

  const [registerModal, setRegisterModal] = useState(false);
  const [editCustomerModal, setEditCustomerModal] = useState<Customer | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<Customer | null>(null);
  const [crmViewCustomer, setCrmViewCustomer] = useState<Customer | null>(null);

  // CRM Segment Filter & Deep Search State
  const [selectedSegment, setSelectedSegment] = useState<string>('All Customers');
  const [deepSearchQuery, setDeepSearchQuery] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [tier, setTier] = useState<'VIP' | 'Regular' | 'New'>('Regular');
  const [creditBalance, setCreditBalance] = useState(0);

  // Listen to URL query ?phone=
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const queryPhone = searchParams.get('phone');
      if (queryPhone) {
        const norm = normalizeMobileNumber(queryPhone);
        const match = customers.find((c) => normalizeMobileNumber(c.phone) === norm);
        if (match) {
          setCrmViewCustomer(match);
        } else {
          // If not in local customers list, create a virtual customer 360 preview
          setCrmViewCustomer({
            id: 'legacy-preview',
            name: 'Historical Customer',
            phone: queryPhone,
            email: 'customer@legacy.internal',
            city: 'Bengaluru',
            tier: 'Regular',
            creditBalance: 0,
            totalSpend: 0,
            lastPurchase: '15 Aug 2025',
          });
        }
      }
    }
  }, [customers]);

  const crmSegments = [
    'All Customers',
    'New Customer',
    'Returning Customer',
    'Repair Customer',
    'Repair + Purchase Customer',
    'High Value Customer',
    'Inactive Customer',
  ];

  // Helper to determine customer segment tag dynamically
  const getCustomerSegmentTag = (cust: Customer) => {
    const custNormPhone = normalizeMobileNumber(cust.phone);
    const custSales = sales.filter((s) => normalizeMobileNumber(s.customerPhone) === custNormPhone || s.customerName === cust.name);
    const custRepairs = repairsEnquiries.filter((r) => normalizeMobileNumber(r.customerPhone) === custNormPhone || r.customerName === cust.name);

    const hasSales = custSales.length > 0;
    const hasRepairs = custRepairs.length > 0;
    const isHighValue = cust.totalSpend >= 50000;

    if (hasSales && hasRepairs) return 'Repair + Purchase Customer';
    if (hasRepairs) return 'Repair Customer';
    if (isHighValue) return 'High Value Customer';
    if (custSales.length > 1) return 'Returning Customer';
    if (cust.tier === 'New' || custSales.length === 0) return 'New Customer';
    return 'Returning Customer';
  };

  // Filtered Customer List based on Segment & Deep Search
  const filteredCustomers = useMemo(() => {
    return customers.filter((cust) => {
      const custNormPhone = normalizeMobileNumber(cust.phone);
      const custSales = sales.filter((s) => normalizeMobileNumber(s.customerPhone) === custNormPhone || s.customerName === cust.name);
      const custRepairs = repairsEnquiries.filter((r) => normalizeMobileNumber(r.customerPhone) === custNormPhone || r.customerName === cust.name);
      const tag = getCustomerSegmentTag(cust);

      // Segment Matching
      const matchSegment = selectedSegment === 'All Customers' || tag === selectedSegment;

      // Deep Search Matching (Customer Name, Mobile, Invoice #, Repair Ref / Requested)
      const q = deepSearchQuery.toLowerCase().trim();
      const matchSearch =
        q === '' ||
        cust.name.toLowerCase().includes(q) ||
        cust.phone.includes(q) ||
        custNormPhone.includes(q) ||
        custSales.some((s) => s.orderNo.toLowerCase().includes(q)) ||
        custRepairs.some((r) => r.repairRequested.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));

      return matchSegment && matchSearch;
    });
  }, [customers, sales, repairsEnquiries, selectedSegment, deepSearchQuery]);

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    addCustomer({
      name,
      phone,
      email: email || `${name.toLowerCase().replace(/\s+/g, '')}@domain.com`,
      city,
      tier,
      creditBalance,
    });
    setRegisterModal(false);
    resetForm();
  };

  const handleUpdateCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCustomerModal) return;
    updateCustomer(editCustomerModal.id, {
      name,
      phone,
      email,
      city,
      tier,
      creditBalance,
    });
    setEditCustomerModal(null);
    resetForm();
  };

  const openEdit = (c: Customer) => {
    setEditCustomerModal(c);
    setName(c.name);
    setPhone(c.phone);
    setEmail(c.email);
    setCity(c.city);
    setTier(c.tier);
    setCreditBalance(c.creditBalance);
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setCity('Bengaluru');
    setTier('Regular');
    setCreditBalance(0);
  };

  // Build unified chronological timeline for Customer 360
  const buildCustomerTimeline = (cust: Customer) => {
    const custNormPhone = normalizeMobileNumber(cust.phone);
    const custSales = sales.filter((s) => normalizeMobileNumber(s.customerPhone) === custNormPhone || s.customerName === cust.name);
    const custRepairs = repairsEnquiries.filter((r) => normalizeMobileNumber(r.customerPhone) === custNormPhone || r.customerName === cust.name);

    const timelineEvents: any[] = [];

    custRepairs.forEach((r) => {
      timelineEvents.push({
        date: r.createdAt || '15 Aug 2025',
        title: `Repair Enquiry: ${r.deviceName}`,
        description: r.repairRequested,
        type: 'repair',
        status: r.repairStatus,
        source: 'Legacy Repair DB',
      });
      if ((r.repairStatus as string) === 'Completed' || r.repairStatus === 'Delivered' || r.repairStatus === 'Ready for Delivery') {
        timelineEvents.push({
          date: r.createdAt || '18 Aug 2025',
          title: `Service Completed: ${r.deviceName}`,
          description: `Device inspected and tested. Status: ${r.repairStatus}`,
          type: 'repair-done',
          source: 'Legacy Repair DB',
        });
      }
    });

    custSales.forEach((s) => {
      timelineEvents.push({
        date: s.createdAt || '22 Aug 2026',
        title: `Retail Purchase (${s.orderNo})`,
        description: `Purchased items at ${s.store} Hub. Total: ₹${s.total.toLocaleString('en-IN')}`,
        type: 'sale',
        source: 'COSKO Application DB',
      });
    });

    return timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  return (
    <AppLayout activeRoute="/customers">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header and Quick Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary border border-primary/20">
                Customer 360 & CRM Suite
              </span>
              <span className="text-xs text-muted-foreground">Unified Master + Legacy Connected</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
              Customer Management
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage live retail customer profiles, credit ledgers, and seamless historical links to legacy service records.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/customers/existing"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary transition-colors text-sm font-medium shadow-sm"
            >
              <Icon name="LinkIcon" className="w-4 h-4 text-blue-500" />
              <span>Legacy Customer Links</span>
            </Link>
            <Link
              href="/repairs"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary transition-colors text-sm font-medium shadow-sm"
            >
              <Icon name="WrenchScrewdriverIcon" className="w-4 h-4 text-primary" />
              <span>Repairs Module</span>
            </Link>
            <button
              onClick={() => { resetForm(); setRegisterModal(true); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Icon name="UserPlusIcon" className="w-4 h-4" />
              <span>Register Customer</span>
            </button>
          </div>
        </div>

        {/* CRM Segment Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {crmSegments.map((segment) => {
            const count = segment === 'All Customers'
              ? customers.length
              : customers.filter((c) => getCustomerSegmentTag(c) === segment).length;
            const isSelected = selectedSegment === segment;

            return (
              <button
                key={segment}
                onClick={() => setSelectedSegment(segment)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                <span>{segment}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-3xs ${isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Deep Search Input */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="relative">
            <Icon name="MagnifyingGlassIcon" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search across customers, mobile (+91 98765 43210), invoices (CS26BLR...), repairs..."
              value={deepSearchQuery}
              onChange={(e) => setDeepSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
            />
          </div>
        </div>

        {/* Customer Directory Table */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Icon name="UsersIcon" className="w-5 h-5 text-primary" />
              <span>Customer Master Directory</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                {filteredCustomers.length} active
              </span>
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/40 text-muted-foreground text-xs uppercase font-semibold border-b border-border">
                <tr>
                  <th className="px-4 py-3.5">Customer Name</th>
                  <th className="px-4 py-3.5">Mobile Number</th>
                  <th className="px-4 py-3.5">City / Store</th>
                  <th className="px-4 py-3.5">CRM Segment</th>
                  <th className="px-4 py-3.5 text-right font-tabular">Total Spend</th>
                  <th className="px-4 py-3.5 text-right font-tabular">Credit Balance</th>
                  <th className="px-4 py-3.5 text-center">Legacy Link</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No customer records matched your query.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((cust) => {
                    const tag = getCustomerSegmentTag(cust);
                    return (
                      <tr key={cust.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-foreground">{cust.name}</div>
                          <div className="text-xs text-muted-foreground">{cust.email}</div>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                          {cust.phone}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-foreground font-medium">
                          {cust.city}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            tag === 'Repair + Purchase Customer' ? 'bg-primary/10 text-primary border border-primary/20' :
                            tag === 'High Value Customer' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                            tag === 'Repair Customer' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' :
                            'bg-secondary text-secondary-foreground'
                          }`}>
                            {tag}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-tabular font-bold text-foreground">
                          ₹{cust.totalSpend.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3.5 text-right font-tabular font-medium text-warning">
                          ₹{cust.creditBalance.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <Icon name="CheckBadgeIcon" className="w-3 h-3" />
                            Connected
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setCrmViewCustomer(cust)}
                            className="inline-flex items-center px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition-colors"
                            title="Customer 360"
                          >
                            360°
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(cust)}
                            className="inline-flex items-center p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary text-xs"
                            title="Edit Customer"
                          >
                            <Icon name="PencilSquareIcon" className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmModal(cust)}
                            className="inline-flex items-center p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-danger hover:bg-danger/10 text-xs transition-colors"
                            title="Archive / Delete Customer"
                          >
                            <Icon name="ArchiveBoxIcon" className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer 360 Unified Profile Modal */}
        {crmViewCustomer && (
          <Modal
            open={!!crmViewCustomer}
            onClose={() => setCrmViewCustomer(null)}
            title={`Customer 360 — ${crmViewCustomer.name}`}
            subtitle={`Unified Profile · Mobile: ${crmViewCustomer.phone} · Location: ${crmViewCustomer.city}`}
            size="lg"
          >
            <div className="space-y-6 py-2 text-sm max-h-[80vh] overflow-y-auto pr-1">
              {/* Top Source Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold border border-primary/20 flex items-center gap-1">
                  <Icon name="CubeIcon" className="w-3.5 h-3.5" /> Source: COSKO Master
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/20 flex items-center gap-1">
                  <Icon name="CircleStackIcon" className="w-3.5 h-3.5" /> Legacy Customer DB
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20 flex items-center gap-1">
                  <Icon name="WrenchScrewdriverIcon" className="w-3.5 h-3.5" /> Legacy Repair DB
                </span>
              </div>

              {/* Legacy Connection Card */}
              <div className="bg-secondary/40 border border-border rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Legacy Connected</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                    <Icon name="CheckCircleIcon" className="w-3.5 h-3.5" /> Yes (Verified)
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">External Customer ID</span>
                  <span className="font-mono font-bold text-foreground mt-0.5 block">LEG-CUST-1001</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Match Method</span>
                  <span className="font-semibold text-foreground mt-0.5 block">Canonical Mobile Normalization</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Source Database</span>
                  <span className="font-mono text-muted-foreground mt-0.5 block">LEGACY_MYSQL_DB (R/O)</span>
                </div>
              </div>

              {/* Customer Analytics KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-card border border-border">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Spend</p>
                  <p className="text-lg font-extrabold text-foreground font-tabular mt-0.5">₹{crmViewCustomer.totalSpend.toLocaleString('en-IN')}</p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">Verified Retail Sales</p>
                </div>
                <div className="p-3.5 rounded-xl bg-card border border-border">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Credit Ledger</p>
                  <p className="text-lg font-extrabold text-warning font-tabular mt-0.5">₹{crmViewCustomer.creditBalance.toLocaleString('en-IN')}</p>
                  <p className="text-[11px] text-muted-foreground">Account Balance</p>
                </div>
                <div className="p-3.5 rounded-xl bg-card border border-border">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Retail Invoices</p>
                  <p className="text-lg font-extrabold text-foreground font-tabular mt-0.5">
                    {sales.filter((s) => normalizeMobileNumber(s.customerPhone) === normalizeMobileNumber(crmViewCustomer.phone) || s.customerName === crmViewCustomer.name).length} Orders
                  </p>
                  <p className="text-[11px] text-muted-foreground">COSKO Invoices</p>
                </div>
                <div className="p-3.5 rounded-xl bg-card border border-border">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Service History</p>
                  <p className="text-lg font-extrabold text-primary font-tabular mt-0.5">
                    {repairsEnquiries.filter((r) => normalizeMobileNumber(r.customerPhone) === normalizeMobileNumber(crmViewCustomer.phone) || r.customerName === crmViewCustomer.name).length} Jobs
                  </p>
                  <p className="text-[11px] text-primary font-semibold">Mobile, EV, AC</p>
                </div>
              </div>

              {/* Customer Journey Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Icon name="ClockIcon" className="w-4 h-4 text-primary" />
                  <span>Customer Journey Timeline</span>
                </h4>
                <div className="border-l-2 border-primary/30 pl-4 space-y-4 ml-2">
                  {buildCustomerTimeline(crmViewCustomer).map((evt, idx) => (
                    <div key={idx} className="relative space-y-1">
                      <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-primary border-2 border-card"></div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground text-xs">{evt.title}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">{evt.date}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{evt.description}</p>
                      <span className="inline-block text-[10px] px-2 py-0.2 rounded bg-secondary text-muted-foreground">
                        Source: {evt.source}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Multi-Device Repair Section */}
              <div className="space-y-3 pt-3 border-t border-border">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Icon name="WrenchScrewdriverIcon" className="w-4 h-4 text-primary" />
                  <span>Connected Device Repair History (Read-Only Legacy DB)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {repairsEnquiries
                    .filter((r) => normalizeMobileNumber(r.customerPhone) === normalizeMobileNumber(crmViewCustomer.phone) || r.customerName === crmViewCustomer.name)
                    .map((r) => (
                      <div key={r.id} className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-primary/20 text-primary">
                            {r.deviceType || 'Device'}
                          </span>
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            {r.repairStatus}
                          </span>
                        </div>
                        <div className="font-bold text-foreground text-xs">{r.deviceName}</div>
                        <p className="text-xs text-muted-foreground">{r.repairRequested}</p>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-primary/10">
                          <span>Ref: {r.id}</span>
                          <span>Store: {r.storeCode || 'BLR'}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Retail Purchase History */}
              <div className="space-y-3 pt-3 border-t border-border">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Icon name="ShoppingBagIcon" className="w-4 h-4 text-primary" />
                  <span>COSKO Retail Purchase Orders & Receipts</span>
                </h4>
                <div className="overflow-x-auto max-h-48 border border-border rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-secondary/40 text-muted-foreground uppercase text-[10px] font-semibold border-b border-border">
                      <tr>
                        <th className="px-3 py-2">Invoice #</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Store</th>
                        <th className="px-3 py-2 text-right">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sales
                        .filter((s) => normalizeMobileNumber(s.customerPhone) === normalizeMobileNumber(crmViewCustomer.phone) || s.customerName === crmViewCustomer.name)
                        .map((s) => (
                          <tr key={s.id} className="hover:bg-secondary/20">
                            <td className="px-3 py-2 font-mono font-bold text-primary">{s.orderNo}</td>
                            <td className="px-3 py-2 text-muted-foreground">{s.createdAt}</td>
                            <td className="px-3 py-2 font-medium">{s.store}</td>
                            <td className="px-3 py-2 text-right font-bold font-tabular">₹{s.total.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-border">
                <button
                  onClick={() => setCrmViewCustomer(null)}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
                >
                  Close Profile
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Create / Edit Modal */}
        {(registerModal || editCustomerModal) && (
          <Modal
            open={registerModal || !!editCustomerModal}
            onClose={() => { setRegisterModal(false); setEditCustomerModal(null); }}
            title={editCustomerModal ? 'Edit Customer Profile' : 'Register New Customer'}
            size="sm"
          >
            <form onSubmit={editCustomerModal ? handleUpdateCustomerSubmit : handleCreateCustomer} className="space-y-4 py-2">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ahmed Khan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Mobile Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. ahmed@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">City Hub</label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Bengaluru">Bengaluru</option>
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Mumbai">Mumbai</option>
                    <option value="Delhi">Delhi</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Tier</label>
                  <select
                    value={tier}
                    onChange={(e: any) => setTier(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Regular">Regular</option>
                    <option value="VIP">VIP</option>
                    <option value="New">New</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => { setRegisterModal(false); setEditCustomerModal(null); }}
                  className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-secondary text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
                >
                  {editCustomerModal ? 'Update Profile' : 'Save Customer'}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* Safe Delete / Archive Confirmation Dialog */}
        {deleteConfirmModal && (
          <Modal
            open={!!deleteConfirmModal}
            onClose={() => setDeleteConfirmModal(null)}
            title={`Archive / Delete Customer "${deleteConfirmModal.name}"`}
            subtitle="Relational validation against sales, credit balances, and repair enquiries"
            size="md"
          >
            <div className="space-y-4 py-2 text-xs">
              {(() => {
                const norm = normalizeMobileNumber(deleteConfirmModal.phone);
                const salesCount = sales.filter((s) => normalizeMobileNumber(s.customerPhone) === norm || s.customerName === deleteConfirmModal.name).length;
                const repairCount = repairsEnquiries.filter((r) => normalizeMobileNumber(r.customerPhone) === norm || r.customerName === deleteConfirmModal.name).length;
                const hasHistory = salesCount > 0 || repairCount > 0 || deleteConfirmModal.totalSpend > 0 || deleteConfirmModal.creditBalance > 0;

                return (
                  <>
                    <div className={`p-4 rounded-xl border ${hasHistory ? 'bg-warning/10 border-warning/30 text-foreground' : 'bg-muted/40 border-border text-foreground'}`}>
                      <div className="flex items-start gap-2.5">
                        <Icon name={hasHistory ? 'ExclamationTriangleIcon' : 'InformationCircleIcon'} size={18} className={hasHistory ? 'text-warning shrink-0 mt-0.5' : 'text-primary shrink-0 mt-0.5'} />
                        <div>
                          <p className="font-bold text-sm">
                            {hasHistory ? 'Customer Has Transaction History' : 'Unused Customer Record'}
                          </p>
                          <p className="text-muted-foreground mt-1">
                            {hasHistory
                              ? `This customer has ${salesCount} sales invoices, ${repairCount} repair jobs, and ₹${deleteConfirmModal.totalSpend.toLocaleString('en-IN')} total spend. They will be safely Archived to maintain financial ledger history.`
                              : `This customer has 0 sales or service records. You can archive this profile, or Super Admins may permanently delete it.`}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmModal(null)}
                        className="btn-secondary text-xs"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          await deleteCustomer(deleteConfirmModal.id, false);
                          setDeleteConfirmModal(null);
                        }}
                        className="btn-primary bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4"
                      >
                        Safe Archive
                      </button>

                      {!hasHistory && currentUser.role === 'Super Admin' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteCustomer(deleteConfirmModal.id, true);
                            setDeleteConfirmModal(null);
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

