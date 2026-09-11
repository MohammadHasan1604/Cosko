'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
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

const INITIAL_REPAIRS: RepairItem[] = [
  {
    id: 'LEG-REP-5001',
    ticketNo: 'TKT-2025-0814',
    customerId: 'LEG-CUST-1001',
    customerName: 'Ahmed Khan',
    customerPhone: '+91 98765 43210',
    normalizedPhone: '9876543210',
    deviceType: 'Mobile',
    deviceName: 'iPhone 13 Pro Max',
    issueDescription: 'iPhone 13 Screen Repair (OLED display blank)',
    status: 'Completed',
    estimatedCost: 8500,
    storeCode: 'BLR',
    enquiryDate: '15 Aug 2025',
    technicianNotes: 'Replaced OEM OLED panel and tested TrueTone calibration.',
    assignedTech: 'Naveen Kumar',
    linkedCoskoSaleNo: 'CS26BLR0001',
  },
  {
    id: 'LEG-REP-5002',
    ticketNo: 'TKT-2026-0120',
    customerId: 'LEG-CUST-1001',
    customerName: 'Ahmed Khan',
    customerPhone: '+91 98765 43210',
    normalizedPhone: '9876543210',
    deviceType: 'EV',
    deviceName: 'Ather 450X Gen 3',
    issueDescription: 'Carbon Drive Belt Replacement & Motor Tuning',
    status: 'Completed',
    estimatedCost: 3200,
    storeCode: 'BLR',
    enquiryDate: '20 Jan 2026',
    technicianNotes: 'Installed high-tensile carbon drive belt. Tension adjusted to 45Hz.',
    assignedTech: 'Arjun Reddy',
    linkedCoskoSaleNo: 'CS26BLR0002',
  },
  {
    id: 'LEG-REP-5003',
    ticketNo: 'TKT-2026-0310',
    customerId: 'LEG-CUST-1002',
    customerName: 'Priya Sharma',
    customerPhone: '+91 98450 11223',
    normalizedPhone: '9845011223',
    deviceType: 'AC',
    deviceName: 'Daikin 1.5 Ton Inverter AC',
    issueDescription: 'Inverter PCB communication error E6',
    status: 'Completed',
    estimatedCost: 2800,
    storeCode: 'HYD',
    enquiryDate: '10 Mar 2026',
    technicianNotes: 'Microcontroller soldered on outdoor PCB. Pressure tested 120 PSI.',
    assignedTech: 'Ganesh Rao',
  },
  {
    id: 'LEG-REP-5004',
    ticketNo: 'TKT-2026-0502',
    customerId: 'LEG-CUST-1003',
    customerName: 'Vikram Mehta',
    customerPhone: '+91 98111 22334',
    normalizedPhone: '9811122334',
    deviceType: 'TV',
    deviceName: 'Sony Bravia 55" 4K OLED',
    issueDescription: 'No backlight / power supply board issue',
    status: 'In Progress',
    estimatedCost: 5500,
    storeCode: 'DEL',
    enquiryDate: '02 May 2026',
    technicianNotes: 'Capacitor bank replaced on main SMPS. Awaiting soaking test.',
    assignedTech: 'Deepak Verma',
  },
  {
    id: 'LEG-REP-5005',
    ticketNo: 'TKT-2026-0715',
    customerId: 'LEG-CUST-1004',
    customerName: 'Rajesh Patil',
    customerPhone: '+91 98200 33445',
    normalizedPhone: '9820033445',
    deviceType: 'Washing Machine',
    deviceName: 'LG 8kg Front Load AI Direct Drive',
    issueDescription: 'Drum motor shaking / hall sensor replacement',
    status: 'Pending Diagnosis',
    estimatedCost: 3800,
    storeCode: 'MUM',
    enquiryDate: '15 Jul 2026',
    technicianNotes: 'Inspecting stator assembly and inverter control PCB.',
    assignedTech: 'Sunil Joshi',
  },
];

export default function RepairsPage() {
  const { currentUser, selectedStore } = useApp();
  const [repairs, setRepairs] = useState<RepairItem[]>([]);
  const [kpis, setKpis] = useState({
    totalEnquiries: 5,
    pendingCount: 1,
    inProgressCount: 1,
    completedCount: 3,
    customersWithRepairs: 4,
    repairAndPurchaseCount: 2,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [storeFilter, setStoreFilter] = useState('All Stores');
  const [deviceFilter, setDeviceFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRepairs = async () => {
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
        setKpis(data.kpis || {});
      }
    } catch (err) {
      console.error('Failed to load repairs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepairs();
  }, [statusFilter, storeFilter, deviceFilter, searchQuery]);

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
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary border border-primary/20">
                Connected Legacy Service Engine
              </span>
              <span className="text-xs text-muted-foreground">Read-Only Synchronized</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
              Repairs & Service Management
            </h1>
            <p className="text-sm text-muted-foreground">
              Directly query, track, and bridge historical device repair records with COSKO retail sales and Customer 360.
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
            <span className="text-xs font-medium text-muted-foreground">Repair + Purchase</span>
            <div className="text-2xl font-bold text-primary mt-1">{kpis.repairAndPurchaseCount}</div>
            <span className="text-[11px] text-primary/80 mt-1 flex items-center gap-1">
              <Icon name="ShoppingCartIcon" className="w-3.5 h-3.5" /> Converted to Retail
            </span>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-4">
          <div className="relative flex-1">
            <Icon name="MagnifyingGlassIcon" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by ticket no, customer, mobile, device, or symptom..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="All">All Statuses</option>
              <option value="Pending Diagnosis">Pending Diagnosis</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>

            <select
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              className="px-3 py-2 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="All">All Device Categories</option>
              <option value="Mobile">Mobile Phones</option>
              <option value="EV">EV / Electric Vehicles</option>
              <option value="AC">Air Conditioners</option>
              <option value="TV">Television</option>
              <option value="Washing Machine">Washing Machine</option>
            </select>

            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="px-3 py-2 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="All Stores">All Stores</option>
              <option value="BLR">BLR (Bengaluru)</option>
              <option value="HYD">HYD (Hyderabad)</option>
              <option value="MUM">MUM (Mumbai)</option>
              <option value="DEL">DEL (Delhi)</option>
            </select>
          </div>
        </div>

        {/* Repair Records Table */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Icon name="WrenchScrewdriverIcon" className="w-5 h-5 text-primary" />
              <span>Repair Enquiries & Service Tickets</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                {repairs.length} records
              </span>
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/40 text-muted-foreground text-xs uppercase font-semibold border-b border-border">
                <tr>
                  <th className="px-4 py-3.5">Ticket Ref</th>
                  <th className="px-4 py-3.5">Enquiry Date</th>
                  <th className="px-4 py-3.5">Customer & Phone</th>
                  <th className="px-4 py-3.5">Device / Product</th>
                  <th className="px-4 py-3.5">Problem / Repair Requested</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Store</th>
                  <th className="px-4 py-3.5">Linked Retail Sale</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span>Querying read-only legacy service records...</span>
                      </div>
                    </td>
                  </tr>
                ) : repairs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      No repair records matched the selected criteria.
                    </td>
                  </tr>
                ) : (
                  repairs.map((r) => (
                    <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3.5 font-mono text-xs font-bold text-foreground">
                        {r.ticketNo}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {r.enquiryDate}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-foreground">{r.customerName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{r.customerPhone}</div>
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
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                          {r.storeCode}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {r.linkedCoskoSaleNo ? (
                          <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            <Icon name="CheckCircleIcon" className="w-3.5 h-3.5" />
                            {r.linkedCoskoSaleNo}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right space-x-2">
                        <Link
                          href={`/repairs/${r.ticketNo}`}
                          className="inline-flex items-center px-2.5 py-1 rounded-lg border border-border bg-card text-foreground hover:bg-secondary text-xs font-medium"
                        >
                          Details
                        </Link>
                        <Link
                          href={`/customers?phone=${encodeURIComponent(r.customerPhone)}`}
                          className="inline-flex items-center px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium"
                        >
                          Customer 360
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
