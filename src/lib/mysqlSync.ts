/**
 * COSKO Enterprise System — MySQL & Prisma Synchronizer Service
 * Manages client-to-backend database operations and synchronization.
 * 
 * IMPORTANT: Every function makes a real API call to persist data in MySQL.
 * All mutations go through authenticated API routes that use Prisma ORM to write
 * directly to the authoritative production MySQL database.
 */

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  [key: string]: any;
}

async function apiCall<T = any>(url: string, method: string, body?: any): Promise<ApiResponse<T>> {
  try {
    let activeToken = '';
    let activeEmail = '';
    let activeRole = '';
    let activeStore = '';

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cosko_active_session');
        if (saved) {
          const parsed = JSON.parse(saved);
          activeEmail = parsed.email || '';
          activeRole = parsed.role || '';
          activeStore = parsed.store || '';
          activeToken = parsed.token || '';
        }
      } catch {}
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;
    if (activeEmail) headers['x-user-email'] = activeEmail;
    if (activeRole) headers['x-user-role'] = activeRole;
    if (activeStore) headers['x-user-store'] = activeStore;

    const options: RequestInit = {
      method,
      headers,
      credentials: 'include', // Send cookies for auth
    };

    if (body && method !== 'GET' && method !== 'DELETE') {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    const result = await res.json().catch(() => ({ error: res.statusText }));

    if (!res.ok) {
      console.error(`[MySQLDataService] ${method} ${url} failed (${res.status}):`, result);
      return {
        success: false,
        error: result.error || result.message || `Request failed with status ${res.status}`,
        ...result,
      };
    }

    return {
      success: result.success !== false,
      data: result,
      ...result,
    };
  } catch (err: any) {
    console.error(`[MySQLDataService] ${method} ${url} network error:`, err);
    return {
      success: false,
      error: err.message || 'Network connection failed. Check database and backend status.',
    };
  }
}

export const MySQLDataService = {
  getSystemHealth() {
    return {
      status: 'OK',
      mode: 'MySQL 8+ Enterprise Database with Prisma ORM',
      endpoint: 'Pooled MySQL Connection via API Routes',
    };
  },

  // ─── FETCH AUTHORITATIVE DATA ────────────────────────
  async fetchInventory(store?: string) {
    const url = store && store !== 'All Stores' ? `/api/inventory?store=${encodeURIComponent(store)}` : '/api/inventory';
    return apiCall(url, 'GET');
  },

  async fetchStores() {
    return apiCall('/api/stores', 'GET');
  },

  async fetchUsers() {
    return apiCall('/api/users', 'GET');
  },

  async fetchCategories() {
    return apiCall('/api/categories', 'GET');
  },

  async fetchCustomers(query?: string) {
    const url = query ? `/api/customers?query=${encodeURIComponent(query)}` : '/api/customers';
    return apiCall(url, 'GET');
  },

  async fetchVendors() {
    return apiCall('/api/vendors', 'GET');
  },

  async fetchExpenses(store?: string) {
    const url = store && store !== 'All Stores' ? `/api/expenses?store=${encodeURIComponent(store)}` : '/api/expenses';
    return apiCall(url, 'GET');
  },

  async fetchPurchases() {
    return apiCall('/api/purchases', 'GET');
  },

  async fetchSales(store?: string) {
    const url = store && store !== 'All Stores' ? `/api/sales?store=${encodeURIComponent(store)}` : '/api/sales';
    return apiCall(url, 'GET');
  },

  async fetchProduct(idOrSku: string) {
    return apiCall(`/api/inventory?id=${encodeURIComponent(idOrSku)}`, 'GET');
  },

  // ─── PRODUCTS / INVENTORY ────────────────────────────
  async createProduct(item: any) {
    return apiCall('/api/inventory', 'POST', {
      sku: item.sku,
      barcode: item.barcode,
      name: item.name,
      brand: item.brand,
      model: item.model,
      category: item.category,
      subcategory: item.subcategory,
      description: item.description,
      costPrice: item.costPrice,
      sellingPrice: item.sellingPrice,
      mrp: item.mrp,
      taxRate: item.taxRate,
      warrantyMonths: item.warrantyMonths,
      imageUrl: item.imageUrl || item.primaryImage || (Array.isArray(item.images) ? item.images[0] : null),
      status: item.status,
      store: item.store,
      qtyOnHand: item.qtyOnHand,
      reorderPt: item.reorderPt,
      minStock: item.minStock,
    });
  },

  async updateProduct(item: any) {
    return apiCall('/api/inventory', 'PUT', {
      id: item.id,
      productId: item.productId || item.id,
      sku: item.sku,
      name: item.name,
      barcode: item.barcode,
      brand: item.brand,
      model: item.model,
      category: item.category,
      subcategory: item.subcategory,
      description: item.description,
      costPrice: item.costPrice,
      sellingPrice: item.sellingPrice,
      mrp: item.mrp,
      taxRate: item.taxRate,
      warrantyMonths: item.warrantyMonths,
      imageUrl: item.imageUrl || item.primaryImage || (Array.isArray(item.images) ? item.images[0] : null),
      status: item.status,
      store: item.store,
      qtyOnHand: item.qtyOnHand,
      reorderPt: item.reorderPt,
      minStock: item.minStock,
    });
  },

  async deleteProduct(id: string, permanent = false) {
    return apiCall(`/api/inventory?id=${encodeURIComponent(id)}${permanent ? '&permanent=true' : ''}`, 'DELETE');
  },

  // ─── STORES ──────────────────────────────────────────
  async syncStore(store: any) {
    return apiCall('/api/stores', 'POST', {
      code: store.code,
      name: store.name,
      city: store.city,
      address: store.address,
      managerName: store.manager,
      phone: store.phone,
      registersCount: store.registers,
      status: store.status,
    });
  },

  async deleteStore(id: string, permanent = false) {
    return apiCall(`/api/stores?id=${encodeURIComponent(id)}${permanent ? '&permanent=true' : ''}`, 'DELETE');
  },

  // ─── USER PROFILES ───────────────────────────────────
  async createProfile(user: any) {
    return apiCall('/api/users/create', 'POST', {
      name: user.name,
      email: user.email,
      password: user.password || 'Cosko2026@',
      role: user.role,
      store: user.store,
      phone: user.phone,
      status: user.status || 'Active',
      securityLevel: user.securityLevel,
    });
  },

  async updateProfile(user: any) {
    return apiCall('/api/users/update', 'POST', {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      store: user.store,
      status: user.status,
      securityLevel: user.securityLevel,
      shiftStatus: user.shiftStatus,
    });
  },

  async deleteProfile(id: string, permanent = false) {
    return apiCall('/api/users/delete', 'POST', { id, permanent });
  },

  // ─── CUSTOMERS ───────────────────────────────────────
  async createCustomer(cust: any) {
    return apiCall('/api/customers', 'POST', {
      name: cust.name,
      phone: cust.phone,
      email: cust.email,
      city: cust.city,
      address: cust.address,
      totalSpend: cust.totalSpend || 0,
      creditBalance: cust.creditBalance || 0,
    });
  },

  async updateCustomer(cust: any) {
    return apiCall('/api/customers', 'PUT', {
      id: cust.id,
      name: cust.name,
      phone: cust.phone,
      email: cust.email,
      city: cust.city,
      address: cust.address,
      status: cust.status,
      creditBalance: cust.creditBalance,
    });
  },

  async deleteCustomer(id: string, permanent = false) {
    return apiCall(`/api/customers?id=${encodeURIComponent(id)}${permanent ? '&permanent=true' : ''}`, 'DELETE');
  },

  // ─── VENDORS ─────────────────────────────────────────
  async createVendor(vendor: any) {
    return apiCall('/api/vendors', 'POST', {
      code: vendor.code,
      name: vendor.name,
      contactPerson: vendor.contactPerson,
      email: vendor.email,
      phone: vendor.phone,
      city: vendor.city,
      address: vendor.address,
      categories: vendor.categories || vendor.category,
      gstin: vendor.gstin,
      paymentTerms: vendor.paymentTerms,
      status: vendor.status || 'Active',
    });
  },

  async updateVendor(vendor: any) {
    return apiCall('/api/vendors', 'PUT', {
      id: vendor.id,
      name: vendor.name,
      contactPerson: vendor.contactPerson,
      email: vendor.email,
      phone: vendor.phone,
      city: vendor.city,
      address: vendor.address,
      categories: vendor.categories || vendor.category,
      gstin: vendor.gstin,
      paymentTerms: vendor.paymentTerms,
      status: vendor.status,
    });
  },

  async deleteVendor(id: string, permanent = false) {
    return apiCall(`/api/vendors?id=${encodeURIComponent(id)}${permanent ? '&permanent=true' : ''}`, 'DELETE');
  },

  // ─── EXPENSES ────────────────────────────────────────
  async createExpense(expense: any) {
    return apiCall('/api/expenses', 'POST', {
      category: expense.category,
      amount: expense.amount,
      storeCode: expense.store || expense.storeCode,
      description: expense.description,
      paymentMethod: expense.paymentMethod,
      date: expense.date,
    });
  },

  async updateExpense(idOrExpense: string | any, updated?: any) {
    const payload = typeof idOrExpense === 'string' ? { id: idOrExpense, ...updated } : idOrExpense;
    return apiCall('/api/expenses', 'PUT', {
      id: payload.id,
      category: payload.category,
      amount: payload.amount,
      storeCode: payload.store || payload.storeCode,
      description: payload.description,
      paymentMethod: payload.paymentMethod,
      date: payload.date,
    });
  },

  async deleteExpense(id: string) {
    return apiCall(`/api/expenses?id=${encodeURIComponent(id)}`, 'DELETE');
  },

  // ─── REPAIRS & ENQUIRIES ─────────────────────────────
  async fetchRepairs(params?: { status?: string; search?: string; store?: string }) {
    const q = new URLSearchParams();
    if (params?.status && params.status !== 'All') q.append('status', params.status);
    if (params?.search) q.append('search', params.search);
    if (params?.store && params.store !== 'All Stores') q.append('store', params.store);
    const qs = q.toString();
    return apiCall(`/api/repairs${qs ? `?${qs}` : ''}`, 'GET');
  },

  async createRepair(repair: any) {
    return apiCall('/api/repairs', 'POST', {
      customerName: repair.customerName,
      customerPhone: repair.customerPhone,
      deviceType: repair.deviceType || 'Mobile',
      deviceName: repair.deviceName,
      issueDescription: repair.issueDescription,
      estimatedCost: repair.estimatedCost,
      status: repair.status || 'Pending Diagnosis',
      assignedTech: repair.assignedTech,
      technicianNotes: repair.technicianNotes,
      storeCode: repair.storeCode || repair.store || 'CENTRAL',
    });
  },

  async updateRepair(idOrRepair: string | any, updated?: any) {
    const payload = typeof idOrRepair === 'string' ? { id: idOrRepair, ...updated } : idOrRepair;
    return apiCall('/api/repairs', 'PUT', payload);
  },

  async deleteRepair(id: string) {
    return apiCall(`/api/repairs?id=${encodeURIComponent(id)}`, 'DELETE');
  },

  // ─── SALES & TRANSFERS ───────────────────────────────
  async createSale(sale: any) {
    return apiCall('/api/sales', 'POST', sale);
  },

  async updateSale(sale: any) {
    return apiCall('/api/sales', 'PUT', sale);
  },

  async deleteSale(id: string) {
    return apiCall(`/api/sales?id=${encodeURIComponent(id)}`, 'DELETE');
  },

  async createStockTransfer(transfer: any) {
    return apiCall('/api/transfers', 'POST', transfer);
  },

  // ─── PURCHASES ───────────────────────────────────────
  async createPurchase(po: any) {
    return apiCall('/api/purchases', 'POST', po);
  },

  async updatePurchase(po: any) {
    return apiCall('/api/purchases', 'PUT', po);
  },

  async deletePurchase(id: string) {
    return apiCall(`/api/purchases?id=${encodeURIComponent(id)}`, 'DELETE');
  },

  // ─── SETTINGS & BRANDING ─────────────────────────────
  async fetchBranding() {
    return apiCall('/api/settings', 'GET');
  },

  async updateBrandingSettings(branding: any) {
    return apiCall('/api/settings', 'POST', branding);
  },

  // ─── CATEGORIES ──────────────────────────────────────
  async createCategory(cat: any) {
    return apiCall('/api/categories', 'POST', {
      name: cat.name,
      parentCategoryId: cat.parentCategoryId,
      categoryType: cat.categoryType,
      description: cat.description,
      icon: cat.icon,
      imageUrl: cat.imageUrl,
      status: cat.status || 'Active',
      sortOrder: cat.sortOrder || 0,
    });
  },

  async updateCategory(cat: any) {
    return apiCall('/api/categories', 'PUT', {
      id: cat.id,
      name: cat.name,
      parentCategoryId: cat.parentCategoryId,
      categoryType: cat.categoryType,
      description: cat.description,
      icon: cat.icon,
      imageUrl: cat.imageUrl,
      status: cat.status,
      sortOrder: cat.sortOrder,
    });
  },

  async deleteCategory(id: string, permanent = false) {
    return apiCall(`/api/categories?id=${encodeURIComponent(id)}${permanent ? '&permanent=true' : ''}`, 'DELETE');
  },

  // Backward compatibility alias methods
  syncProduct(item: any) { return this.createProduct(item); },
  syncProfile(user: any) { return this.createProfile(user); },
  syncCustomer(cust: any) { return this.createCustomer(cust); },
  syncVendor(vendor: any) { return this.createVendor(vendor); },
  syncExpense(expense: any) { return this.createExpense(expense); },
  syncSale(sale: any) { return this.createSale(sale); },
  syncPurchase(po: any) { return this.createPurchase(po); },
  async syncAuditLog(log: any) {
    try {
      await fetch('/api/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          module: log.module,
          action: log.action,
          details: log.details,
          userEmail: log.userName,
          userRole: log.userRole,
          storeCode: log.storeCode || 'CENTRAL',
        }),
      });
    } catch (err) {
      console.warn('[AuditLog] Failed to persist audit log:', err);
    }
  },
};

export default MySQLDataService;
