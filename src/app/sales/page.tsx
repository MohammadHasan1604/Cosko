'use client';

import React, { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import CoskoLogo from '@/components/ui/CoskoLogo';
import BarcodeScannerModal from '@/components/ui/BarcodeScannerModal';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import { useApp, Customer, InventoryItem, SalePhoto, RepairEnquiry, normalizeMobileNumber } from '@/context/AppContext';
import { toast } from 'sonner';

interface CartItem {
  itemId: string;
  name: string;
  sku: string;
  referenceSellingPrice: number;
  actualSellingPrice: number;
  unitCost: number;
  qty: number;
  maxQty: number;
  discountPercent: number;
  warrantyMonths: number;
}

export default function SalesPage() {
  const {
    sales,
    inventory,
    customers,
    repairsEnquiries,
    categoriesList,
    addSale,
    voidSale,
    addCustomer,
    selectedStore,
    branding,
    systemSettings,
    currentUser,
    addAuditLog,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos');
  const [voidModalOrder, setVoidModalOrder] = useState<any | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Cashier & Store Resolution
  const activeEmployeeName = currentUser.name || 'Sales Executive';
  const effectiveStore =
    currentUser.role !== 'Super Admin'
      ? currentUser.store && currentUser.store !== 'All Stores'
        ? currentUser.store
        : 'CENTRAL'
      : selectedStore === 'All Stores'
      ? 'CENTRAL'
      : selectedStore;

  // Permissions
  const canOverridePrice =
    currentUser.role === 'Super Admin' ||
    currentUser.role === 'Store Manager';
  const canViewCost =
    currentUser.role === 'Super Admin' ||
    currentUser.role === 'Store Manager' ||
    currentUser.role === 'Inventory Auditor';

  // Customer State - Starts clean, no prefilled customer
  const [customerPhoneDigits, setCustomerPhoneDigits] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('walkin');
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerHistory, setCustomerHistory] = useState<{
    purchases: any[];
    repairs: { date: string; status: string; service: string; device: string }[];
  }>({ purchases: [], repairs: [] });

  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);
  const [customerNotFound, setCustomerNotFound] = useState(false);

  // Quick Customer Inline Modal
  const [quickRegModal, setQuickRegModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustGstin, setNewCustGstin] = useState('');

  // GST Invoice Options
  const [gstInvoiceEnabled, setGstInvoiceEnabled] = useState(false);
  const [customerGstin, setCustomerGstin] = useState('');
  const [customerBusinessName, setCustomerBusinessName] = useState('');
  const [customerBillingAddress, setCustomerBillingAddress] = useState('');

  // Checkout State
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Cash' | 'Card' | 'Credit'>('UPI');
  const [cartDiscount, setCartDiscount] = useState<number>(0);
  const [heldCart, setHeldCart] = useState<CartItem[] | null>(null);
  const [receiptModal, setReceiptModal] = useState<any | null>(null);
  const [salePhotos, setSalePhotos] = useState<SalePhoto[]>([]);

  // History Search & Filter State
  const [historySearch, setHistorySearch] = useState('');
  const [historyStoreFilter, setHistoryStoreFilter] = useState('All');
  const [historyDateFilter, setHistoryDateFilter] = useState('');

  // Normalize mobile number helper: strips +91, 0, spaces, dashes
  const clean10DigitPhone = (val: string): string => {
    const raw = val.replace(/\D/g, '');
    if (raw.startsWith('91') && raw.length === 12) return raw.slice(2);
    if (raw.startsWith('0') && raw.length === 11) return raw.slice(1);
    if (raw.length > 10) return raw.slice(-10);
    return raw;
  };

  // Auto-Lookup when 10 digits are typed
  const handlePhoneInput = (val: string) => {
    const cleaned = clean10DigitPhone(val);
    setCustomerPhoneDigits(cleaned);

    if (cleaned.length < 10) {
      setLookupDone(false);
      setCustomerNotFound(false);
      if (selectedCustomerId !== 'walkin' && cleaned.length === 0) {
        // Reset to clean walk-in if cleared
        setSelectedCustomerId('walkin');
        setCustomerName('Walk-in Customer');
        setCustomerPhone('');
        setCustomerHistory({ purchases: [], repairs: [] });
      }
      return;
    }

    // 10 digits reached -> trigger auto lookup
    performCustomerLookup(cleaned);
  };

  const performCustomerLookup = async (phone10: string) => {
    setLookupLoading(true);
    setCustomerNotFound(false);
    const fullNormalized = `+91 ${phone10.slice(0, 5)} ${phone10.slice(5)}`;
    setCustomerPhone(fullNormalized);

    try {
      // 1. Check local customers first
      const localMatch = customers.find(
        (c) => clean10DigitPhone(c.phone) === phone10
      );

      // 2. Call backend legacy / customer lookup API
      let remoteMatch: any = null;
      let remoteRepairs: any[] = [];
      try {
        const res = await fetch(`/api/customers/legacy/search?phone=${encodeURIComponent(phone10)}`);
        const data = await res.json();
        if (data.success && data.found) {
          remoteMatch = data.customer;
          remoteRepairs = data.repairs || [];
        }
      } catch (err) {
        console.warn('Backend customer search fallback:', err);
      }

      const verified = localMatch || remoteMatch;

      if (verified) {
        setSelectedCustomerId(verified.id || 'cust-matched');
        setCustomerName(verified.name || 'Registered Customer');
        setLookupDone(true);
        setCustomerNotFound(false);

        // Fetch Last 3 Purchases
        const pastSales = sales
          .filter(
            (s) =>
              clean10DigitPhone(s.customerPhone || '') === phone10 ||
              s.customerName.toLowerCase() === verified.name.toLowerCase()
          )
          .slice(0, 3);

        // Fetch Last 3 Permitted Service/Repair records (Date, Status, Device/Service requested only)
        const relevantRepairs: { date: string; status: string; service: string; device: string }[] = [];
        if (remoteRepairs && remoteRepairs.length > 0) {
          remoteRepairs.slice(0, 3).forEach((r) => {
            relevantRepairs.push({
              date: r.enquiryDate ? new Date(r.enquiryDate).toLocaleDateString('en-IN') : 'Recent',
              status: r.repairStatus || r.status || 'Received',
              service: r.repairRequested || r.issueDescription || 'Inspection / Service',
              device: r.deviceName || r.deviceType || 'Device',
            });
          });
        } else {
          repairsEnquiries
            .filter((r) => clean10DigitPhone(r.customerPhone) === phone10)
            .slice(0, 3)
            .forEach((r) => {
              relevantRepairs.push({
                date: r.enquiryDate,
                status: r.repairStatus,
                service: r.repairRequested,
                device: r.deviceName || 'Device',
              });
            });
        }

        setCustomerHistory({
          purchases: pastSales,
          repairs: relevantRepairs,
        });

        toast.success(`Verified Customer: ${verified.name}`);
      } else {
        // Customer not found
        setLookupDone(true);
        setCustomerNotFound(true);
        setSelectedCustomerId('walkin');
        setCustomerName('Walk-in Customer');
        setCustomerHistory({ purchases: [], repairs: [] });
      }
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSelectCustomerFromDropdown = (id: string) => {
    if (id === '__add_new__') {
      openQuickRegisterModal();
      return;
    }
    if (id === 'walkin') {
      setSelectedCustomerId('walkin');
      setCustomerName('Walk-in Customer');
      setCustomerPhone('');
      setCustomerPhoneDigits('');
      setCustomerHistory({ purchases: [], repairs: [] });
      setCustomerNotFound(false);
      setLookupDone(false);
      return;
    }

    const found = customers.find((c) => c.id === id);
    if (found) {
      setSelectedCustomerId(found.id);
      setCustomerName(found.name);
      const digits = clean10DigitPhone(found.phone);
      setCustomerPhoneDigits(digits);
      setCustomerPhone(found.phone);
      performCustomerLookup(digits);
    }
  };

  const openQuickRegisterModal = () => {
    setNewCustPhone(customerPhoneDigits ? `+91 ${customerPhoneDigits}` : '+91 ');
    setNewCustName('');
    setNewCustEmail('');
    setNewCustAddress('');
    setNewCustGstin('');
    setQuickRegModal(true);
  };

  const handleQuickRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) {
      toast.error('Customer Name is required');
      return;
    }
    const cleanDigits = clean10DigitPhone(newCustPhone);
    if (cleanDigits.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

    const formattedPhone = `+91 ${cleanDigits.slice(0, 5)} ${cleanDigits.slice(5)}`;

    const created = await addCustomer({
      name: newCustName.trim(),
      phone: formattedPhone,
      email: newCustEmail.trim() || '',
      city: 'Bengaluru',
      address: newCustAddress.trim() || '',
      tier: 'Regular',
      creditBalance: 0,
    });

    if (created) {
      setSelectedCustomerId(created.id);
      setCustomerName(created.name);
      setCustomerPhone(created.phone);
      setCustomerPhoneDigits(cleanDigits);
      setCustomerNotFound(false);
      setLookupDone(true);

      if (newCustGstin.trim()) {
        setGstInvoiceEnabled(true);
        setCustomerGstin(newCustGstin.trim().toUpperCase());
      }
      if (newCustAddress.trim()) {
        setCustomerBillingAddress(newCustAddress.trim());
      }

      setCustomerHistory({ purchases: [], repairs: [] });
      toast.success(`Customer "${created.name}" registered and selected!`);
    }

    setQuickRegModal(false);
  };

  // Inventory Filtering
  const dynamicCategories = useMemo(() => {
    const active = categoriesList.filter((c) => c.status === 'Active').map((c) => c.name);
    return ['All Categories', ...Array.from(new Set(active))];
  }, [categoriesList]);

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchStore = item.store === effectiveStore;
      const matchSearch =
        catalogSearch === '' ||
        item.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        item.sku.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        (item.barcode && item.barcode.includes(catalogSearch)) ||
        (item.brand && item.brand.toLowerCase().includes(catalogSearch.toLowerCase()));
      const matchCategory = selectedCategory === 'All Categories' || item.category === selectedCategory;
      return matchStore && matchSearch && matchCategory;
    });
  }, [inventory, effectiveStore, catalogSearch, selectedCategory]);

  // Cart Management with Reference vs Actual Selling Price
  const addToCart = (item: InventoryItem) => {
    if (item.qtyOnHand <= 0) {
      toast.error(`"${item.name}" is out of stock in ${item.store}!`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id);
      if (existing) {
        if (existing.qty >= item.qtyOnHand) {
          toast.warning(`Maximum available stock reached (${item.qtyOnHand} units)`);
          return prev;
        }
        return prev.map((c) => (c.itemId === item.id ? { ...c, qty: c.qty + 1 } : c));
      }

      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          sku: item.sku,
          referenceSellingPrice: item.sellingPrice,
          actualSellingPrice: item.sellingPrice,
          unitCost: item.costPrice || 0,
          qty: 1,
          maxQty: item.qtyOnHand,
          discountPercent: 0,
          warrantyMonths: item.warrantyMonths || 12,
        },
      ];
    });

    toast.success(`Added "${item.name}" to cart`);
  };

  const updateCartQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.itemId === itemId) {
            const next = c.qty + delta;
            if (next > c.maxQty) {
              toast.warning(`Maximum available stock reached (${c.maxQty} units)`);
              return c;
            }
            return { ...c, qty: Math.max(0, next) };
          }
          return c;
        })
        .filter((c) => c.qty > 0)
    );
  };

  const updateActualSellingPrice = (itemId: string, newPrice: number) => {
    if (!canOverridePrice) {
      toast.error('Permission Denied: Your role is not authorized to override selling prices.');
      return;
    }

    setCart((prev) =>
      prev.map((c) => {
        if (c.itemId === itemId) {
          if (newPrice < c.unitCost) {
            toast.warning(`Warning: Price ₹${newPrice} is below purchase cost ₹${c.unitCost}!`);
          }
          addAuditLog(
            'Sales',
            'Override Selling Price',
            `Adjusted sale price for "${c.name}" from ₹${c.referenceSellingPrice} to ₹${newPrice}`
          );
          return { ...c, actualSellingPrice: newPrice };
        }
        return c;
      })
    );
  };

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, c) => acc + c.actualSellingPrice * c.qty, 0);
  }, [cart]);

  // GST Calculation: When GST is ON: 18% (CGST 9% + SGST 9%)
  const gstRate = 18;
  const cartTax = useMemo(() => {
    if (!gstInvoiceEnabled) return 0;
    return Math.round(cartSubtotal * (gstRate / 100) * 100) / 100;
  }, [cartSubtotal, gstInvoiceEnabled]);

  const cgstAmount = useMemo(() => (gstInvoiceEnabled ? Math.round((cartTax / 2) * 100) / 100 : 0), [cartTax, gstInvoiceEnabled]);
  const sgstAmount = useMemo(() => (gstInvoiceEnabled ? Math.round((cartTax / 2) * 100) / 100 : 0), [cartTax, gstInvoiceEnabled]);

  const cartTotal = useMemo(() => {
    return Math.max(0, cartSubtotal + cartTax - cartDiscount);
  }, [cartSubtotal, cartTax, cartDiscount]);

  // Checkout Execution
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Billing cart is empty! Add products before checking out.');
      return;
    }

    // Validate GSTIN format if GST invoice is enabled and GSTIN is provided
    if (gstInvoiceEnabled && customerGstin.trim()) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(customerGstin.trim().toUpperCase())) {
        toast.error('Invalid GSTIN format. Standard Indian GSTIN is 15 alphanumeric characters (e.g. 29ABCDE1234F1Z5).');
        return;
      }
    }

    const saleOrder = await addSale({
      customerName: customerName.trim() || 'Walk-in Customer',
      customerPhone: customerPhone || '+91 99000 00000',
      store: effectiveStore,
      items: cart.map((c) => ({
        itemId: c.itemId,
        name: c.name,
        qty: c.qty,
        unitPrice: c.actualSellingPrice,
        taxRate: gstInvoiceEnabled ? gstRate : 0,
        warrantyMonths: c.warrantyMonths,
      })),
      subtotal: cartSubtotal,
      taxTotal: cartTax,
      discount: cartDiscount,
      total: cartTotal,
      taxEnabled: gstInvoiceEnabled,
      paymentMethod,
      status: 'Completed',
      salePhotos,
    });

    if (!saleOrder) {
      return;
    }

    // Attach GST snapshot info for receipt modal
    const receiptSnapshot = {
      ...saleOrder,
      gstInvoiceEnabled,
      customerGstin: customerGstin.trim() || undefined,
      customerBusinessName: customerBusinessName.trim() || undefined,
      customerBillingAddress: customerBillingAddress.trim() || undefined,
      cgstAmount,
      sgstAmount,
      coskoGstin: branding.taxNumber || '29AABCC1234F1Z5',
    };

    setReceiptModal(receiptSnapshot);

    // Completely clear transactional POS form (Requirement 18 & 19)
    setCart([]);
    setSalePhotos([]);
    setCartDiscount(0);
    setCustomerPhoneDigits('');
    setSelectedCustomerId('walkin');
    setCustomerName('Walk-in Customer');
    setCustomerPhone('');
    setCustomerHistory({ purchases: [], repairs: [] });
    setLookupDone(false);
    setCustomerNotFound(false);
    setGstInvoiceEnabled(false);
    setCustomerGstin('');
    setCustomerBusinessName('');
    setCustomerBillingAddress('');
  };

  // WhatsApp Digital Invoice Sender
  const handleSendWhatsAppInvoice = (receipt: any) => {
    const rawPhone = receipt.customerPhone || customerPhone;
    const cleanDigits = clean10DigitPhone(rawPhone);
    if (cleanDigits.length < 10) {
      toast.error('Customer has no valid 10-digit mobile number for WhatsApp dispatch.');
      return;
    }

    const custFirstName = (receipt.customerName || 'Valued Customer').split(' ')[0];
    const invoiceUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/sales?invoice=${receipt.orderNo}`;
    const message = `Hello ${custFirstName}, thank you for shopping with COSKO. Your invoice ${receipt.orderNo} for ₹${receipt.total.toLocaleString('en-IN')} is available here: ${invoiceUrl}`;

    const waUrl = `https://wa.me/91${cleanDigits}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
    toast.success(`Opened WhatsApp with invoice link for +91 ${cleanDigits}`);
  };

  // Sales History Filtering
  const filteredSalesHistory = useMemo(() => {
    return sales.filter((s) => {
      const matchSearch =
        historySearch === '' ||
        s.orderNo.toLowerCase().includes(historySearch.toLowerCase()) ||
        s.customerName.toLowerCase().includes(historySearch.toLowerCase()) ||
        s.customerPhone.includes(historySearch);
      const matchStore = historyStoreFilter === 'All' || s.store === historyStoreFilter;
      const matchDate = !historyDateFilter || s.createdAt.includes(historyDateFilter);
      return matchSearch && matchStore && matchDate;
    });
  }, [sales, historySearch, historyStoreFilter, historyDateFilter]);

  return (
    <AppLayout activeRoute="/sales">
      <div className="space-y-4 sm:space-y-6 fade-in">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-bold text-foreground">POS Sales & Checkout Terminal</h1>
              <span className="badge-primary text-2xs uppercase tracking-wider font-mono">{effectiveStore} Store</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cashier: <strong className="text-foreground">{activeEmployeeName}</strong> · Auto-Sequential CS26 Invoicing
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1.5 bg-muted p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('pos')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === 'pos' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                POS Billing
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === 'history' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Sales History ({sales.length})
              </button>
            </div>
          </div>
        </div>

        {activeTab === 'pos' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
            {/* Left Column: Product Catalog & Search */}
            <div className="lg:col-span-7 space-y-4">
              <div className="card p-3.5 sm:p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search product name, SKU, or brand..."
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      className="input-field pl-9 text-xs"
                    />
                  </div>
                  <button onClick={() => setScannerOpen(true)} className="btn-secondary text-xs px-3 gap-1.5 whitespace-nowrap" title="Barcode Scanner">
                    <Icon name="QrCodeIcon" size={16} />
                    Scan
                  </button>
                </div>

                {/* Category Pill Filters */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-2xs scrollbar-none">
                  {dynamicCategories.map((cat) => (
                    <button
                      key={`cat-pill-${cat}`}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors border ${
                        selectedCategory === cat
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-muted-foreground border-border hover:bg-muted/40'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[580px] overflow-y-auto pr-1">
                {filteredInventory.map((item) => (
                  <div
                    key={`inv-grid-${item.id}`}
                    onClick={() => addToCart(item)}
                    className="card p-3 flex flex-col justify-between hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div>
                      <div className="aspect-video w-full rounded-lg bg-muted/40 mb-2 overflow-hidden flex items-center justify-center relative">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <Icon name="PhotoIcon" size={24} className="text-muted-foreground/50" />
                        )}
                        <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-3xs font-mono font-bold bg-black/60 text-white">
                          {item.qtyOnHand} in stock
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-foreground line-clamp-2">{item.name}</h4>
                      <p className="text-3xs text-muted-foreground font-mono mt-0.5">{item.sku}</p>
                    </div>

                    <div className="pt-2 mt-2 border-t border-border flex items-center justify-between">
                      <div>
                        <span className="text-xs font-extrabold text-primary font-tabular">₹{item.sellingPrice.toLocaleString('en-IN')}</span>
                        {canViewCost && (
                          <span className="text-3xs text-muted-foreground block font-mono">Cost: ₹{item.costPrice}</span>
                        )}
                      </div>
                      <button className="p-1 rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Icon name="PlusIcon" size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {filteredInventory.length === 0 && (
                  <div className="col-span-full py-12 text-center text-muted-foreground text-xs">
                    No products found matching filters in {effectiveStore}.
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Customer Phone Lookup + Cart + Checkout */}
            <div className="lg:col-span-5 space-y-4">
              {/* 1. Customer Phone Search & Verification Box */}
              <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-border">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Icon name="UserIcon" size={14} className="text-primary" />
                    Customer Lookup
                  </span>
                  {selectedCustomerId !== 'walkin' && (
                    <button
                      onClick={() => handleSelectCustomerFromDropdown('walkin')}
                      className="text-2xs text-muted-foreground hover:text-danger underline"
                    >
                      Reset to Walk-in
                    </button>
                  )}
                </div>

                {/* +91 Mobile Number Input Field (Requirement 2) */}
                <div>
                  <label className="text-2xs font-bold text-muted-foreground block mb-1">
                    Customer Mobile Number
                  </label>
                  <div className="flex items-center rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-primary/40">
                    <span className="px-3 py-2 bg-muted/60 text-xs font-bold text-muted-foreground border-r border-border select-none">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="98765 43210"
                      value={customerPhoneDigits}
                      onChange={(e) => handlePhoneInput(e.target.value)}
                      className="flex-1 bg-transparent px-3 py-2 text-xs font-mono font-bold text-foreground focus:outline-none"
                    />
                    {lookupLoading && (
                      <span className="pr-3 text-2xs text-muted-foreground animate-pulse">Searching...</span>
                    )}
                  </div>
                </div>

                {/* Dropdown alternative (Requirement 5) */}
                <div>
                  <label className="text-2xs font-bold text-muted-foreground block mb-1">
                    Or Select Existing Customer
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => handleSelectCustomerFromDropdown(e.target.value)}
                    className="input-field text-xs py-1.5"
                  >
                    <option value="walkin">Walk-in Customer</option>
                    <option value="__add_new__" className="font-bold text-primary">
                      + Add New Customer
                    </option>
                    {customers.map((c) => (
                      <option key={`cust-sel-${c.id}`} value={c.id}>
                        {c.name} ({c.phone})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Case A: Customer Found */}
                {lookupDone && !customerNotFound && selectedCustomerId !== 'walkin' && (
                  <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-2 fade-in">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-xs text-foreground block">{customerName}</span>
                        <span className="text-2xs font-mono text-muted-foreground">{customerPhone}</span>
                      </div>
                      <span className="badge-success text-3xs px-2 py-0.5 rounded-full font-bold">
                        Verified Customer
                      </span>
                    </div>

                    {/* Compact Customer History: Last 3 Purchases & Repairs (Requirement 3 & 51) */}
                    {(customerHistory.purchases.length > 0 || customerHistory.repairs.length > 0) && (
                      <div className="pt-2 border-t border-emerald-500/20 space-y-2 text-2xs">
                        {customerHistory.purchases.length > 0 && (
                          <div>
                            <span className="font-bold text-muted-foreground block mb-1">Last Purchases:</span>
                            <div className="space-y-1">
                              {customerHistory.purchases.map((p, idx) => (
                                <div key={`past-p-${idx}`} className="flex justify-between text-foreground">
                                  <span className="font-mono">{p.orderNo} ({p.createdAt})</span>
                                  <span className="font-bold">₹{p.total.toLocaleString('en-IN')}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {customerHistory.repairs.length > 0 && (
                          <div>
                            <span className="font-bold text-muted-foreground block mb-1">Service & Repair History:</span>
                            <div className="space-y-1">
                              {customerHistory.repairs.map((r, idx) => (
                                <div key={`past-r-${idx}`} className="flex justify-between text-foreground">
                                  <span>{r.device} - {r.service}</span>
                                  <span className="badge-warning text-3xs">{r.status}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Case B: Customer Not Found -> Inline Add Customer Action (Requirement 4) */}
                {customerNotFound && customerPhoneDigits.length === 10 && (
                  <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between text-xs fade-in">
                    <div>
                      <p className="font-bold text-foreground">No Customer Found</p>
                      <p className="text-2xs text-muted-foreground">+91 {customerPhoneDigits}</p>
                    </div>
                    <button
                      onClick={openQuickRegisterModal}
                      className="btn-primary text-xs py-1.5 px-3 font-bold flex items-center gap-1"
                    >
                      <Icon name="PlusIcon" size={14} />
                      + Add New Customer
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Billing Cart & Price Line Items */}
              <div className="card p-4 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-foreground">
                      Billing Cart ({cart.reduce((a, b) => a + b.qty, 0)})
                    </span>
                    {heldCart && <span className="badge-warning text-3xs font-bold">Cart Held</span>}
                  </div>

                  {/* GST Invoice Toggle (Requirement 10) */}
                  <div className="flex items-center gap-2">
                    <span className="text-2xs font-bold text-muted-foreground">GST Invoice:</span>
                    <ToggleSwitch
                      checked={gstInvoiceEnabled}
                      onChange={setGstInvoiceEnabled}
                      size="sm"
                      onText="GST ON"
                      offText="GST OFF"
                    />
                  </div>
                </div>

                {/* Customer GST Fields when GST is ON (Requirement 10 & 11) */}
                {gstInvoiceEnabled && (
                  <div className="p-3 rounded-xl border border-primary/30 bg-primary/5 space-y-2 text-xs fade-in">
                    <div className="flex items-center justify-between text-2xs text-muted-foreground">
                      <span>COSKO GSTIN: <strong className="font-mono text-foreground">{branding.taxNumber || '29AABCC1234F1Z5'}</strong></span>
                      <span>Rate: 18% (9% CGST + 9% SGST)</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-3xs font-bold text-muted-foreground block mb-0.5">Customer GSTIN (Optional)</label>
                        <input
                          type="text"
                          maxLength={15}
                          placeholder="29ABCDE1234F1Z5"
                          value={customerGstin}
                          onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                          className="input-field text-2xs py-1 font-mono uppercase"
                        />
                      </div>
                      <div>
                        <label className="text-3xs font-bold text-muted-foreground block mb-0.5">Business / Firm Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Acme Enterprises"
                          value={customerBusinessName}
                          onChange={(e) => setCustomerBusinessName(e.target.value)}
                          className="input-field text-2xs py-1"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-3xs font-bold text-muted-foreground block mb-0.5">Billing Address</label>
                      <input
                        type="text"
                        placeholder="e.g. 12/B Commercial Street, Bengaluru"
                        value={customerBillingAddress}
                        onChange={(e) => setCustomerBillingAddress(e.target.value)}
                        className="input-field text-2xs py-1"
                      />
                    </div>
                  </div>
                )}

                {/* Cart Items List with Reference Selling Price & Actual Selling Price (Requirement 6, 7, 8) */}
                {cart.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <Icon name="ShoppingBagIcon" size={32} className="text-muted-foreground mx-auto" />
                    <p className="text-xs text-muted-foreground font-medium">Cart is empty. Click products to add.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {cart.map((c) => {
                      const isBelowCost = c.actualSellingPrice < c.unitCost;
                      return (
                        <div key={`cart-item-${c.itemId}`} className="p-3 rounded-xl bg-muted/40 border border-border space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-foreground truncate">{c.name}</p>
                              <p className="text-3xs text-muted-foreground font-mono">{c.sku} · {c.warrantyMonths}m Warranty</p>
                            </div>

                            <div className="flex items-center gap-1 bg-card rounded-lg border border-border px-1 py-0.5">
                              <button onClick={() => updateCartQty(c.itemId, -1)} className="p-0.5 text-muted-foreground hover:text-foreground">
                                <Icon name="MinusIcon" size={12} />
                              </button>
                              <span className="text-xs font-bold px-1.5 font-tabular">{c.qty}</span>
                              <button onClick={() => updateCartQty(c.itemId, 1)} className="p-0.5 text-muted-foreground hover:text-foreground">
                                <Icon name="PlusIcon" size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Reference Selling Price vs Actual Selling Price Display */}
                          <div className="flex items-center justify-between text-2xs pt-1 border-t border-border/50">
                            <div className="space-y-0.5">
                              <span className="text-muted-foreground block">
                                Ref Price: <span className="font-semibold text-foreground">₹{c.referenceSellingPrice}</span>
                              </span>
                              {canViewCost && (
                                <span className="text-3xs text-muted-foreground block">
                                  Ref Cost: <span className="font-mono font-medium">₹{c.unitCost}</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <label className="text-3xs text-muted-foreground block">Actual Sale Price (₹)</label>
                                {canOverridePrice ? (
                                  <input
                                    type="number"
                                    min="1"
                                    value={c.actualSellingPrice}
                                    onChange={(e) => updateActualSellingPrice(c.itemId, Number(e.target.value))}
                                    className="input-field text-2xs py-0.5 px-1.5 w-20 text-right font-bold font-tabular"
                                  />
                                ) : (
                                  <span className="font-bold text-foreground font-tabular">₹{c.actualSellingPrice}</span>
                                )}
                              </div>
                              <span className="text-xs font-extrabold text-foreground font-tabular min-w-[55px] text-right">
                                ₹{(c.actualSellingPrice * c.qty).toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>

                          {/* Below Cost Warning (Requirement 7) */}
                          {isBelowCost && (
                            <div className="p-1.5 rounded-lg bg-danger/10 border border-danger/30 text-danger text-3xs font-bold flex items-center gap-1">
                              <Icon name="ExclamationTriangleIcon" size={12} />
                              Below Authoritative Cost Warning (Cost: ₹{c.unitCost}). Authorized override active.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Billing Summary Totals */}
                <div className="pt-3 border-t border-border space-y-1.5 text-xs font-tabular">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Taxable Subtotal:</span>
                    <span>₹{cartSubtotal.toLocaleString('en-IN')}</span>
                  </div>
                  {gstInvoiceEnabled ? (
                    <>
                      <div className="flex justify-between text-muted-foreground text-2xs">
                        <span>CGST (9%):</span>
                        <span>₹{cgstAmount.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground text-2xs">
                        <span>SGST (9%):</span>
                        <span>₹{sgstAmount.toLocaleString('en-IN')}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-muted-foreground">
                      <span>GST Amount:</span>
                      <span className="text-2xs font-semibold">₹0 (Non-GST Invoice)</span>
                    </div>
                  )}
                  {cartDiscount > 0 && (
                    <div className="flex justify-between text-success font-bold">
                      <span>Order Discount:</span>
                      <span>-₹{cartDiscount}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-extrabold text-foreground pt-1.5 border-t border-border">
                    <span>Grand Total:</span>
                    <span className="text-primary">₹{cartTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="grid grid-cols-4 gap-1.5">
                  {(['UPI', 'Cash', 'Card', 'Credit'] as const).map((m) => (
                    <button
                      key={`pm-btn-${m}`}
                      onClick={() => setPaymentMethod(m)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                        paymentMethod === m
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => {
                      if (heldCart) {
                        setCart(heldCart);
                        setHeldCart(null);
                        toast.success('Held cart resumed');
                      } else {
                        if (cart.length === 0) return;
                        setHeldCart(cart);
                        setCart([]);
                        toast.info('Cart put on hold');
                      }
                    }}
                    className="btn-secondary text-xs py-2.5"
                  >
                    {heldCart ? 'Resume Held Cart' : 'Hold Cart'}
                  </button>
                  <button
                    onClick={handleCheckout}
                    disabled={cart.length === 0}
                    className="btn-primary text-xs py-2.5 font-bold"
                  >
                    Complete Checkout
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Sales History Tab (Requirement 17) */
          <div className="card p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div>
                <h3 className="text-sm font-bold text-foreground">Sales Orders & Invoices</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Authoritative MySQL customer sales transaction ledger</p>
              </div>

              {/* History Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Search invoice, customer, phone..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="input-field text-xs py-1 w-44"
                />
                <select
                  value={historyStoreFilter}
                  onChange={(e) => setHistoryStoreFilter(e.target.value)}
                  className="input-field text-xs py-1 w-32"
                >
                  <option value="All">All Stores</option>
                  <option value="CENTRAL">CENTRAL</option>
                  <option value="BLR">BLR</option>
                  <option value="HYD">HYD</option>
                  <option value="DEL">DEL</option>
                  <option value="MUM">MUM</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                    <th className="px-3 py-2.5">Invoice #</th>
                    <th className="px-3 py-2.5">Date / Time</th>
                    <th className="px-3 py-2.5">Store</th>
                    <th className="px-3 py-2.5">Customer & Mobile</th>
                    <th className="px-3 py-2.5 text-center">Items</th>
                    <th className="px-3 py-2.5 text-right">Subtotal</th>
                    <th className="px-3 py-2.5 text-right">GST</th>
                    <th className="px-3 py-2.5 text-right">Total</th>
                    <th className="px-3 py-2.5">Payment</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredSalesHistory.map((s) => (
                    <tr key={`hist-row-${s.id}`} className="hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-2.5 font-mono font-bold text-primary">{s.orderNo}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{s.createdAt}</td>
                      <td className="px-3 py-2.5"><span className="badge-info text-2xs">{s.store}</span></td>
                      <td className="px-3 py-2.5">
                        <span className="font-bold text-foreground block">{s.customerName}</span>
                        <span className="text-2xs font-mono text-muted-foreground">{s.customerPhone}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-medium">{s.items?.length || 1}</td>
                      <td className="px-3 py-2.5 text-right font-tabular">₹{s.subtotal.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2.5 text-right font-tabular text-muted-foreground">
                        {s.taxTotal > 0 ? `₹${s.taxTotal.toLocaleString('en-IN')}` : '₹0'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-foreground font-tabular">
                        ₹{s.total.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="badge-neutral text-2xs">{s.paymentMethod}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setReceiptModal(s)}
                            className="btn-secondary text-2xs py-1 px-2"
                            title="View Invoice"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleSendWhatsAppInvoice(s)}
                            className="p-1 rounded-md bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-colors"
                            title="Send WhatsApp Invoice"
                          >
                            <Icon name="ChatBubbleOvalLeftEllipsisIcon" size={14} />
                          </button>
                          {s.status === 'Cancelled' || s.status === 'Refunded' ? (
                            <span className="px-1.5 py-0.5 rounded text-3xs font-bold bg-danger/10 text-danger border border-danger/20">Voided</span>
                          ) : (
                            (currentUser.role === 'Super Admin' || currentUser.role === 'Store Manager') && (
                              <button
                                onClick={() => setVoidModalOrder(s)}
                                className="p-1 rounded-md bg-danger/10 text-danger hover:bg-danger hover:text-white transition-colors"
                                title="Void Invoice & Restock Inventory"
                              >
                                <Icon name="TrashIcon" size={14} />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredSalesHistory.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-muted-foreground text-xs">
                        No sales transactions found matching query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Quick Customer Register Modal (Requirement 4) */}
      <Modal
        open={quickRegModal}
        onClose={() => setQuickRegModal(false)}
        title="Add New Customer"
        subtitle="Registers customer into MySQL and auto-selects for active sale"
        size="md"
      >
        <form onSubmit={handleQuickRegisterSubmit} className="space-y-3 py-2 text-xs">
          <div>
            <label className="font-bold text-foreground block mb-1">Customer Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Chandra"
              value={newCustName}
              onChange={(e) => setNewCustName(e.target.value)}
              className="input-field text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-foreground block mb-1">Mobile Number (+91) *</label>
              <input
                type="text"
                required
                placeholder="+91 98765 43210"
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
                className="input-field text-xs font-mono"
              />
            </div>
            <div>
              <label className="font-bold text-foreground block mb-1">Email Address (Optional)</label>
              <input
                type="email"
                placeholder="customer@domain.com"
                value={newCustEmail}
                onChange={(e) => setNewCustEmail(e.target.value)}
                className="input-field text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-foreground block mb-1">Customer GSTIN (Optional)</label>
              <input
                type="text"
                maxLength={15}
                placeholder="29ABCDE1234F1Z5"
                value={newCustGstin}
                onChange={(e) => setNewCustGstin(e.target.value.toUpperCase())}
                className="input-field text-xs font-mono uppercase"
              />
            </div>
            <div>
              <label className="font-bold text-foreground block mb-1">Billing Address (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Indiranagar, Bengaluru"
                value={newCustAddress}
                onChange={(e) => setNewCustAddress(e.target.value)}
                className="input-field text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={() => setQuickRegModal(false)} className="btn-secondary text-xs">
              Cancel
            </button>
            <button type="submit" className="btn-primary text-xs font-bold">
              Save & Auto-Select
            </button>
          </div>
        </form>
      </Modal>

      {/* Digital Tax Invoice / Receipt Modal with COSKO LOGO ONLY Watermark (Requirement 14, 15, 16) */}
      {receiptModal && (
        <Modal
          open={!!receiptModal}
          onClose={() => setReceiptModal(null)}
          title="COSKO Digital Tax Invoice"
          subtitle={`${receiptModal.orderNo} · ${receiptModal.createdAt || 'Today'}`}
          size="md"
        >
          <div className="relative space-y-4 py-2 text-xs overflow-hidden">
            {/* Canva / Custom Template Background if configured */}
            {systemSettings?.invoiceTemplateUrl && (
              <div
                className="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none z-0"
                style={{ backgroundImage: `url(${systemSettings.invoiceTemplateUrl})` }}
              />
            )}

            {/* SVG Watermark Overlay: COSKO LOGO ONLY (Strictly configured opacity) */}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
              style={{ opacity: (systemSettings?.watermarkOpacity ?? 5) / 100 }}
            >
              <svg width="220" height="220" viewBox="0 0 100 100" fill="currentColor" className="text-foreground">
                <rect x="15" y="15" width="70" height="70" rx="18" />
                <circle cx="50" cy="50" r="22" fill="white" />
              </svg>
            </div>

            <div className="relative z-10 space-y-4">
              {/* Header */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  {branding.logoUrl ? (
                    <img src={branding.logoUrl} alt="Logo" className="h-8 object-contain" />
                  ) : (
                    <CoskoLogo size={28} showText variant="default" />
                  )}
                </div>
                <h4 className="font-extrabold text-foreground text-sm">{systemSettings?.invoiceHeader || branding.appName || 'COSKO Retail Enterprise'}</h4>
                <p className="text-2xs text-muted-foreground">
                  Invoice #: <strong className="font-mono text-foreground">{receiptModal.orderNo}</strong> · Store: {receiptModal.store}
                </p>
                {systemSettings?.showStoreAddress && (
                  <p className="text-3xs text-muted-foreground mt-0.5">
                    {branding.businessAddress || '100 Feet Ring Road, Indiranagar'}, {branding.city || 'Bengaluru'} · Phone: {branding.supportPhone || '+91 80 4000 8800'}
                  </p>
                )}
                <p className="text-3xs font-mono text-muted-foreground mt-0.5">
                  COSKO GSTIN: <strong>{receiptModal.coskoGstin || systemSettings?.gstin || branding.taxNumber || '29AABCU9603R1ZM'}</strong>
                </p>
              </div>

              {/* Billed To */}
              <div className="flex justify-between border-b border-border pb-2">
                <div>
                  <p className="font-bold text-foreground">Billed To: {receiptModal.customerName}</p>
                  <p className="text-2xs text-muted-foreground">Phone: {receiptModal.customerPhone}</p>
                  {receiptModal.customerGstin && (
                    <p className="text-2xs font-mono text-primary font-bold">GSTIN: {receiptModal.customerGstin}</p>
                  )}
                  {receiptModal.customerBillingAddress && (
                    <p className="text-3xs text-muted-foreground">{receiptModal.customerBillingAddress}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xs font-semibold text-muted-foreground">Warranty Valid Until:</p>
                  <p className="font-bold text-foreground">{receiptModal.warrantyExpiryDate || '12 Months'}</p>
                </div>
              </div>

              {/* Items List */}
              <div className="border-b border-border py-2 space-y-1.5 font-tabular">
                {receiptModal.items?.map((item: any, idx: number) => (
                  <div key={`rcpt-line-${idx}`} className="flex justify-between">
                    <div>
                      <span className="font-semibold">{item.name} x {item.qty}</span>
                      {item.warrantyMonths && (
                        <span className="text-3xs text-muted-foreground block">{item.warrantyMonths} Months Warranty</span>
                      )}
                    </div>
                    <span className="font-bold">₹{(item.unitPrice * item.qty).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="space-y-1 font-tabular text-right text-muted-foreground pt-1">
                <p>Taxable Subtotal: ₹{receiptModal.subtotal.toLocaleString('en-IN')}</p>
                {receiptModal.taxEnabled ? (
                  <p>GST Tax ({systemSettings?.defaultTaxRate ?? 18}%): ₹{receiptModal.taxTotal.toLocaleString('en-IN')}</p>
                ) : (
                  <p>GST Tax: ₹0 (Non-GST)</p>
                )}
                <p className="text-base font-extrabold text-foreground pt-1">
                  Total Paid ({receiptModal.paymentMethod}): ₹{receiptModal.total.toLocaleString('en-IN')}
                </p>
              </div>

              {/* UPI Payment QR if enabled */}
              {systemSettings?.showPaymentQr && (
                <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center gap-3">
                  <div className="w-12 h-12 bg-white p-1 rounded-lg border border-border flex items-center justify-center shrink-0">
                    <Icon name="QrCodeIcon" size={36} className="text-slate-900" />
                  </div>
                  <div className="text-3xs space-y-0.5">
                    <p className="font-bold text-foreground">Scan to Pay / Verify UPI</p>
                    <p className="font-mono text-primary font-bold">{systemSettings.paymentUpiId || 'cosko@icici'}</p>
                    {systemSettings.paymentBankDetails && (
                      <p className="text-muted-foreground">{systemSettings.paymentBankDetails}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Terms & Footer Note */}
              <div className="text-3xs space-y-1 pt-2 border-t border-border/60 text-muted-foreground">
                {systemSettings?.invoiceTerms && (
                  <>
                    <p className="font-semibold text-foreground">Terms & Conditions:</p>
                    <p className="whitespace-pre-line leading-relaxed">{systemSettings.invoiceTerms}</p>
                  </>
                )}
                <p className="italic text-center pt-2 text-foreground font-medium border-t border-border/40">
                  {systemSettings?.invoiceFooter || 'Thank you for shopping with us! Goods once sold cannot be returned without original receipt.'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-secondary text-xs flex items-center gap-1"
                >
                  <Icon name="PrinterIcon" size={14} />
                  Print / PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleSendWhatsAppInvoice(receiptModal)}
                  className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex items-center gap-1 font-bold"
                >
                  <Icon name="ChatBubbleOvalLeftEllipsisIcon" size={14} />
                  Send WhatsApp Invoice
                </button>
                <button type="button" onClick={() => setReceiptModal(null)} className="btn-secondary text-xs">
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Barcode Scanner Modal */}
      {scannerOpen && (
        <BarcodeScannerModal
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScan={(scannedCode) => {
            const match = inventory.find(
              (i) =>
                i.store === effectiveStore &&
                ((i.barcode && i.barcode === scannedCode) || i.sku === scannedCode)
            );
            if (match) {
              addToCart(match);
              toast.success(`Scanned & added: "${match.name}"`);
            } else {
              setCatalogSearch(scannedCode);
              toast.info(`Scanned code: ${scannedCode}. Filter applied.`);
            }
          }}
          title="POS Barcode Scanner"
          subtitle="Scan product retail barcode to instantly add items to the billing cart."
        />
      )}

      {/* Void Sales Order Confirmation Modal */}
      {voidModalOrder && (
        <Modal
          open={!!voidModalOrder}
          onClose={() => setVoidModalOrder(null)}
          title={`Void Sales Order — ${voidModalOrder.orderNo}`}
        >
          <div className="space-y-4">
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl flex items-start gap-3">
              <Icon name="ExclamationTriangleIcon" size={20} className="text-danger flex-shrink-0 mt-0.5" />
              <div className="text-xs text-foreground space-y-1">
                <p className="font-bold">Are you sure you want to void this invoice?</p>
                <p className="text-muted-foreground">
                  This will mark order <strong>{voidModalOrder.orderNo}</strong> (₹{Number(voidModalOrder.total).toLocaleString('en-IN')}) as Cancelled, immediately restock all sold quantities back into store <strong>{voidModalOrder.store}</strong>, and reverse any customer spend updates in the database.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setVoidModalOrder(null)}
                className="btn-secondary text-xs px-3 py-1.5"
                disabled={isVoiding}
              >
                Close
              </button>
              <button
                onClick={async () => {
                  if (!voidModalOrder) return;
                  setIsVoiding(true);
                  try {
                    await voidSale(voidModalOrder.id);
                    setVoidModalOrder(null);
                  } finally {
                    setIsVoiding(false);
                  }
                }}
                className="btn-danger text-xs px-3 py-1.5 bg-danger text-white rounded-lg hover:bg-danger/90"
                disabled={isVoiding}
              >
                {isVoiding ? 'Voiding...' : 'Confirm Void & Restock'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
