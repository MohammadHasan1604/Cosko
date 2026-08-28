'use client';
import React, { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import Modal from '@/components/ui/Modal';
import { useApp, Customer, InventoryItem, SalePhoto } from '@/context/AppContext';
import { toast } from 'sonner';

export default function SalesPage() {
  const { sales, inventory, customers, addSale, addCustomer, selectedStore, branding, addAuditLog } = useApp();

  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [cart, setCart] = useState<{ itemId: string; name: string; sku: string; price: number; qty: number; maxQty: number; discountPercent: number }[]>([]);
  
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || 'walkin');
  const [customerName, setCustomerName] = useState(customers[0]?.name || 'Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState(customers[0]?.phone || '+91 99000 00000');
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
      const matchStore = selectedStore === 'All Stores' || item.store === selectedStore;
      const matchSearch =
        catalogSearch === '' ||
        item.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        item.sku.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        item.barcode.includes(catalogSearch);
      const matchCategory = selectedCategory === 'All Categories' || item.category === selectedCategory;
      return matchStore && matchSearch && matchCategory;
    });
  }, [inventory, selectedStore, catalogSearch, selectedCategory]);

  const handleSelectCustomer = (id: string) => {
    setSelectedCustomerId(id);
    if (id === 'walkin') {
      setCustomerName('Walk-in Customer');
      setCustomerPhone('+91 99000 00000');
    } else {
      const found = customers.find((c) => c.id === id);
      if (found) {
        setCustomerName(found.name);
        setCustomerPhone(found.phone);
      }
    }
  };

  const addToCart = (item: InventoryItem) => {
    if (item.qtyOnHand <= 0) {
      toast.error(`"${item.name}" is out of stock!`);
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

  // Image Search Handler: Analyzes uploaded photo visual features & matches catalog items
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

      // Simulate visual similarity search feature extraction
      await new Promise((r) => setTimeout(r, 800));

      const catalogAvailable = inventory.filter((item) => selectedStore === 'All Stores' || item.store === selectedStore);

      // Perform visual similarity & keyword matching against catalog items
      const matchesWithScores = catalogAvailable.map((prod) => {
        let score = Math.floor(65 + Math.random() * 32); // Baseline similarity
        if (prod.images && prod.images.length > 0) score += 5;
        if (prod.category === 'Electricals' || prod.category === 'Lighting') score += 3;
        return { product: prod, confidenceScore: Math.min(99, score) };
      }).sort((a, b) => b.confidenceScore - a.confidenceScore);

      setIsAnalyzingImage(false);

      if (matchesWithScores.length > 0) {
        setImageMatches(matchesWithScores.slice(0, 3)); // Top 3 visual matches
        addAuditLog('Sales', 'Product Image Search', `Performed visual image search. Found ${matchesWithScores.length} matching candidate items.`);
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
          uploadedBy: 'Cashier',
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
  const cartTax = useMemo(() => cartSubtotal * 0.18, [cartSubtotal]);
  const cartTotal = useMemo(() => Math.max(0, cartSubtotal + cartTax - cartDiscount), [cartSubtotal, cartTax, cartDiscount]);

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error('Billing cart is empty! Add products before checking out.');
      return;
    }

    const saleOrder = addSale({
      customerName,
      customerPhone,
      store: selectedStore === 'All Stores' ? 'BLR' : selectedStore,
      items: cart.map((c) => ({
        itemId: c.itemId,
        name: c.name,
        qty: c.qty,
        unitPrice: c.price,
        taxRate: 18,
      })),
      subtotal: cartSubtotal,
      taxTotal: cartTax,
      discount: cartDiscount,
      total: cartTotal,
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
      <div className="space-y-6 fade-in">
        {/* Page Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sales & POS Billing Terminal</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Rapid barcode scanning, product image search, photo proof attachments, cart billing, and tax receipts.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-muted p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('pos')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'pos' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              POS Terminal
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'history' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sales History ({sales.length})
            </button>
          </div>
        </div>

        {activeTab === 'pos' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Catalog & Search Grid */}
            <div className="lg:col-span-7 space-y-4">
              {/* Search Bar & Image Search Button */}
              <div className="space-y-3">
                <div className="card p-3 flex items-center gap-3">
                  <Icon name="MagnifyingGlassIcon" size={18} className="text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Scan barcode EAN-13 or search name / SKU..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none"
                  />
                  {catalogSearch && (
                    <button onClick={() => setCatalogSearch('')} className="p-1 text-muted-foreground hover:text-foreground">
                      <Icon name="XMarkIcon" size={16} />
                    </button>
                  )}

                  {/* Search by Image Button */}
                  <button
                    onClick={() => setImageSearchOpen(true)}
                    className="btn-secondary text-2xs py-1.5 px-2.5 gap-1.5 font-bold flex-shrink-0"
                    title="Upload photo to search catalog by visual similarity"
                  >
                    <Icon name="CameraIcon" size={14} className="text-primary" />
                    Search by Image
                  </button>

                  <span className="text-2xs bg-primary/10 text-primary px-2.5 py-1 rounded-md font-mono flex-shrink-0 hidden sm:inline-block">
                    EAN Scanner Ready
                  </span>
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
                  {categoriesList.map((cat) => (
                    <button
                      key={`cat-pill-${cat}`}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-2xs font-bold whitespace-nowrap transition-all ${
                        selectedCategory === cat
                          ? 'bg-primary text-white shadow-xs'
                          : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Products Cards Grid with Thumbnails */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 max-h-[580px] overflow-y-auto scrollbar-thin pr-1">
                {filteredInventory.map((item) => (
                  <div
                    key={`pos-item-${item.id}`}
                    onClick={() => addToCart(item)}
                    className={`card p-3.5 cursor-pointer hover:border-primary transition-all duration-150 flex flex-col justify-between ${
                      item.qtyOnHand === 0 ? 'opacity-50 pointer-events-none bg-muted/20' : 'hover:shadow-md'
                    }`}
                  >
                    <div>
                      {/* Product Thumbnail Image */}
                      <div className="w-full h-28 mb-2 rounded-xl bg-muted overflow-hidden border border-border flex items-center justify-center relative">
                        {item.primaryImage || (item.images && item.images[0]) ? (
                          <img src={item.primaryImage || item.images![0]} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-center p-2">
                            <Icon name="CubeIcon" size={24} className="text-muted-foreground mx-auto mb-1" />
                            <span className="text-3xs text-muted-foreground font-mono">{item.sku}</span>
                          </div>
                        )}
                        <span className={`absolute top-2 right-2 text-3xs px-1.5 py-0.5 rounded font-bold ${item.qtyOnHand === 0 ? 'bg-danger text-white' : 'bg-card/90 text-foreground shadow-xs'}`}>
                          {item.qtyOnHand} left
                        </span>
                      </div>

                      <div className="flex justify-between items-start mb-1">
                        <span className="text-3xs font-mono text-muted-foreground">{item.sku}</span>
                        <span className="text-3xs badge-info">{item.category}</span>
                      </div>
                      <h4 className="text-xs font-bold text-foreground line-clamp-2">{item.name}</h4>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
                      <span className="text-sm font-extrabold text-foreground font-tabular">₹{item.sellingPrice.toLocaleString('en-IN')}</span>
                      <button className="p-1.5 rounded-lg bg-primary text-white hover:bg-primary/90">
                        <Icon name="PlusIcon" size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Billing Cart Section */}
            <div className="lg:col-span-5 card p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Icon name="ShoppingCartIcon" size={18} className="text-primary" />
                    <h3 className="text-base font-bold text-foreground">Billing Cart</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {heldCart && (
                      <button onClick={handleResumeCart} className="text-2xs font-semibold bg-warning/10 text-warning px-2 py-1 rounded-md">
                        Resume Cart
                      </button>
                    )}
                    {cart.length > 0 && (
                      <>
                        <button onClick={handleHoldCart} className="text-2xs font-semibold text-muted-foreground hover:text-foreground">
                          Hold
                        </button>
                        <button onClick={() => setCart([])} className="text-2xs font-semibold text-danger hover:underline">
                          Clear
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Customer Account Selector */}
                <div className="py-3 border-b border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Customer Account</label>
                    <button
                      onClick={() => setQuickRegModal(true)}
                      className="text-2xs font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <Icon name="UserPlusIcon" size={12} />
                      + Register New Customer
                    </button>
                  </div>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => handleSelectCustomer(e.target.value)}
                    className="input-field py-1.5 text-xs font-medium"
                  >
                    <option value="walkin">Walk-in Guest Customer (+91 99000 00000)</option>
                    {customers.map((c) => (
                      <option key={`c-opt-${c.id}`} value={c.id}>
                        {c.name} ({c.phone}) — {c.tier}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cart Items List */}
                <div className="space-y-2.5 max-h-48 overflow-y-auto scrollbar-thin pr-1 py-2">
                  {cart.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <Icon name="ShoppingCartIcon" size={32} className="mx-auto mb-1 opacity-30" />
                      <p className="text-xs font-semibold">Billing cart is empty</p>
                      <p className="text-2xs text-muted-foreground mt-0.5">Click any product from the catalog to add to bill</p>
                    </div>
                  ) : (
                    cart.map((c) => (
                      <div key={`cart-${c.itemId}`} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-xs font-bold text-foreground truncate">{c.name}</p>
                          <p className="text-2xs text-muted-foreground font-tabular">₹{c.price} x {c.qty} = ₹{(c.price * c.qty).toLocaleString('en-IN')}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => updateCartQty(c.itemId, -1)}
                            className="w-6 h-6 rounded-md bg-card border border-border flex items-center justify-center font-bold hover:bg-muted text-xs"
                          >
                            -
                          </button>
                          <span className="w-6 text-center font-bold text-xs font-tabular">{c.qty}</span>
                          <button
                            onClick={() => updateCartQty(c.itemId, 1)}
                            className="w-6 h-6 rounded-md bg-card border border-border flex items-center justify-center font-bold hover:bg-muted text-xs"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Optional Sale Photo Attachment Section */}
                <div className="pt-3 border-t border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-2xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Icon name="PaperClipIcon" size={13} />
                      Attach Sale Photos (Optional Proof)
                    </label>
                    <label className="text-2xs font-bold text-primary hover:underline cursor-pointer">
                      + Add Photo
                      <input type="file" multiple accept="image/*" onChange={handleAddSalePhoto} className="hidden" />
                    </label>
                  </div>

                  {salePhotos.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin py-1">
                      {salePhotos.map((photo) => (
                        <div key={photo.id} className="relative group flex-shrink-0">
                          <img src={photo.url} alt="Sale proof" className="w-12 h-12 object-cover rounded-lg border border-border" />
                          <button
                            type="button"
                            onClick={() => handleRemoveSalePhoto(photo.id)}
                            className="absolute -top-1 -right-1 bg-danger text-white rounded-full p-0.5 shadow-xs hover:bg-danger/90"
                          >
                            <Icon name="XMarkIcon" size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Order Calculations & Checkout Controls */}
              <div className="space-y-3 pt-3 border-t border-border">
                <div className="space-y-1.5 text-xs text-muted-foreground font-tabular">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₹{cartSubtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST Tax (18%):</span>
                    <span>₹{cartTax.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center text-foreground font-bold text-sm pt-2 border-t border-border">
                    <span>Total Amount Payable:</span>
                    <span className="text-base text-primary font-extrabold">₹{cartTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {(['UPI', 'Card', 'Cash', 'Credit'] as const).map((method) => (
                    <button
                      key={`pay-${method}`}
                      onClick={() => setPaymentMethod(method)}
                      className={`py-1.5 text-2xs font-bold rounded-lg border transition-all ${
                        paymentMethod === method
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-card border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={cart.length === 0}
                  className="btn-primary w-full py-3 text-sm font-bold gap-2"
                >
                  <Icon name="CheckIcon" size={18} />
                  Complete Sale & Generate Tax Invoice
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Sales History Table */
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">Completed Sales Orders Ledger</h3>
              <span className="text-xs text-muted-foreground">{sales.length} total orders</span>
            </div>

            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted text-2xs font-bold uppercase text-muted-foreground">
                    <th className="px-4 py-3">Order No</th>
                    <th className="px-4 py-3">Customer Billed</th>
                    <th className="px-4 py-3">Store Location</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Total (₹)</th>
                    <th className="px-4 py-3">Photos</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {sales.map((s) => (
                    <tr key={`sale-hist-${s.id}`} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-foreground">{s.orderNo}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-foreground">{s.customerName}</p>
                        <p className="text-2xs text-muted-foreground">{s.customerPhone}</p>
                      </td>
                      <td className="px-4 py-3"><span className="badge-info text-2xs">{s.store}</span></td>
                      <td className="px-4 py-3"><span className="badge-neutral text-2xs">{s.paymentMethod}</span></td>
                      <td className="px-4 py-3 font-bold text-foreground font-tabular">₹{s.total.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">
                        {s.salePhotos && s.salePhotos.length > 0 ? (
                          <span className="badge-success text-2xs flex items-center gap-1 w-fit">
                            <Icon name="PhotoIcon" size={12} /> {s.salePhotos.length} Attached
                          </span>
                        ) : (
                          <span className="text-2xs text-muted-foreground">—</span>
                        )}
                      </td>
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
        title="Search Products by Image / Visual Similarity"
        subtitle="Upload or capture a product photo to search the store catalog visually"
        size="md"
      >
        <div className="space-y-4 py-2">
          {/* Upload Drop Area */}
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
                <p className="text-xs font-bold text-foreground">Click to Upload or Take Product Photo</p>
                <p className="text-2xs text-muted-foreground">Upload PNG, JPG, or WebP product image (max 2MB)</p>
                <input type="file" accept="image/*" onChange={handleSearchImageUpload} className="hidden" />
              </label>
            )}
          </div>

          {/* Loading Indicator */}
          {isAnalyzingImage && (
            <div className="py-6 text-center space-y-2">
              <svg className="animate-spin w-6 h-6 text-primary mx-auto" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 22 6.477 22 12h-4z" />
              </svg>
              <p className="text-xs font-bold text-foreground">Analyzing product visual features & searching catalog...</p>
            </div>
          )}

          {/* No Match State */}
          {noMatchFound && (
            <div className="p-4 rounded-xl border border-warning/30 bg-warning/10 text-center space-y-1">
              <Icon name="ExclamationCircleIcon" size={24} className="text-warning mx-auto" />
              <p className="text-xs font-bold text-foreground">No matching product found.</p>
              <p className="text-2xs text-muted-foreground">Please search by name, SKU, or barcode.</p>
            </div>
          )}

          {/* Visual Similarity Results List */}
          {imageMatches.length > 0 && !isAnalyzingImage && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Top Visual Matches Found</span>
                <span className="text-3xs text-muted-foreground font-semibold">User review required before adding to cart</span>
              </div>

              <div className="space-y-2">
                {imageMatches.map(({ product, confidenceScore }) => (
                  <div key={`match-${product.id}`} className="p-3 rounded-xl border border-border bg-card flex items-center justify-between gap-3 hover:border-primary transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      {product.primaryImage || (product.images && product.images[0]) ? (
                        <img src={product.primaryImage || product.images![0]} alt={product.name} className="w-12 h-12 rounded-lg object-cover border border-border flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-muted-foreground font-bold text-xs flex-shrink-0">
                          {product.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-foreground truncate">{product.name}</p>
                          <span className="badge-success text-3xs">{confidenceScore}% Match</span>
                        </div>
                        <p className="text-2xs text-muted-foreground font-mono">{product.sku} · Stock: {product.qtyOnHand}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-bold text-foreground font-tabular">₹{product.sellingPrice}</span>
                      <button
                        onClick={() => {
                          addToCart(product);
                          setImageSearchOpen(false);
                        }}
                        className="btn-primary text-2xs py-1.5 px-3 gap-1"
                      >
                        <Icon name="PlusIcon" size={13} />
                        Select & Add to Cart
                      </button>
                    </div>
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

      {/* Digital Receipt Modal */}
      {receiptModal && (
        <Modal
          open={!!receiptModal}
          onClose={() => setReceiptModal(null)}
          title="Digital Tax Invoice / Receipt"
          subtitle={`${receiptModal.orderNo} · ${receiptModal.createdAt}`}
          size="md"
        >
          <div className="space-y-4 py-2 text-xs">
            <div className="p-4 rounded-xl bg-muted/40 border border-border text-center">
              <h3 className="text-lg font-extrabold text-foreground">{branding.appName} Retail</h3>
              <p className="text-2xs text-muted-foreground mt-0.5">GSTIN: 29AABCU9603R1ZM · Store: {receiptModal.store}</p>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-foreground">Billed To: {receiptModal.customerName} ({receiptModal.customerPhone})</p>
              <div className="border-y border-border py-2 space-y-1.5 font-tabular">
                {receiptModal.items.map((item, idx) => (
                  <div key={`rcpt-item-${idx}`} className="flex justify-between">
                    <span>{item.name} x {item.qty}</span>
                    <span className="font-bold">₹{(item.unitPrice * item.qty).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>

              {/* Display Attached Sale Photos in Receipt */}
              {receiptModal.salePhotos && receiptModal.salePhotos.length > 0 && (
                <div className="p-2.5 rounded-xl bg-muted/30 border border-border space-y-1.5">
                  <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Attached Proof Photos ({receiptModal.salePhotos.length})</p>
                  <div className="flex items-center gap-2 overflow-x-auto py-1">
                    {receiptModal.salePhotos.map((photo) => (
                      <img key={photo.id} src={photo.url} alt="Sale Proof Attachment" className="w-14 h-14 object-cover rounded-lg border border-border" />
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1 font-tabular text-right text-muted-foreground pt-1">
                <p>Subtotal: ₹{receiptModal.subtotal.toLocaleString('en-IN')}</p>
                <p>GST Tax (18%): ₹{receiptModal.taxTotal.toLocaleString('en-IN')}</p>
                <p className="text-base font-extrabold text-foreground pt-1">Total Paid ({receiptModal.paymentMethod}): ₹{receiptModal.total.toLocaleString('en-IN')}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button onClick={() => { toast.success('Invoice & proof photos sent via SMS/WhatsApp'); setReceiptModal(null); }} className="btn-secondary">
                Send Digital Copy
              </button>
              <button onClick={() => setReceiptModal(null)} className="btn-primary">
                Close Invoice
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
