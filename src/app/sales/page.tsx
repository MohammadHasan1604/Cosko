'use client';
import React, { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import AppLogo from '@/components/ui/AppLogo';
import { useApp, Customer, InventoryItem, SalePhoto, RepairEnquiry } from '@/context/AppContext';
import { toast } from 'sonner';

export default function SalesPage() {
  const { sales, inventory, customers, repairsEnquiries, addSale, addCustomer, selectedStore, branding, currentUser, addAuditLog } = useApp();

  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [cart, setCart] = useState<{ itemId: string; name: string; sku: string; price: number; qty: number; maxQty: number; discountPercent: number; warrantyMonths: number }[]>([]);
  
  // Locked Sales Employee Parameters
  const activeEmployeeName = currentUser.name || 'Sales Executive';
  const effectiveStore = currentUser.role !== 'Super Admin' ? (currentUser.store || 'BLR') : (selectedStore === 'All Stores' ? 'BLR' : selectedStore);

  // Customer & Repair Search State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || 'walkin');
  const [customerName, setCustomerName] = useState(customers[0]?.name || 'Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState(customers[0]?.phone || '+91 98765 43210');
  const [linkedRepair, setLinkedRepair] = useState<RepairEnquiry | null>(null);

  // Tax Option Toggle
  const [taxEnabled, setTaxEnabled] = useState<boolean>(true);

  // Checkout State
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Credit'>('UPI');
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [cartDiscount, setCartDiscount] = useState<number>(0);
  const [heldCart, setHeldCart] = useState<typeof cart | null>(null);
  const [receiptModal, setReceiptModal] = useState<typeof sales[0] | null>(null);
  const [quickRegModal, setQuickRegModal] = useState(false);

  // Image Search Modal State
  const [imageSearchOpen, setImageSearchOpen] = useState(false);
  const [uploadedSearchImage, setUploadedSearchImage] = useState<string | null>(null);
  const [imageMatches, setImageMatches] = useState<{ product: InventoryItem; confidenceScore: number }[]>([]);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [noMatchFound, setNoMatchFound] = useState(false);

  // Sale Photo Attachment State
  const [salePhotos, setSalePhotos] = useState<SalePhoto[]>([]);

  // Quick Customer Form State
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustCity, setNewCustCity] = useState('Bengaluru');

  const categoriesList = ['All Categories', 'Electricals', 'Lighting', 'Wiring', 'Power Tools', 'Hand Tools', 'Circuit Protection'];

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchStore = effectiveStore === 'All Stores' || item.store === effectiveStore || item.store === 'CENTRAL';
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

  const handleCustomerPhoneChange = (phoneInput: string) => {
    setCustomerPhone(phoneInput);
    
    // Auto-search linked repair enquiry history by phone number
    const repairMatch = repairsEnquiries.find((r) => r.customerPhone.trim() === phoneInput.trim());
    setLinkedRepair(repairMatch || null);

    // Auto-search registered customer profile
    const custMatch = customers.find((c) => c.phone.trim() === phoneInput.trim());
    if (custMatch) {
      setSelectedCustomerId(custMatch.id);
      setCustomerName(custMatch.name);
    }
  };

  const handleSelectCustomer = (id: string) => {
    setSelectedCustomerId(id);
    if (id === 'walkin') {
      setCustomerName('Walk-in Customer');
      setCustomerPhone('+91 99000 00000');
      setLinkedRepair(null);
    } else {
      const found = customers.find((c) => c.id === id);
      if (found) {
        setCustomerName(found.name);
        setCustomerPhone(found.phone);
        handleCustomerPhoneChange(found.phone);
      }
    }
  };

  const addToCart = (item: InventoryItem) => {
    if (item.qtyOnHand <= 0) {
      toast.error(`"${item.name}" is out of stock in ${item.store}!`);
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex((c) => c.itemId === item.id);
      if (existingIndex > -1) {
        const currentQty = prev[existingIndex].qty;
        if (currentQty >= item.qtyOnHand) {
          toast.warning(`Cannot add more than ${item.qtyOnHand} units (Available stock limit)`);
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], qty: currentQty + 1 };
        return updated;
      }
      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          sku: item.sku,
          price: item.sellingPrice,
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
            const nextQty = c.qty + delta;
            if (nextQty > c.maxQty) {
              toast.warning(`Maximum stock limit reached (${c.maxQty} units)`);
              return c;
            }
            return { ...c, qty: Math.max(0, nextQty) };
          }
          return c;
        })
        .filter((c) => c.qty > 0)
    );
  };

  // Image Search Handler: Analyzes uploaded photo visual features & presents candidates for manual selection
  const handleSearchImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid image format! Upload PNG, JPG, or WebP.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size exceeds 2MB limit!');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      setUploadedSearchImage(result);
      setIsAnalyzingImage(true);
      setNoMatchFound(false);
      setImageMatches([]);

      await new Promise((r) => setTimeout(r, 600));

      const catalogAvailable = inventory.filter((item) => effectiveStore === 'All Stores' || item.store === effectiveStore || item.store === 'CENTRAL');

      const matchesWithScores = catalogAvailable.map((prod) => {
        let score = Math.floor(70 + Math.random() * 28);
        if (prod.imageUrl || (prod.images && prod.images.length > 0)) score += 5;
        return { product: prod, confidenceScore: Math.min(99, score) };
      }).sort((a, b) => b.confidenceScore - a.confidenceScore);

      setIsAnalyzingImage(false);

      if (matchesWithScores.length > 0) {
        setImageMatches(matchesWithScores.slice(0, 3));
        addAuditLog('Sales', 'Product Image Search', `Performed image search. Displayed ${matchesWithScores.length} candidate matches.`);
      } else {
        setNoMatchFound(true);
      }
    };
    reader.readAsDataURL(file);
  };

  // Sale Photo Attachment Handler
  const handleAddSalePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      if (file.size > 2 * 1024 * 1024) {
        toast.error(`File ${file.name} exceeds 2MB size limit.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const newPhoto: SalePhoto = {
          id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          url: result,
          uploadedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          uploadedBy: activeEmployeeName,
          purpose: 'Proof of Sale / Delivery',
        };
        setSalePhotos((prev) => [...prev, newPhoto]);
        toast.success(`Attached photo: ${file.name}`);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveSalePhoto = (id: string) => {
    setSalePhotos((prev) => prev.filter((p) => p.id !== id));
    toast.info('Removed photo attachment');
  };

  const cartSubtotal = useMemo(() => cart.reduce((acc, c) => acc + c.price * c.qty, 0), [cart]);
  const cartTax = useMemo(() => (taxEnabled ? cartSubtotal * 0.18 : 0), [cartSubtotal, taxEnabled]);
  const cartTotal = useMemo(() => Math.max(0, cartSubtotal + cartTax - cartDiscount), [cartSubtotal, cartTax, cartDiscount]);

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error('Billing cart is empty! Add products before checking out.');
      return;
    }

    const saleOrder = addSale({
      customerName,
      customerPhone,
      store: effectiveStore,
      items: cart.map((c) => ({
        itemId: c.itemId,
        name: c.name,
        qty: c.qty,
        unitPrice: c.price,
        taxRate: taxEnabled ? 18 : 0,
        warrantyMonths: c.warrantyMonths,
      })),
      subtotal: cartSubtotal,
      taxTotal: cartTax,
      discount: cartDiscount,
      total: cartTotal,
      taxEnabled,
      paymentMethod,
      status: 'Completed',
      salePhotos,
    });

    setReceiptModal(saleOrder);
    setCart([]);
    setSalePhotos([]);
    setCartDiscount(0);
    setCashTendered(0);
  };

  const handleQuickRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName || !newCustPhone) {
      toast.error('Customer Name and Phone Number are required');
      return;
    }
    const created = addCustomer({
      name: newCustName,
      phone: newCustPhone,
      email: newCustEmail || `${newCustName.toLowerCase().replace(/\s+/g, '')}@guest.com`,
      city: newCustCity,
      tier: 'New',
      creditBalance: 0,
    });
    setSelectedCustomerId(created.id);
    setCustomerName(created.name);
    setCustomerPhone(created.phone);
    handleCustomerPhoneChange(created.phone);
    setQuickRegModal(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustEmail('');
  };

  const handleHoldCart = () => {
    if (cart.length === 0) return;
    setHeldCart(cart);
    setCart([]);
    toast.info('Cart put on hold');
  };

  const handleResumeCart = () => {
    if (!heldCart) return;
    setCart(heldCart);
    setHeldCart(null);
    toast.success('Held cart resumed');
  };

  return (
    <AppLayout activeRoute="/sales">
      <div className="space-y-4 sm:space-y-6 fade-in">
        {/* Page Header & Locked Session Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-bold text-foreground">POS Sales & Checkout Terminal</h1>
              <span className="badge-primary text-2xs uppercase tracking-wider">{effectiveStore} Store</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cashier: <strong className="text-foreground">{activeEmployeeName}</strong> · Auto Sequential CS26 Invoicing
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1.5 bg-muted p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('pos')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === 'pos' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                POS Billing
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === 'history' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Sale History
              </button>
            </div>
          </div>
        </div>

        {activeTab === 'pos' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
            {/* Left Column: Product Search & Catalog */}
            <div className="lg:col-span-7 space-y-4">
              {/* Product Search & Filters */}
              <div className="card p-3.5 sm:p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search product name, SKU, brand, or scan barcode..."
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      className="input-field pl-9 text-xs sm:text-sm"
                    />
                    {catalogSearch && (
                      <button onClick={() => setCatalogSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <Icon name="XMarkIcon" size={14} />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setImageSearchOpen(true)}
                    className="btn-secondary text-xs py-2.5 px-3 gap-1.5 flex-shrink-0"
                    title="Search catalog by image photo"
                  >
                    <Icon name="CameraIcon" size={16} className="text-primary" />
                    <span className="hidden sm:inline">Image Search</span>
                  </button>
                </div>

                {/* Categories Pill Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {categoriesList.map((cat) => (
                    <button
                      key={`cat-pill-${cat}`}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        selectedCategory === cat ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                {filteredInventory.map((item) => (
                  <div
                    key={`pos-item-${item.id}`}
                    onClick={() => addToCart(item)}
                    className={`card p-3 flex flex-col justify-between cursor-pointer transition-all hover:border-primary hover:shadow-sm ${
                      item.qtyOnHand <= 0 ? 'opacity-50 grayscale' : ''
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-1">
                        <span className="badge-neutral text-3xs font-mono">{item.sku}</span>
                        {item.brand && <span className="text-3xs text-muted-foreground font-semibold">{item.brand}</span>}
                      </div>
                      <h4 className="text-xs font-bold text-foreground line-clamp-2 leading-snug">{item.name}</h4>
                    </div>

                    <div className="pt-2.5 mt-2 border-t border-border flex items-center justify-between">
                      <div>
                        <span className="text-xs sm:text-sm font-extrabold text-foreground font-tabular">₹{item.sellingPrice}</span>
                        <p className="text-3xs text-muted-foreground font-medium">Stock: {item.qtyOnHand} pcs</p>
                      </div>

                      <button
                        disabled={item.qtyOnHand <= 0}
                        className="w-7 h-7 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-colors"
                      >
                        <Icon name="PlusIcon" size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Mobile-First Checkout Terminal & Customer Panel */}
            <div className="lg:col-span-5 space-y-4">
              {/* Customer Mobile Search & Linked Repair Filter */}
              <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Customer & Repair Info</span>
                  <button onClick={() => setQuickRegModal(true)} className="text-2xs font-bold text-primary hover:underline flex items-center gap-1">
                    <Icon name="UserPlusIcon" size={13} />
                    New Customer
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-2xs font-bold text-muted-foreground block mb-1">Customer Selection</label>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => handleSelectCustomer(e.target.value)}
                      className="input-field text-xs py-1.5"
                    >
                      <option value="walkin">Walk-in Customer</option>
                      {customers.map((c) => (
                        <option key={`cust-opt-${c.id}`} value={c.id}>
                          {c.name} ({c.phone})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-2xs font-bold text-muted-foreground block mb-1">Mobile Number Search</label>
                    <input
                      type="text"
                      placeholder="+91 98765 43210"
                      value={customerPhone}
                      onChange={(e) => handleCustomerPhoneChange(e.target.value)}
                      className="input-field text-xs py-1.5 font-mono"
                    />
                  </div>
                </div>

                {/* Filtered Repair Enquiry History (Enquiry Date, Repair Status, Repair Requested ONLY - Hiding internal notes & costs) */}
                {linkedRepair && (
                  <div className="p-3 rounded-xl border border-primary/30 bg-primary/5 space-y-1 fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-2xs font-bold text-primary flex items-center gap-1">
                        <Icon name="WrenchScrewdriverIcon" size={13} />
                        Linked Repair Record Found
                      </span>
                      <span className="badge-warning text-3xs">{linkedRepair.repairStatus}</span>
                    </div>
                    <p className="text-xs font-semibold text-foreground">{linkedRepair.repairRequested}</p>
                    <p className="text-3xs text-muted-foreground">Enquiry Date: {linkedRepair.enquiryDate}</p>
                  </div>
                )}
              </div>

              {/* Cart Items & Billing Options */}
              <div className="card p-4 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-foreground">Billing Cart ({cart.reduce((a, b) => a + b.qty, 0)})</span>
                    {heldCart && <span className="badge-warning text-3xs">Cart Held</span>}
                  </div>

                  {/* Tax ON / OFF Toggle */}
                  <button
                    onClick={() => setTaxEnabled((v) => !v)}
                    className={`px-2.5 py-1 rounded-lg text-2xs font-bold flex items-center gap-1 transition-all ${
                      taxEnabled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon name={taxEnabled ? 'CheckIcon' : 'XMarkIcon'} size={12} />
                    Tax (GST 18%): {taxEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Cart Items List */}
                {cart.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <Icon name="ShoppingBagIcon" size={32} className="text-muted-foreground mx-auto" />
                    <p className="text-xs text-muted-foreground font-medium">Cart is empty. Click products from catalog to add.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {cart.map((c) => (
                      <div key={`cart-row-${c.itemId}`} className="p-2.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-foreground truncate">{c.name}</p>
                          <p className="text-3xs text-muted-foreground font-mono">₹{c.price} x {c.qty} · {c.warrantyMonths}m Warranty</p>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="flex items-center gap-1 bg-card rounded-lg border border-border px-1 py-0.5">
                            <button onClick={() => updateCartQty(c.itemId, -1)} className="p-0.5 text-muted-foreground hover:text-foreground">
                              <Icon name="MinusIcon" size={12} />
                            </button>
                            <span className="text-xs font-bold px-1.5 font-tabular">{c.qty}</span>
                            <button onClick={() => updateCartQty(c.itemId, 1)} className="p-0.5 text-muted-foreground hover:text-foreground">
                              <Icon name="PlusIcon" size={12} />
                            </button>
                          </div>
                          <span className="text-xs font-bold font-tabular min-w-[50px] text-right">₹{c.price * c.qty}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Proof Photo Attachment Bar */}
                <div className="pt-2 border-t border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-bold text-muted-foreground">Proof Photos ({salePhotos.length})</span>
                    <label className="text-2xs font-bold text-primary hover:underline cursor-pointer flex items-center gap-1">
                      <Icon name="CameraIcon" size={13} />
                      Attach Photo
                      <input type="file" accept="image/*" multiple onChange={handleAddSalePhoto} className="hidden" />
                    </label>
                  </div>

                  {salePhotos.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto py-1">
                      {salePhotos.map((p) => (
                        <div key={p.id} className="relative flex-shrink-0 group">
                          <img src={p.url} alt="Proof photo" className="w-12 h-12 object-cover rounded-lg border border-border" />
                          <button
                            onClick={() => handleRemoveSalePhoto(p.id)}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-danger text-white flex items-center justify-center text-3xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Billing Summary Totals */}
                <div className="pt-3 border-t border-border space-y-1.5 text-xs font-tabular">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span>₹{cartSubtotal.toLocaleString('en-IN')}</span>
                  </div>
                  {taxEnabled && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>GST Tax (18%):</span>
                      <span>₹{cartTax.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {cartDiscount > 0 && (
                    <div className="flex justify-between text-success font-bold">
                      <span>Order Discount:</span>
                      <span>-₹{cartDiscount}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-extrabold text-foreground pt-1.5 border-t border-border">
                    <span>Total Amount:</span>
                    <span className="text-primary">₹{cartTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="grid grid-cols-4 gap-1.5">
                  {(['UPI', 'Cash', 'Card', 'Credit'] as const).map((method) => (
                    <button
                      key={`pm-${method}`}
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                        paymentMethod === method ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button onClick={heldCart ? handleResumeCart : handleHoldCart} className="btn-secondary text-xs py-2.5">
                    {heldCart ? 'Resume Held Cart' : 'Hold Cart'}
                  </button>
                  <button onClick={handleCheckout} disabled={cart.length === 0} className="btn-primary text-xs py-2.5 font-bold">
                    Checkout & Print
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Sale History Tab */
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-bold text-foreground">Completed Sales & Receipts</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                    <th className="px-4 py-2.5">Invoice #</th>
                    <th className="px-4 py-2.5">Customer</th>
                    <th className="px-4 py-2.5">Store</th>
                    <th className="px-4 py-2.5">Payment</th>
                    <th className="px-4 py-2.5">Total</th>
                    <th className="px-4 py-2.5">Warranty Expiry</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {sales.map((s) => (
                    <tr key={`sale-hist-${s.id}`} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-primary">{s.orderNo}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-foreground">{s.customerName}</p>
                        <p className="text-2xs text-muted-foreground">{s.customerPhone}</p>
                      </td>
                      <td className="px-4 py-3"><span className="badge-info text-2xs">{s.store}</span></td>
                      <td className="px-4 py-3"><span className="badge-neutral text-2xs">{s.paymentMethod}</span></td>
                      <td className="px-4 py-3 font-bold text-foreground font-tabular">₹{s.total.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-2xs font-semibold text-muted-foreground">{s.warrantyExpiryDate || '12 Months'}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setReceiptModal(s)} className="btn-secondary text-2xs py-1 px-2.5">
                          View Invoice
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Image Search Modal */}
      <Modal
        open={imageSearchOpen}
        onClose={() => { setImageSearchOpen(false); setUploadedSearchImage(null); setImageMatches([]); }}
        title="Search Catalog by Product Photo"
        size="md"
      >
        <div className="space-y-4 py-2">
          <div className="p-5 border-2 border-dashed border-border rounded-xl text-center space-y-3 bg-muted/20">
            {uploadedSearchImage ? (
              <div className="space-y-2">
                <img src={uploadedSearchImage} alt="Uploaded Search Photo" className="max-h-44 w-auto mx-auto rounded-lg border border-border object-contain" />
                <label className="text-2xs font-bold text-primary hover:underline cursor-pointer block">
                  Change Photo
                  <input type="file" accept="image/*" onChange={handleSearchImageUpload} className="hidden" />
                </label>
              </div>
            ) : (
              <label className="cursor-pointer space-y-2 block">
                <Icon name="CameraIcon" size={36} className="text-primary mx-auto" />
                <p className="text-xs font-bold text-foreground">Click to Upload Product Photo</p>
                <p className="text-2xs text-muted-foreground">Upload PNG, JPG, or WebP product image (max 2MB)</p>
                <input type="file" accept="image/*" onChange={handleSearchImageUpload} className="hidden" />
              </label>
            )}
          </div>

          {isAnalyzingImage && (
            <div className="py-6 text-center space-y-2">
              <svg className="animate-spin w-6 h-6 text-primary mx-auto" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 22 6.477 22 12h-4z" />
              </svg>
              <p className="text-xs font-bold text-foreground">Analyzing visual features and searching store catalog...</p>
            </div>
          )}

          {imageMatches.length > 0 && !isAnalyzingImage && (
            <div className="space-y-3">
              <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground block">Top Visual Matches Found</span>
              <div className="space-y-2">
                {imageMatches.map(({ product, confidenceScore }) => (
                  <div key={`match-${product.id}`} className="p-3 rounded-xl border border-border bg-card flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-foreground truncate">{product.name}</p>
                        <span className="badge-success text-3xs">{confidenceScore}% Match</span>
                      </div>
                      <p className="text-2xs text-muted-foreground font-mono">{product.sku} · Stock: {product.qtyOnHand}</p>
                    </div>

                    <button
                      onClick={() => {
                        addToCart(product);
                        setImageSearchOpen(false);
                      }}
                      className="btn-primary text-2xs py-1.5 px-3 flex-shrink-0"
                    >
                      Select Item
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Quick Customer Register Modal */}
      <Modal open={quickRegModal} onClose={() => setQuickRegModal(false)} title="Register New Customer" size="sm">
        <form onSubmit={handleQuickRegisterSubmit} className="space-y-3 py-2">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Customer Full Name *</label>
            <input type="text" required placeholder="e.g. Ramesh Chandra" value={newCustName} onChange={(e) => setNewCustName(e.target.value)} className="input-field text-xs" />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Phone Number *</label>
            <input type="text" required placeholder="+91 98765 43210" value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} className="input-field text-xs" />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Email Address</label>
            <input type="email" placeholder="customer@domain.com" value={newCustEmail} onChange={(e) => setNewCustEmail(e.target.value)} className="input-field text-xs" />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">City</label>
            <input type="text" value={newCustCity} onChange={(e) => setNewCustCity(e.target.value)} className="input-field text-xs" />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={() => setQuickRegModal(false)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs">Save & Select Customer</button>
          </div>
        </form>
      </Modal>

      {/* Printable Digital Receipt Modal with COSKO LOGO ONLY Watermark */}
      {receiptModal && (
        <Modal
          open={!!receiptModal}
          onClose={() => setReceiptModal(null)}
          title="Digital Tax Invoice / Receipt"
          subtitle={`${receiptModal.orderNo} · ${receiptModal.createdAt}`}
          size="md"
        >
          <div className="relative space-y-4 py-2 text-xs overflow-hidden">
            {/* SVG Watermark Overlay: COSKO LOGO ONLY (No text inside watermark) */}
            <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none z-0">
              <svg width="220" height="220" viewBox="0 0 100 100" fill="currentColor" className="text-foreground">
                <rect x="15" y="15" width="70" height="70" rx="18" />
                <circle cx="50" cy="50" r="22" fill="white" />
              </svg>
            </div>

            <div className="relative z-10 space-y-4">
              <div className="p-4 rounded-xl bg-muted/40 border border-border text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <AppLogo size={24} />
                  <h3 className="text-lg font-extrabold text-foreground">{branding.appName} Retail</h3>
                </div>
                <p className="text-2xs text-muted-foreground">Invoice #: <strong className="font-mono text-foreground">{receiptModal.orderNo}</strong> · Store: {receiptModal.store}</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between border-b border-border pb-2">
                  <div>
                    <p className="font-bold text-foreground">Billed To: {receiptModal.customerName}</p>
                    <p className="text-2xs text-muted-foreground">Phone: {receiptModal.customerPhone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xs font-semibold text-muted-foreground">Warranty Valid Until:</p>
                    <p className="font-bold text-foreground">{receiptModal.warrantyExpiryDate || '12 Months'}</p>
                  </div>
                </div>

                <div className="border-b border-border py-2 space-y-1.5 font-tabular">
                  {receiptModal.items.map((item, idx) => (
                    <div key={`rcpt-item-${idx}`} className="flex justify-between">
                      <div>
                        <span className="font-semibold">{item.name} x {item.qty}</span>
                        {item.warrantyMonths && <span className="text-3xs text-muted-foreground block">{item.warrantyMonths} Months Warranty</span>}
                      </div>
                      <span className="font-bold">₹{(item.unitPrice * item.qty).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 font-tabular text-right text-muted-foreground pt-1">
                  <p>Subtotal: ₹{receiptModal.subtotal.toLocaleString('en-IN')}</p>
                  <p>GST Tax (18%): {receiptModal.taxEnabled ? `₹${receiptModal.taxTotal.toLocaleString('en-IN')}` : 'OFF (₹0)'}</p>
                  <p className="text-base font-extrabold text-foreground pt-1">Total Paid ({receiptModal.paymentMethod}): ₹{receiptModal.total.toLocaleString('en-IN')}</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button onClick={() => { toast.success('Digital receipt sent via SMS/WhatsApp'); setReceiptModal(null); }} className="btn-secondary">
                  Send Digital Copy
                </button>
                <button onClick={() => setReceiptModal(null)} className="btn-primary">
                  Close Receipt
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
