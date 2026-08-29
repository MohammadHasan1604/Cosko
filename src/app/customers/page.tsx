'use client';
import React, { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import { useApp, Customer, normalizeMobileNumber } from '@/context/AppContext';

export default function CustomersPage() {
  const { customers, sales, repairsEnquiries, addCustomer, updateCustomer, deleteCustomer } = useApp();

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

  return (
    <AppLayout activeRoute="/customers">
      <div className="space-y-6 fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">COSKO Customer CRM & Intelligence</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Unified customer CRM linking repair enquiries, store visits, purchase histories, and credit ledgers.
            </p>
          </div>
          <button onClick={() => { resetForm(); setRegisterModal(true); }} className="btn-primary gap-2 self-start sm:self-auto text-xs sm:text-sm">
            <Icon name="PlusIcon" size={18} />
            Add New Customer
          </button>
        </div>

        {/* Deep Search & Segment Pills Bar */}
        <div className="card p-4 space-y-3">
          <div className="relative">
            <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Deep Search by Customer Name, Phone, Invoice # (e.g. CS260011), or Repair Enquiry..."
              value={deepSearchQuery}
              onChange={(e) => setDeepSearchQuery(e.target.value)}
              className="input-field pl-9 text-xs sm:text-sm"
            />
          </div>

          {/* CRM Segment Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {crmSegments.map((seg) => (
              <button
                key={`seg-${seg}`}
                onClick={() => setSelectedSegment(seg)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedSegment === seg ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                {seg}
              </button>
            ))}
          </div>
        </div>

        {/* Customer Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((c) => {
            const custNormPhone = normalizeMobileNumber(c.phone);
            const customerSales = sales.filter((s) => normalizeMobileNumber(s.customerPhone) === custNormPhone || s.customerName === c.name);
            const customerRepairs = repairsEnquiries.filter((r) => normalizeMobileNumber(r.customerPhone) === custNormPhone || r.customerName === c.name);
            const storesVisited = Array.from(new Set(customerSales.map((s) => s.store)));
            const segmentTag = getCustomerSegmentTag(c);

            return (
              <div key={`cust-${c.id}`} className="card p-5 space-y-4 hover:shadow-md transition-all duration-150 relative group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{c.name}</h3>
                      <p className="text-2xs text-muted-foreground">{c.city} · {c.phone}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-3xs font-bold ${
                    segmentTag.includes('Repair') ? 'bg-info/15 text-info border border-info/20' :
                    segmentTag.includes('High') ? 'bg-amber-500/15 text-amber-600 border border-amber-500/20' : 'bg-muted text-muted-foreground'
                  }`}>
                    {segmentTag}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-center">
                  <div className="p-2 rounded-lg bg-muted/40">
                    <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground block">Total Spend</span>
                    <span className="text-xs font-bold text-foreground font-tabular">₹{c.totalSpend.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="p-2 rounded-lg bg-muted/40">
                    <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground block">Orders</span>
                    <span className="text-xs font-bold text-foreground font-tabular">{customerSales.length}</span>
                  </div>

                  <div className="p-2 rounded-lg bg-muted/40">
                    <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground block">Repairs</span>
                    <span className="text-xs font-bold text-primary font-tabular">{customerRepairs.length}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-2xs text-muted-foreground pt-1">
                  <span>Stores: {storesVisited.length > 0 ? storesVisited.join(', ') : 'BLR'}</span>
                  <span>Last: {c.lastPurchase}</span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <button onClick={() => setCrmViewCustomer(c)} className="btn-secondary text-2xs py-1 px-2.5 gap-1">
                    <Icon name="UserIcon" size={13} />
                    View CRM Profile
                  </button>
                  <button onClick={() => openEdit(c)} className="btn-ghost text-2xs py-1 px-2">
                    <Icon name="PencilSquareIcon" size={13} />
                  </button>
                  <button onClick={() => setDeleteConfirmModal(c)} className="btn-ghost text-2xs py-1 px-2 text-danger">
                    <Icon name="TrashIcon" size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unified Customer CRM Profile Modal */}
      {crmViewCustomer && (
        <Modal
          open={!!crmViewCustomer}
          onClose={() => setCrmViewCustomer(null)}
          title={`CRM Profile — ${crmViewCustomer.name}`}
          subtitle={`Unified History · Phone: ${crmViewCustomer.phone} · Segment: ${getCustomerSegmentTag(crmViewCustomer)}`}
          size="lg"
        >
          <div className="space-y-4 py-2 text-xs">
            {/* Customer Header Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-card border border-border">
                <p className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">Total Spend</p>
                <p className="text-base font-extrabold text-foreground font-tabular">₹{crmViewCustomer.totalSpend.toLocaleString('en-IN')}</p>
                <p className="text-3xs text-success font-semibold">Verified Lifetime Value</p>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border">
                <p className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">Credit Balance</p>
                <p className="text-base font-extrabold text-warning font-tabular">₹{crmViewCustomer.creditBalance.toLocaleString('en-IN')}</p>
                <p className="text-3xs text-muted-foreground">Account Ledger Balance</p>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border">
                <p className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">Total Invoices</p>
                <p className="text-base font-extrabold text-foreground font-tabular">
                  {sales.filter((s) => normalizeMobileNumber(s.customerPhone) === normalizeMobileNumber(crmViewCustomer.phone) || s.customerName === crmViewCustomer.name).length} Orders
                </p>
                <p className="text-3xs text-muted-foreground">Store Purchases</p>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border">
                <p className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">Linked Repairs</p>
                <p className="text-base font-extrabold text-primary font-tabular">
                  {repairsEnquiries.filter((r) => normalizeMobileNumber(r.customerPhone) === normalizeMobileNumber(crmViewCustomer.phone) || r.customerName === crmViewCustomer.name).length} Jobs
                </p>
                <p className="text-3xs text-primary font-semibold">Mobile, EV, Appliances</p>
              </div>
            </div>

            {/* Repair Enquiry Linkage Section (Multi-Device) */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="WrenchScrewdriverIcon" size={14} className="text-primary" />
                  Linked Multi-Device Repairs & Services
                </h4>
              </div>

              {repairsEnquiries.filter((r) => normalizeMobileNumber(r.customerPhone) === normalizeMobileNumber(crmViewCustomer.phone) || r.customerName === crmViewCustomer.name).length === 0 ? (
                <div className="p-4 rounded-xl bg-muted/20 border border-border text-center">
                  <p className="text-2xs text-muted-foreground italic">No repair enquiry records found for this customer mobile number.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {repairsEnquiries
                    .filter((r) => normalizeMobileNumber(r.customerPhone) === normalizeMobileNumber(crmViewCustomer.phone) || r.customerName === crmViewCustomer.name)
                    .map((r) => (
                      <div key={`crm-rep-${r.id}`} className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded text-3xs font-bold ${
                              r.deviceType === 'EV' ? 'bg-success/20 text-success' :
                              r.deviceType === 'AC' || r.deviceType === 'TV' || r.deviceType === 'Refrigerator' || r.deviceType === 'Washing Machine' ? 'bg-warning/20 text-warning' :
                              'bg-primary/20 text-primary'
                            }`}>
                              {r.deviceType || 'Device'}
                            </span>
                            <span className="font-bold text-foreground text-xs">{r.deviceName}</span>
                          </div>
                          <span className={`badge-info text-3xs ${r.repairStatus === 'Delivered' || r.repairStatus === 'Ready for Delivery' ? 'badge-success' : ''}`}>
                            {r.repairStatus}
                          </span>
                        </div>

                        <p className="text-2xs font-medium text-foreground">{r.repairRequested}</p>

                        {r.technicianNotes && (
                          <div className="p-1.5 rounded-lg bg-card/80 border border-border text-3xs text-muted-foreground">
                            <span className="font-bold text-foreground">Tech Notes: </span>
                            {r.technicianNotes}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-3xs text-muted-foreground pt-1 border-t border-primary/10">
                          <span>Tech: {r.assignedTech || 'COSKO Specialist'} · {r.storeCode || 'BLR'}</span>
                          <span className="font-bold text-primary">{r.estimatedCost ? `Est: ₹${r.estimatedCost.toLocaleString('en-IN')}` : ''}</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Purchase History */}
            <div className="space-y-2 pt-2 border-t border-border">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Historical Orders & Receipts</h4>
              <div className="overflow-x-auto max-h-48">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-2xs uppercase text-muted-foreground">
                      <th className="px-3 py-2">Invoice #</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Store</th>
                      <th className="px-3 py-2 font-tabular text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-tabular">
                    {sales.filter((s) => normalizeMobileNumber(s.customerPhone) === normalizeMobileNumber(crmViewCustomer.phone) || s.customerName === crmViewCustomer.name).map((s) => (
                      <tr key={`crm-sale-${s.id}`}>
                        <td className="px-3 py-2 font-mono font-bold text-primary">{s.orderNo}</td>
                        <td className="px-3 py-2 text-muted-foreground">{s.createdAt}</td>
                        <td className="px-3 py-2 font-bold">{s.store}</td>
                        <td className="px-3 py-2 text-right font-extrabold">₹{s.total.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-border">
              <button onClick={() => setCrmViewCustomer(null)} className="btn-primary text-xs py-1.5 px-4">
                Close Profile
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add / Edit Customer Modal */}
      {(registerModal || editCustomerModal) && (
        <Modal
          open={registerModal || !!editCustomerModal}
          onClose={() => { setRegisterModal(false); setEditCustomerModal(null); }}
          title={editCustomerModal ? 'Edit Customer Profile' : 'Register New Customer'}
          size="sm"
        >
          <form onSubmit={editCustomerModal ? handleUpdateCustomerSubmit : handleCreateCustomer} className="space-y-3 py-2">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Customer Name *</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="input-field text-xs" />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Phone Number *</label>
              <input type="text" required value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field text-xs" />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field text-xs" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">City</label>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="input-field text-xs" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Tier</label>
                <select value={tier} onChange={(e: any) => setTier(e.target.value)} className="input-field text-xs">
                  <option value="Regular">Regular</option>
                  <option value="VIP">VIP</option>
                  <option value="New">New</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button type="button" onClick={() => { setRegisterModal(false); setEditCustomerModal(null); }} className="btn-secondary text-xs">Cancel</button>
              <button type="submit" className="btn-primary text-xs font-bold">Save Record</button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
