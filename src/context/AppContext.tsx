'use client';
import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { MySQLDataService } from '@/lib/mysqlSync';

import { normalizeMobileNumber } from '@/lib/phoneUtils';
export { normalizeMobileNumber };

export interface AppBranding {
  appName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  tagline: string;
  supportEmail: string;
}

export interface InventoryItem {
  id: string;
  productId?: string;
  sku: string;
  barcode?: string;
  name: string;
  brand: string;
  model?: string;
  category: string;
  subcategory: string;
  store: string; // 'CENTRAL' | 'BLR' | 'HYD' | 'DEL' | 'MUM'
  qtyOnHand: number;
  reorderPt: number;
  costPrice: number;
  transferPrice: number;
  sellingPrice: number;
  mrp: number;
  hsn?: string;
  taxRate: number;
  warrantyMonths: number;
  minStock: number;
  status: 'active' | 'inactive' | 'discontinued';
  fifoLots: number;
  lastMovement: string;
  images?: string[];
  primaryImage?: string;
  imageUrl?: string;
}

export interface ProductStoreTransferPrice {
  id: string;
  productId: string;
  storeCode: string;
  defaultTransferPrice: number;
}

export interface StockTransferRecord {
  id: string;
  transferNo: string;
  sourceStore: string;
  destStore: string;
  productId: string;
  sku: string;
  productName: string;
  qty: number;
  purchaseCost: number;
  transferPrice: number;
  transferProfit: number;
  status: 'Completed' | 'Draft' | 'In Transit' | 'Cancelled';
  createdBy: string;
  createdAt: string;
}

export interface InventoryLedgerEntry {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  storeCode: string;
  movementType: 'PURCHASE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'SALE' | 'ADJUSTMENT' | 'RETURN';
  quantity: number;
  unitCost: number;
  totalValue: number;
  fromLocation?: string;
  toLocation?: string;
  referenceNo: string;
  createdBy: string;
  createdAt: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  parentCategoryId?: string | null;
  parentCategoryName?: string;
  categoryType: 'Product' | 'Service' | 'Spare Part' | 'Accessory' | 'Device' | 'EV' | 'Home Appliance';
  description?: string;
  imageUrl?: string;
  icon?: string;
  status: 'Active' | 'Inactive' | 'Archived';
  sortOrder: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RepairEnquiry {
  id: string;
  customerPhone: string;
  customerName: string;
  enquiryDate: string;
  deviceType?: 'Mobile' | 'Tablet' | 'Laptop' | 'Smartwatch' | 'EV' | 'AC' | 'TV' | 'Washing Machine' | 'Refrigerator' | 'Other';
  deviceName?: string;
  repairStatus: 'Received' | 'Diagnosing' | 'In Progress' | 'Ready for Delivery' | 'Delivered' | 'Cancelled';
  repairRequested: string;
  technicianNotes?: string;
  internalCost?: number;
  estimatedCost?: number;
  assignedTech?: string;
  storeCode?: string;
  warrantyStatus?: string;
  createdAt: string;
}

export interface SalePhoto {
  id: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
  purpose?: string;
}

export interface SalesOrder {
  id: string;
  orderNo: string;
  customerName: string;
  customerPhone: string;
  store: string;
  items: { itemId: string; name: string; qty: number; unitPrice: number; taxRate: number; sku?: string; warrantyMonths?: number; warrantyExpiryDate?: string }[];
  subtotal: number;
  taxTotal: number;
  discount: number;
  total: number;
  taxEnabled: boolean;
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Credit';
  status: 'Completed' | 'Refunded' | 'Pending';
  createdAt: string;
  period: 'Today' | 'Yesterday' | 'Last 7 Days' | 'This Month' | 'Last Month' | 'This Quarter' | 'This Year';
  salePhotos?: SalePhoto[];
  warrantyExpiryDate?: string;
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  vendorName: string;
  vendorId?: string;
  store: string;
  items: { name: string; qty: number; unitCost: number; sku?: string }[];
  totalAmount: number;
  status: 'Draft' | 'Sent' | 'Received' | 'Cancelled';
  paymentStatus: 'Paid' | 'Partial' | 'Unpaid';
  expectedDate: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  tier: 'VIP' | 'Regular' | 'New';
  totalSpend: number;
  creditBalance: number;
  lastPurchase: string;
}

export interface Vendor {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  category: string;
  city?: string;
  address?: string;
  outstandingPayable: number;
  rating: number;
  leadTimeDays: number;
}

export interface Expense {
  id: string;
  referenceNo: string;
  category: string;
  description: string;
  store: string;
  amount: number;
  paymentMethod: string;
  status: 'Approved' | 'Pending' | 'Rejected';
  date: string;
}

export interface StoreHub {
  id: string;
  code: string;
  name: string;
  city: string;
  address: string;
  manager: string;
  phone: string;
  registers: number;
  skusCount: number;
  monthlyRevenue: number;
  status: 'Active' | 'Inactive';
}

export interface UserPermissionOverride {
  permissionCode: string;
  overrideType: 'ALLOW' | 'DENY';
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  phone?: string;
  password?: string;
  role: 'Super Admin' | 'Store Manager' | 'POS Cashier' | 'Inventory Auditor' | 'Department Manager' | 'Accountant' | 'Procurement Staff' | 'Sales Executive' | 'Employee';
  securityLevel?: number;
  store: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  shiftStatus: 'On Shift' | 'On Leave';
  lastLogin: string;
  permissions: string[];
  overrides?: UserPermissionOverride[];
  allowedStores?: string[];
  avatarUrl?: string;
  mustChangePassword?: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  userRole: string;
  module: string;
  action: string;
  details: string;
  ipAddress: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'warning' | 'info' | 'success' | 'danger';
  read: boolean;
}

const defaultBranding: AppBranding = {
  appName: 'COSKO',
  logoUrl: null,
  faviconUrl: null,
  tagline: 'Multi-Store Enterprise Retail & POS System',
  supportEmail: 'support@cosko.com',
};

const initialStoreHubs: StoreHub[] = [
  { id: 'st-central', code: 'CENTRAL', name: 'COSKO Central Warehouse & Owner Stock', city: 'Bengaluru', address: 'Central Hub, Bengaluru', manager: 'Enterprise Owner', phone: '+91 80 2555 0000', registers: 0, skusCount: 2500, monthlyRevenue: 0, status: 'Active' },
  { id: 'st-blr', code: 'BLR', name: 'Bengaluru Central Hub', city: 'Bengaluru', address: 'Indiranagar 100ft Rd, Bengaluru', manager: 'Sneha Patel', phone: '+91 80 2555 1234', registers: 4, skusCount: 1420, monthlyRevenue: 1450000, status: 'Active' },
  { id: 'st-hyd', code: 'HYD', name: 'Hyderabad Warehouse & Outlet', city: 'Hyderabad', address: 'Hitech City Phase 2, Hyderabad', manager: 'Priya Sharma', phone: '+91 40 6677 8899', registers: 3, skusCount: 980, monthlyRevenue: 1120000, status: 'Active' },
  { id: 'st-del', code: 'DEL', name: 'Delhi NCR Fulfillment Center', city: 'Delhi', address: 'Okhla Industrial Area Ph-III, New Delhi', manager: 'Rohan Sharma', phone: '+91 11 4100 9988', registers: 5, skusCount: 2100, monthlyRevenue: 980000, status: 'Active' },
  { id: 'st-mum', code: 'MUM', name: 'Mumbai Commercial Hub', city: 'Mumbai', address: 'Bandra Kurla Complex, Mumbai', manager: 'Rakesh Verma', phone: '+91 22 6688 9900', registers: 4, skusCount: 1200, monthlyRevenue: 1350000, status: 'Active' },
];

export const initialCategories: CategoryItem[] = [];

const initialInventory: InventoryItem[] = [];

const initialStockTransfers: StockTransferRecord[] = [];

const initialInventoryLedger: InventoryLedgerEntry[] = [];

const initialRepairsEnquiries: RepairEnquiry[] = [];

const initialSales: SalesOrder[] = [];

const initialPurchases: PurchaseOrder[] = [];

const initialCustomers: Customer[] = [];

const initialVendors: Vendor[] = [];

const initialExpenses: Expense[] = [];

const initialUsers: UserAccount[] = [
  { id: 'usr-1', name: 'Super Admin', email: 'cosko@gmail.com', password: 'Cosko2026@', phone: '+91 98765 00000', role: 'Super Admin', securityLevel: 100, store: 'All Stores', allowedStores: ['CENTRAL', 'BLR', 'HYD', 'DEL', 'MUM'], status: 'Active', shiftStatus: 'On Shift', lastLogin: 'Just now', permissions: ['ALL_PERMISSIONS', 'super_admin.manage', 'roles.manage', 'permissions.manage', 'security.manage', 'audit_logs.enterprise_view', 'settings.global_manage'] },
];

const initialAuditLogs: AuditLog[] = [];

const initialNotifications: NotificationItem[] = [];

interface AppContextType {
  branding: AppBranding;
  updateBranding: (updated: Partial<AppBranding>) => void;
  resetBranding: () => void;
  selectedStore: string;
  setSelectedStore: (store: string) => void;
  datePeriod: string;
  setDatePeriod: (period: string) => void;
  authStatus: 'AUTH_LOADING' | 'AUTHENTICATED' | 'UNAUTHENTICATED';
  currentUser: { id: string; name: string; email: string; role: UserAccount['role']; store: string; allowedStores?: string[]; avatar: string; shiftStatus: 'On Shift' | 'On Leave'; avatarUrl?: string; mustChangePassword?: boolean };
  setCurrentUser: (user: any) => void;
  logoutUser: () => void;
  toggleCurrentUserShift: () => void;
  updateProfileAvatar: (avatarUrl: string | null) => void;
  storesList: StoreHub[];
  addStoreHub: (store: Omit<StoreHub, 'id'>) => Promise<any>;
  updateStoreHub: (id: string, updated: Partial<StoreHub>) => Promise<any>;
  deleteStoreHub: (id: string, permanent?: boolean) => Promise<{ success: boolean; mode?: string; message?: string }>;
  usersList: UserAccount[];
  addUserAccount: (user: Omit<UserAccount, 'id' | 'lastLogin' | 'permissions'>) => Promise<any>;
  updateUserAccount: (id: string, updated: Partial<UserAccount>) => Promise<any>;
  toggleUserShiftStatus: (id: string) => void;
  toggleUserStatus: (id: string, nextStatus: 'Active' | 'Inactive' | 'Suspended') => void;
  setUserPermissionOverride: (userId: string, permissionCode: string, overrideType: 'ALLOW' | 'DENY' | 'RESET') => void;
  toggleUserStoreAccess: (userId: string, storeCode: string) => void;
  deleteUserAccount: (id: string, permanent?: boolean) => Promise<{ success: boolean; mode?: string; message?: string }>;
  categoriesList: CategoryItem[];
  addCategory: (cat: Omit<CategoryItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<any>;
  updateCategory: (id: string, updated: Partial<CategoryItem>) => Promise<any>;
  toggleCategoryStatus: (id: string) => void;
  deleteCategory: (id: string, permanent?: boolean) => Promise<{ success: boolean; mode?: string; message?: string }>;
  changeUserPassword: (currentPass: string, newPass: string, confirmPass: string) => Promise<{ success: boolean; message: string }>;
  updateUserProfile: (name: string, phone?: string, avatarUrl?: string) => Promise<{ success: boolean; message: string }>;
  inventory: InventoryItem[];
  addItem: (item: Omit<InventoryItem, 'id'>) => Promise<any>;
  updateItem: (id: string, updated: Partial<InventoryItem>) => Promise<any>;
  deleteItem: (id: string, permanent?: boolean) => Promise<{ success: boolean; mode?: string; message?: string }>;
  adjustStock: (id: string, qtyChange: number, reason: string) => void;
  transferStock: (fromStore: string, toStore: string, itemId: string, qty: number, customTransferPrice?: number, status?: 'Completed' | 'Draft', notes?: string) => Promise<any>;
  updateTransferStatus: (id: string, nextStatus: 'Completed' | 'Cancelled') => void;
  defaultStoreTransferPrices: ProductStoreTransferPrice[];
  setDefaultStoreTransferPrice: (productId: string, storeCode: string, price: number) => void;
  stockTransfers: StockTransferRecord[];
  inventoryLedger: InventoryLedgerEntry[];
  repairsEnquiries: RepairEnquiry[];
  sales: SalesOrder[];
  addSale: (sale: Omit<SalesOrder, 'id' | 'orderNo' | 'createdAt' | 'period'>) => SalesOrder;
  purchases: PurchaseOrder[];
  addPurchase: (po: Omit<PurchaseOrder, 'id' | 'poNo' | 'createdAt'>) => Promise<any>;
  updatePurchase: (id: string, updated: Partial<PurchaseOrder>) => Promise<any>;
  deletePurchase: (id: string) => Promise<{ success: boolean; mode?: string; message?: string }>;
  customers: Customer[];
  addCustomer: (cust: Omit<Customer, 'id' | 'totalSpend' | 'lastPurchase'>) => Promise<any> | Customer;
  updateCustomer: (id: string, updated: Partial<Customer>) => Promise<any>;
  deleteCustomer: (id: string, permanent?: boolean) => Promise<{ success: boolean; mode?: string; message?: string }>;
  vendors: Vendor[];
  addVendor: (vendor: Omit<Vendor, 'id' | 'code'>) => Promise<any>;
  updateVendor: (id: string, updated: Partial<Vendor>) => Promise<any>;
  deleteVendor: (id: string, permanent?: boolean) => Promise<{ success: boolean; mode?: string; message?: string }>;
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id' | 'referenceNo' | 'date'>) => Promise<any>;
  deleteExpense: (id: string) => Promise<{ success: boolean; mode?: string; message?: string }>;
  auditLogs: AuditLog[];
  addAuditLog: (module: string, action: string, details: string) => void;
  refreshAllData: () => Promise<void>;
  notifications: NotificationItem[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  notificationsOpen: boolean;
  setNotificationsOpen: (open: boolean) => void;
  storeSelectorOpen: boolean;
  setStoreSelectorOpen: (open: boolean) => void;
  userProfileOpen: boolean;
  setUserProfileOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<AppBranding>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cosko_branding');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return defaultBranding;
  });

  // Cross-tab live synchronization for white-label branding updates
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cosko_branding' && e.newValue) {
        try {
          setBranding(JSON.parse(e.newValue));
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const [selectedStore, setSelectedStoreState] = useState<string>('All Stores');
  const [datePeriod, setDatePeriod] = useState<string>('This Month');
  const [usersList, setUsersList] = useState<UserAccount[]>(initialUsers);
  
  const [storesList, setStoresList] = useState<StoreHub[]>(initialStoreHubs);
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>(initialCategories);
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [stockTransfers, setStockTransfers] = useState<StockTransferRecord[]>(initialStockTransfers);
  const [inventoryLedger, setInventoryLedger] = useState<InventoryLedgerEntry[]>(initialInventoryLedger);
  const [repairsEnquiries, setRepairsEnquiries] = useState<RepairEnquiry[]>(initialRepairsEnquiries);
  const [sales, setSales] = useState<SalesOrder[]>(initialSales);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>(initialPurchases);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(initialAuditLogs);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [storeSelectorOpen, setStoreSelectorOpen] = useState(false);
  const [userProfileOpen, setUserProfileOpen] = useState(false);

  // Invoice Sequence Counter per Store
  const [invoiceCounters, setInvoiceCounters] = useState<Record<string, number>>({
    BLR: 12,
    HYD: 22,
    DEL: 32,
    MUM: 5,
    CENTRAL: 1,
  });

  const unauthenticatedUser = {
    id: '',
    name: 'Unauthenticated User',
    email: '',
    role: 'Employee' as const,
    store: '',
    avatar: 'UN',
    shiftStatus: 'On Leave' as const,
  };

  const [authStatus, setAuthStatus] = useState<'AUTH_LOADING' | 'AUTHENTICATED' | 'UNAUTHENTICATED'>('AUTH_LOADING');
  const [currentUser, setCurrentUserState] = useState<{ id: string; name: string; email: string; role: UserAccount['role']; store: string; allowedStores?: string[]; avatar: string; shiftStatus: 'On Shift' | 'On Leave'; avatarUrl?: string }>(unauthenticatedUser);

  // Restore active user session from server-authoritative /api/auth/me
  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      try {
        let token = '';
        if (typeof window !== 'undefined') {
          try {
            const saved = localStorage.getItem('cosko_active_session');
            if (saved) {
              const parsed = JSON.parse(saved);
              token = parsed.token || '';
            }
          } catch {}
        }

        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/auth/me', {
          credentials: 'include',
          headers,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user && isMounted) {
            const user = data.user;
            setCurrentUserState(user);
            setAuthStatus('AUTHENTICATED');
            if (user.role !== 'Super Admin') {
              const effectiveStore = (user.store && user.store !== 'All Stores') ? user.store : (user.allowedStores?.[0] || 'BLR');
              setSelectedStoreState(effectiveStore);
            }
            return;
          }
        }

        if (isMounted) {
          setCurrentUserState(unauthenticatedUser);
          setAuthStatus('UNAUTHENTICATED');
          setDataLoaded(true);
        }
      } catch (err) {
        console.warn('[COSKO] Session init check:', err);
        if (isMounted) {
          setCurrentUserState(unauthenticatedUser);
          setAuthStatus('UNAUTHENTICATED');
          setDataLoaded(true);
        }
      }
    };

    initAuth();
    return () => { isMounted = false; };
  }, []);

  // ─── LOAD ALL DATA FROM MySQL API ON MOUNT & REFRESH ─────────────────────
  // Authoritative persistence: fetch real data from MySQL database
  const refreshAllData = useCallback(async () => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      const opts: RequestInit = { credentials: 'include', headers };

      // Fetch all authoritative data in parallel
      const [
        storesRes, categoriesRes, inventoryRes, salesRes, purchasesRes,
        customersRes, vendorsRes, expensesRes, repairsRes, usersRes,
        transfersRes, ledgerRes
      ] = await Promise.allSettled([
        fetch('/api/stores', opts),
        fetch('/api/categories', opts),
        fetch('/api/inventory', opts),
        fetch('/api/sales', opts),
        fetch('/api/purchases', opts),
        fetch('/api/customers', opts),
        fetch('/api/vendors', opts),
        fetch('/api/expenses', opts),
        fetch('/api/repairs', opts),
        fetch('/api/users', opts),
        fetch('/api/transfers', opts),
        fetch('/api/inventory/ledger', opts),
      ]);

      const safeJson = async (result: PromiseSettledResult<Response>) => {
        if (result.status === 'fulfilled' && result.value.ok) {
          return await result.value.json();
        }
        return null;
      };

      const storesData = await safeJson(storesRes);
      if (storesData?.success && Array.isArray(storesData.stores)) {
        setStoresList(storesData.stores.map((s: any) => ({
          id: s.id, code: s.code, name: s.name, city: s.city,
          address: s.address, manager: s.managerName || '',
          phone: s.phone || '', registers: s.registersCount,
          skusCount: s.skusCount, monthlyRevenue: Number(s.monthlyRevenue) || 0,
          status: s.status,
        })));
      }

      const categoriesData = await safeJson(categoriesRes);
      if (categoriesData?.success && Array.isArray(categoriesData.categories)) {
        setCategoriesList(categoriesData.categories.map((c: any) => ({
          id: c.id, name: c.name, slug: c.slug,
          parentCategoryId: c.parentCategoryId || null,
          parentCategoryName: c.parent?.name,
          categoryType: c.categoryType || 'Product',
          description: c.description || '',
          icon: c.icon, imageUrl: c.imageUrl,
          status: c.status || 'Active',
          sortOrder: c.sortOrder || 0,
          createdAt: c.createdAt, updatedAt: c.updatedAt,
        })));
      }

      const inventoryData = await safeJson(inventoryRes);
      if (inventoryData?.success && Array.isArray(inventoryData.products)) {
        const items: InventoryItem[] = [];
        for (const p of inventoryData.products) {
          if (p.status === 'deleted' || p.status === 'archived') continue;
          if (p.inventoryItems && p.inventoryItems.length > 0) {
            for (const inv of p.inventoryItems) {
              items.push({
                id: inv.id || `${p.id}-${inv.storeCode}`,
                productId: p.id,
                sku: p.sku, barcode: p.barcode || '',
                name: p.name, brand: p.brand || '', model: p.model || '',
                category: p.category, subcategory: p.subcategory || '',
                store: inv.storeCode, qtyOnHand: inv.qtyOnHand,
                reorderPt: inv.reorderPt || 5,
                costPrice: Number(p.baseCostPrice),
                transferPrice: Math.round(Number(p.baseCostPrice) * 1.18),
                sellingPrice: Number(p.baseSellingPrice),
                mrp: Math.round(Number(p.baseSellingPrice) * 1.2),
                hsn: '', taxRate: Number(p.gstRate) || 18,
                warrantyMonths: p.warrantyMonths || 12,
                minStock: inv.reorderPt || 10,
                status: p.status as any,
                fifoLots: 1, lastMovement: 'Synced',
                imageUrl: p.imageUrl,
              });
            }
          } else {
            items.push({
              id: `${p.id}-CENTRAL`,
              productId: p.id,
              sku: p.sku, barcode: p.barcode || '',
              name: p.name, brand: p.brand || '', model: p.model || '',
              category: p.category, subcategory: p.subcategory || '',
              store: 'CENTRAL', qtyOnHand: 0, reorderPt: 5,
              costPrice: Number(p.baseCostPrice),
              transferPrice: Math.round(Number(p.baseCostPrice) * 1.18),
              sellingPrice: Number(p.baseSellingPrice),
              mrp: Math.round(Number(p.baseSellingPrice) * 1.2),
              hsn: '', taxRate: Number(p.gstRate) || 18,
              warrantyMonths: p.warrantyMonths || 12,
              minStock: 10, status: p.status as any,
              fifoLots: 0, lastMovement: 'Never',
              imageUrl: p.imageUrl,
            });
          }
        }
        setInventory(items);
      }

      const salesData = await safeJson(salesRes);
      if (salesData?.success && Array.isArray(salesData.sales)) {
        setSales(salesData.sales.map((s: any) => ({
          id: s.id, orderNo: s.orderNo,
          customerName: s.customerName, customerPhone: s.customerPhone,
          store: s.storeCode,
          items: s.items?.map((it: any) => ({
            itemId: it.productId, name: it.productName, sku: it.sku,
            qty: it.qty, unitPrice: Number(it.unitPrice), taxRate: 18,
          })) || [],
          subtotal: Number(s.subtotal), taxTotal: Number(s.taxAmount),
          discount: Number(s.discountAmount) || 0,
          total: Number(s.grandTotal), taxEnabled: true,
          paymentMethod: s.paymentMethod, status: s.status,
          createdAt: new Date(s.createdAt).toLocaleDateString('en-IN'),
          period: 'DB',
        })));
      }

      const purchasesData = await safeJson(purchasesRes);
      if (purchasesData?.success && Array.isArray(purchasesData.purchases)) {
        setPurchases(purchasesData.purchases.map((p: any) => ({
          id: p.id, poNo: p.poNo, vendorName: p.vendor?.name || 'Unknown',
          vendorId: p.vendorId,
          store: p.storeCode || 'CENTRAL',
          items: p.items?.map((it: any) => ({
            name: it.productName || 'Item', sku: it.sku || '',
            qty: it.qtyOrdered, unitCost: Number(it.unitCost),
          })) || [],
          totalAmount: Number(p.totalCost),
          status: p.status, paymentStatus: p.paymentStatus,
          createdAt: new Date(p.createdAt).toLocaleDateString('en-IN'),
          expectedDate: p.expectedDate ? new Date(p.expectedDate).toLocaleDateString('en-IN') : 'ASAP',
        })));
      }

      const customersData = await safeJson(customersRes);
      if (customersData?.success && Array.isArray(customersData.customers)) {
        setCustomers(customersData.customers.filter((c: any) => c.status !== 'Archived').map((c: any) => ({
          id: c.id, name: c.name, phone: c.phone,
          email: c.email || '', city: c.city || '',
          tier: Number(c.totalSpent) > 50000 ? 'VIP' : 'Regular',
          totalSpend: Number(c.totalSpent) || 0,
          creditBalance: Number(c.creditBalance) || 0,
          lastPurchase: c.updatedAt ? new Date(c.updatedAt).toLocaleDateString('en-IN') : 'Never',
        })));
      }

      const vendorsData = await safeJson(vendorsRes);
      if (vendorsData?.success && Array.isArray(vendorsData.vendors)) {
        setVendors(vendorsData.vendors.filter((v: any) => v.status !== 'Archived').map((v: any) => ({
          id: v.id, code: v.code, name: v.name,
          contactPerson: v.contactPerson, email: v.email,
          phone: v.phone, city: v.city, address: v.address || '',
          category: v.categories || 'General',
          outstandingPayable: 0, rating: 4.8, leadTimeDays: 3,
        })));
      }

      const expensesData = await safeJson(expensesRes);
      if (expensesData?.success && Array.isArray(expensesData.expenses)) {
        setExpenses(expensesData.expenses.map((e: any) => ({
          id: e.id, referenceNo: e.expenseNo,
          category: e.category, amount: Number(e.amount),
          store: e.storeCode, description: e.description,
          paymentMethod: e.paymentMethod, status: 'Approved',
          date: new Date(e.date).toLocaleDateString('en-IN'),
        })));
      }

      const usersData = await safeJson(usersRes);
      if (usersData?.success && Array.isArray(usersData.users)) {
        setUsersList(usersData.users.map((u: any) => ({
          id: u.id, name: u.name, email: u.email,
          role: u.role, securityLevel: u.securityLevel,
          store: u.store, allowedStores: u.assignedStores,
          status: u.status, shiftStatus: 'On Shift',
          lastLogin: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('en-IN') : 'Recent',
          permissions: u.role === 'Super Admin' ? ['ALL_PERMISSIONS'] : [],
        })));
      }

      const repairsData = await safeJson(repairsRes);
      if (repairsData?.success && Array.isArray(repairsData.repairs)) {
        setRepairsEnquiries(repairsData.repairs.map((r: any) => ({
          id: r.id, customerPhone: r.customerPhone,
          customerName: r.customerName, enquiryDate: new Date(r.createdAt).toLocaleDateString('en-IN'),
          deviceType: 'Mobile', deviceName: r.deviceName,
          repairStatus: r.status, repairRequested: r.issueDescription,
          estimatedCost: Number(r.estimatedCost),
          assignedTech: r.assignedTech || '',
          storeCode: 'BLR', createdAt: r.createdAt,
        })));
      }

      const transfersData = await safeJson(transfersRes);
      if (transfersData?.success && Array.isArray(transfersData.transfers)) {
        setStockTransfers(transfersData.transfers.map((t: any) => ({
          id: t.id,
          transferNo: t.transferNo,
          sourceStore: t.sourceStore,
          destStore: t.destStore,
          status: t.status,
          qty: t.totalUnits,
          totalUnits: t.totalUnits,
          transferPrice: Number(t.totalTransferValue) / (t.totalUnits || 1),
          purchaseCost: Number(t.totalCost) / (t.totalUnits || 1),
          totalCost: Number(t.totalCost),
          totalTransferValue: Number(t.totalTransferValue),
          grossProfit: Number(t.grossProfit),
          transferProfit: Number(t.grossProfit),
          notes: t.notes || '',
          productName: t.items?.[0]?.product?.name || 'Stock Item',
          sku: t.items?.[0]?.product?.sku || 'SKU',
          createdAt: t.createdAt,
          items: t.items || [],
        })));
      }

      const ledgerData = await safeJson(ledgerRes);
      if (ledgerData?.success && Array.isArray(ledgerData.ledger)) {
        setInventoryLedger(ledgerData.ledger.map((l: any) => ({
          id: l.id,
          productId: l.productId,
          productName: l.product?.name || 'Item',
          sku: l.product?.sku || '',
          storeCode: l.storeCode,
          movementType: l.type,
          qtyChange: l.qtyChange,
          costPerUnit: Number(l.costPerUnit),
          balanceAfter: l.balanceAfter,
          referenceNo: l.refNo,
          notes: l.notes || '',
          userEmail: l.createdBy || 'System',
          createdAt: l.createdAt,
        })));
      }

      setDataLoaded(true);
      console.log('[COSKO] Authoritative data loaded from MySQL database');
    } catch (err) {
      console.warn('[COSKO] Data loading error:', err);
      setDataLoaded(true);
    }
  }, []);

  // Load data immediately whenever user is authenticated
  useEffect(() => {
    if (authStatus === 'AUTHENTICATED') {
      refreshAllData();
    }
  }, [authStatus, refreshAllData]);

  // Multi-Device Synchronization: Window Focus, Visibility Change, Periodic Polling, and SSE
  useEffect(() => {
    if (typeof window === 'undefined' || authStatus !== 'AUTHENTICATED') return;

    // 1. Revalidate on window focus
    const handleFocus = () => {
      refreshAllData();
    };

    // 2. Revalidate on tab visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshAllData();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Periodic background sync (every 15s)
    const interval = setInterval(() => {
      refreshAllData();
    }, 15000);

    // 4. SSE Realtime Event Broadcaster
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/realtime');
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.channel) {
            // Re-fetch fresh database state immediately on any entity mutation
            refreshAllData();
            if (data.channel === 'sales' && data.payload?.grandTotal) {
              toast.info(`⚡ Live POS Sale Recorded on ${data.payload?.storeCode || 'Store'}: ₹${data.payload?.grandTotal}`);
            }
          }
        } catch {}
      };
    } catch (err) {
      console.warn('Realtime SSE setup error:', err);
    }

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
      if (eventSource) eventSource.close();
    };
  }, [authStatus, refreshAllData]);

  const setCurrentUser = (user: any) => {
    if (!user || !user.id) {
      logoutUser();
      return;
    }

    if (user.role !== 'Super Admin') {
      const effectiveStore = (user.store && user.store !== 'All Stores') ? user.store : (user.allowedStores?.[0] || 'BLR');
      user.store = effectiveStore;
      setSelectedStoreState(effectiveStore);
    }

    setCurrentUserState(user);
    setAuthStatus('AUTHENTICATED');

    try {
      localStorage.setItem('cosko_active_session', JSON.stringify({
        userId: user.id,
        email: user.email,
        role: user.role,
        store: user.store,
        token: user.token || '',
        timestamp: Date.now(),
      }));
    } catch {}

    refreshAllData();
  };

  const logoutUser = async () => {
    try {
      localStorage.removeItem('cosko_active_session');
      if (typeof window !== 'undefined') {
        await fetch('/api/auth/logout', { method: 'POST' });
      }
    } catch {}
    setCurrentUserState(unauthenticatedUser);
    setAuthStatus('UNAUTHENTICATED');
    setSelectedStoreState('All Stores');
  };

  const updateBranding = (updatedPartial: Partial<AppBranding>) => {
    setBranding((prev) => {
      const updated = { ...prev, ...updatedPartial };
      try {
        const jsonStr = JSON.stringify(updated);
        localStorage.setItem('cosko_branding', jsonStr);
        window.dispatchEvent(new StorageEvent('storage', { key: 'cosko_branding', newValue: jsonStr }));
      } catch {}
      return updated;
    });

    addAuditLog('Settings', 'Update White-Label Branding', `Updated app branding logo & details`);
    toast.success('Application branding updated successfully across the entire system!');
  };

  const resetBranding = () => {
    setBranding(defaultBranding);
    try {
      localStorage.removeItem('cosko_branding');
    } catch {}
    addAuditLog('Settings', 'Reset Branding', 'Reset white-label branding to system default');
    toast.info('Application branding reset to defaults');
  };

  const toggleCurrentUserShift = () => {
    if (authStatus !== 'AUTHENTICATED') return;
    const nextStatus = currentUser.shiftStatus === 'On Shift' ? 'On Leave' : 'On Shift';
    setCurrentUserState((prev) => ({ ...prev, shiftStatus: nextStatus }));
    setUsersList((prev) => prev.map((u) => (u.id === currentUser.id ? { ...u, shiftStatus: nextStatus } : u)));
    addAuditLog('Employees', 'Toggle Shift Status', `Changed shift status to ${nextStatus}`);
    toast.success(`You are now ${nextStatus}`);
  };

  const updateProfileAvatar = (avatarUrl: string | null) => {
    if (authStatus !== 'AUTHENTICATED') return;
    setCurrentUserState((prev) => ({ ...prev, avatarUrl: avatarUrl || undefined }));
    setUsersList((prev) => prev.map((u) => (u.id === currentUser.id ? { ...u, avatarUrl: avatarUrl || undefined } : u)));
    toast.success('Profile avatar updated');
  };

  const setSelectedStore = (store: string) => {
    if (currentUser.role !== 'Super Admin' && authStatus === 'AUTHENTICATED') {
      const assignedStore = (currentUser.store && currentUser.store !== 'All Stores') ? currentUser.store : 'BLR';
      if (store !== assignedStore) {
        toast.warning(`Store Access Locked: You are restricted to ${assignedStore}`);
        setSelectedStoreState(assignedStore);
        return;
      }
    }
    setSelectedStoreState(store);
  };

  const addStoreHub = async (storeData: Omit<StoreHub, 'id'>) => {
    try {
      const res = await MySQLDataService.syncStore(storeData);
      if (res?.success && res.store) {
        const newStore: StoreHub = {
          id: res.store.id,
          code: res.store.code,
          name: res.store.name,
          city: res.store.city,
          address: res.store.address,
          manager: res.store.managerName || '',
          phone: res.store.phone || '',
          registers: res.store.registersCount || 2,
          skusCount: 0,
          monthlyRevenue: 0,
          status: res.store.status,
        };
        setStoresList((prev) => [newStore, ...prev.filter(s => s.id !== newStore.id && s.code !== newStore.code)]);
        addAuditLog('Stores', 'Create Store Hub', `Created store hub "${newStore.name}" (${newStore.code})`);
        toast.success(`Store Hub "${newStore.name}" (${newStore.code}) saved to MySQL!`);
        refreshAllData();
        return { success: true, store: newStore };
      } else {
        toast.error(res?.error || 'Failed to save store hub');
        return { success: false, error: res?.error };
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving store');
      return { success: false, error: err.message };
    }
  };

  const updateStoreHub = async (id: string, updated: Partial<StoreHub>) => {
    const target = storesList.find((s) => s.id === id || s.code === id);
    if (!target) return;
    const merged = { ...target, ...updated };
    setStoresList((prev) => prev.map((s) => (s.id === id || s.code === id ? merged : s)));
    const res = await MySQLDataService.syncStore(merged);
    if (res?.success) {
      addAuditLog('Stores', 'Edit Store Hub', `Updated store #${id}`);
      toast.success('Store details updated in MySQL');
      refreshAllData();
    } else {
      toast.error(res?.error || 'Failed to update store');
    }
  };

  const deleteStoreHub = async (id: string, permanent = false) => {
    const s = storesList.find((st) => st.id === id || st.code === id || st.code.toUpperCase() === id.toUpperCase());
    const lookupId = s ? s.code : id;
    try {
      const res = await MySQLDataService.deleteStore(lookupId, permanent);
      if (res?.success) {
        setStoresList((prev) => prev.filter((st) => st.id !== id && st.code !== id && (s ? st.id !== s.id && st.code !== s.code : true)));
        if (selectedStore === (s?.code || id)) {
          setSelectedStoreState('All Stores');
        }
        if (s) {
          addAuditLog('Stores', res.mode === 'archived' ? 'Deactivate Store Hub' : 'Delete Store Hub', `${res.message || `Removed store "${s.name}"`}`);
        }
        toast.success(res.message || `Removed store "${s?.name || id}"`);
        refreshAllData();
        return { success: true, mode: res.mode, message: res.message };
      } else {
        toast.error(res?.error || res?.message || 'Failed to remove store hub');
        return { success: false, message: res?.error || res?.message };
      }
    } catch (err: any) {
      toast.error('Network error while deleting store');
      return { success: false, message: err.message };
    }
  };

  const addUserAccount = async (userData: Omit<UserAccount, 'id' | 'lastLogin' | 'permissions'>) => {
    try {
      const res = await MySQLDataService.createProfile(userData);
      if (res?.success && res.user) {
        const newAccount: UserAccount = {
          id: res.user.id,
          name: res.user.name,
          email: res.user.email,
          role: res.user.role,
          securityLevel: res.user.securityLevel,
          store: res.user.store,
          allowedStores: res.user.assignedStores || [res.user.store],
          status: res.user.status,
          shiftStatus: 'On Shift',
          lastLogin: 'Never',
          permissions: res.user.role === 'Super Admin' ? ['ALL_PERMISSIONS'] : [],
        };
        setUsersList((prev) => [newAccount, ...prev.filter(u => u.id !== newAccount.id && u.email !== newAccount.email)]);
        addAuditLog('Users & Roles', 'Provision User', `Provisioned account for ${newAccount.name} (${newAccount.role})`);
        toast.success(`User "${newAccount.name}" created & persisted to MySQL!`);
        refreshAllData();
        return { success: true, user: newAccount };
      } else {
        toast.error(res?.error || 'Failed to create user');
        return { success: false, error: res?.error };
      }
    } catch (err: any) {
      toast.error(err.message || 'Error creating user');
      return { success: false, error: err.message };
    }
  };

  const updateUserAccount = async (id: string, updated: Partial<UserAccount>) => {
    const updatedUser = usersList.find((u) => u.id === id);
    if (!updatedUser) return;
    const merged = { ...updatedUser, ...updated };
    setUsersList((prev) => prev.map((u) => (u.id === id ? merged : u)));
    const res = await MySQLDataService.createProfile(merged);
    if (res?.success) {
      addAuditLog('Users & Roles', 'Edit User Profile', `Updated user profile #${id}`);
      toast.success('User record updated in MySQL');
      refreshAllData();
    }
  };

  const toggleUserShiftStatus = (id: string) => {
    setUsersList((prev) =>
      prev.map((u) => {
        if (u.id === id) {
          const nextShift = u.shiftStatus === 'On Shift' ? 'On Leave' : 'On Shift';
          const updatedUser = { ...u, shiftStatus: nextShift as any };
          MySQLDataService.createProfile(updatedUser);
          return updatedUser;
        }
        return u;
      })
    );
    toast.success('Shift status toggled');
  };

  const toggleUserStatus = (id: string, nextStatus: 'Active' | 'Inactive' | 'Suspended') => {
    setUsersList((prev) =>
      prev.map((u) => {
        if (u.id === id) {
          const updatedUser = { ...u, status: nextStatus };
          MySQLDataService.createProfile(updatedUser);
          return updatedUser;
        }
        return u;
      })
    );
    addAuditLog('Users & Roles', 'Change Account Status', `Set account #${id} status to ${nextStatus}`);
    toast.success(`Account status changed to ${nextStatus}`);
  };

  const setUserPermissionOverride = (userId: string, permissionCode: string, overrideType: 'ALLOW' | 'DENY' | 'RESET') => {
    setUsersList((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const currentOverrides = u.overrides || [];
          let updatedOverrides: UserPermissionOverride[];
          if (overrideType === 'RESET') {
            updatedOverrides = currentOverrides.filter((o) => o.permissionCode !== permissionCode);
          } else {
            updatedOverrides = [
              ...currentOverrides.filter((o) => o.permissionCode !== permissionCode),
              { permissionCode, overrideType },
            ];
          }
          return { ...u, overrides: updatedOverrides };
        }
        return u;
      })
    );
    toast.success(`Permission ${permissionCode} override updated`);
  };

  const toggleUserStoreAccess = (userId: string, storeCode: string) => {
    setUsersList((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const allowed = u.allowedStores || [u.store];
          const hasAccess = allowed.includes(storeCode);
          const nextAllowed = hasAccess ? allowed.filter((s) => s !== storeCode) : [...allowed, storeCode];
          return { ...u, allowedStores: nextAllowed.length > 0 ? nextAllowed : [u.store] };
        }
        return u;
      })
    );
    toast.success(`Updated store scope access for ${storeCode}`);
  };

  const deleteUserAccount = async (id: string, permanent = false) => {
    const u = usersList.find((usr) => usr.id === id);
    try {
      const res = await MySQLDataService.deleteProfile(id, permanent);
      if (res?.success) {
        setUsersList((prev) => prev.filter((usr) => usr.id !== id));
        if (u) {
          addAuditLog('Users & Roles', res.mode === 'archived' ? 'Deactivate User Account' : 'Delete User Account', res.message || `Removed account "${u.name}"`);
        }
        toast.success(res.message || `Removed account "${u?.name || id}"`);
        refreshAllData();
        return { success: true, mode: res.mode, message: res.message };
      } else {
        toast.error(res?.error || res?.message || 'Failed to delete user account');
        return { success: false, message: res?.error || res?.message };
      }
    } catch (err: any) {
      toast.error('Network error while deleting user');
      return { success: false, message: err.message };
    }
  };

  const addCategory = async (catData: Omit<CategoryItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const res = await MySQLDataService.createCategory(catData);
      if (res?.success && res.category) {
        const c = res.category;
        const newCat: CategoryItem = {
          id: c.id,
          name: c.name,
          slug: c.slug,
          parentCategoryId: c.parentCategoryId,
          categoryType: c.categoryType || 'Product',
          description: c.description || '',
          icon: c.icon,
          imageUrl: c.imageUrl,
          status: c.status || 'Active',
          sortOrder: c.sortOrder || 0,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };
        setCategoriesList((prev) => [...prev.filter(cat => cat.id !== newCat.id), newCat]);
        addAuditLog('Categories', 'Create Category', `Created category "${newCat.name}" (${newCat.categoryType})`);
        toast.success(`Category "${newCat.name}" saved to MySQL!`);
        refreshAllData();
        return { success: true, category: newCat };
      } else {
        toast.error(res?.error || 'Failed to save category');
        return { success: false, error: res?.error };
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving category');
      return { success: false, error: err.message };
    }
  };

  const updateCategory = async (id: string, updated: Partial<CategoryItem>) => {
    setCategoriesList((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const parent = updated.parentCategoryId !== undefined
            ? (updated.parentCategoryId ? prev.find((p) => p.id === updated.parentCategoryId)?.name : undefined)
            : c.parentCategoryName;
          const updatedCat = { ...c, ...updated, parentCategoryName: parent, updatedAt: new Date().toISOString() };
          return updatedCat;
        }
        return c;
      })
    );

    const res = await MySQLDataService.updateCategory({ id, ...updated });
    if (res?.success) {
      addAuditLog('Categories', 'Update Category', `Updated category #${id}`);
      toast.success('Category updated successfully');
      refreshAllData();
    } else {
      toast.error(res?.error || 'Failed to update category');
    }
  };

  const toggleCategoryStatus = (id: string) => {
    setCategoriesList((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const nextStatus: 'Active' | 'Inactive' = c.status === 'Active' ? 'Inactive' : 'Active';
          const updated = { ...c, status: nextStatus, updatedAt: new Date().toISOString() };
          MySQLDataService.updateCategory({ id: c.id, status: nextStatus });
          addAuditLog('Categories', 'Toggle Category Status', `Changed category "${c.name}" status to ${nextStatus}`);
          toast.success(`Category "${c.name}" is now ${nextStatus}`);
          return updated;
        }
        return c;
      })
    );
  };

  const deleteCategory = async (id: string, permanent = false) => {
    const target = categoriesList.find((c) => c.id === id || c.slug === id);
    try {
      const res = await MySQLDataService.deleteCategory(id, permanent);
      if (res?.success) {
        setCategoriesList((prev) => prev.filter((c) => c.id !== id && c.slug !== id));
        if (target) {
          addAuditLog('Categories', res?.mode === 'archived' ? 'Archive Category' : 'Delete Category', res?.message || `Removed category "${target.name}"`);
        }
        toast.success(res?.message || `Category "${target?.name || id}" removed`);
        refreshAllData();
        return { success: true, mode: res?.mode || 'deleted', message: res?.message };
      } else {
        toast.error(res?.error || res?.message || 'Failed to remove category');
        return { success: false, message: res?.error || res?.message };
      }
    } catch (err: any) {
      toast.error(err.message || 'Error removing category');
      return { success: false, message: err.message };
    }
  };

  const changeUserPassword = async (currentPass: string, newPass: string, confirmPass: string) => {
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass, confirmPassword: confirmPass }),
      });
      const data = await res.json();
      if (data.success) {
        addAuditLog('Authentication', 'Change Password', `Password successfully updated for ${currentUser.email}`);
        toast.success(data.message || 'Password changed successfully!');
        return { success: true, message: data.message };
      } else {
        toast.error(data.message || 'Failed to change password');
        return { success: false, message: data.message };
      }
    } catch (err: any) {
      toast.error('Network error during password update');
      return { success: false, message: err.message };
    }
  };

  const updateUserProfile = async (name: string, phone?: string, avatarUrl?: string) => {
    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, avatarUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUserState((prev) => ({
          ...prev,
          name: data.user.name,
          avatarUrl: data.user.avatarUrl,
        }));
        setUsersList((prev) =>
          prev.map((u) => (u.id === currentUser.id ? { ...u, name: data.user.name, avatarUrl: data.user.avatarUrl, phone: phone || u.phone } : u))
        );
        addAuditLog('Authentication', 'Update Profile', `Profile details updated for ${currentUser.email}`);
        toast.success('Profile details updated!');
        return { success: true, message: 'Profile updated successfully' };
      } else {
        toast.error(data.message || 'Failed to update profile');
        return { success: false, message: data.message };
      }
    } catch (err: any) {
      toast.error('Network error during profile update');
      return { success: false, message: err.message };
    }
  };

  const addItem = async (itemData: Omit<InventoryItem, 'id'>) => {
    // Check barcode duplicate
    if (itemData.barcode && itemData.barcode.trim()) {
      const cleanBarcode = itemData.barcode.trim();
      const duplicate = inventory.find((i) => i.barcode === cleanBarcode);
      if (duplicate) {
        toast.error(`Barcode "${cleanBarcode}" is already assigned to "${duplicate.name}" (${duplicate.sku})!`);
        return { success: false, error: 'Duplicate barcode' };
      }
    }

    try {
      const res = await MySQLDataService.createProduct(itemData);
      if (res?.success && res.product) {
        const p = res.product;
        const newItem: InventoryItem = {
          id: p.id,
          sku: p.sku,
          barcode: p.barcode || '',
          name: p.name,
          brand: p.brand || '',
          model: p.model || '',
          category: p.category,
          subcategory: p.subcategory || '',
          store: itemData.store || 'CENTRAL',
          qtyOnHand: itemData.qtyOnHand || 0,
          reorderPt: itemData.reorderPt || 5,
          costPrice: Number(p.baseCostPrice),
          transferPrice: Math.round(Number(p.baseCostPrice) * 1.18),
          sellingPrice: Number(p.baseSellingPrice),
          mrp: Math.round(Number(p.baseSellingPrice) * 1.2),
          taxRate: Number(p.gstRate) || 18,
          warrantyMonths: p.warrantyMonths || 12,
          minStock: itemData.minStock || 10,
          status: p.status as any,
          fifoLots: 1,
          lastMovement: 'Created',
          imageUrl: p.imageUrl,
        };
        setInventory((prev) => [newItem, ...prev.filter(i => i.id !== newItem.id)]);
        addAuditLog('Inventory', 'Add Product', `Created new item "${newItem.name}" (${newItem.sku})`);
        toast.success(`Successfully saved "${newItem.name}" to MySQL inventory`);
        refreshAllData();
        return { success: true, item: newItem };
      } else {
        toast.error(res?.error || 'Failed to save product to database');
        return { success: false, error: res?.error };
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving product');
      return { success: false, error: err.message };
    }
  };

  const updateItem = async (id: string, updated: Partial<InventoryItem>) => {
    // Check barcode duplicate
    if (updated.barcode && updated.barcode.trim()) {
      const cleanBarcode = updated.barcode.trim();
      const duplicate = inventory.find((i) => i.id !== id && i.barcode === cleanBarcode);
      if (duplicate) {
        toast.error(`Barcode "${cleanBarcode}" is already assigned to "${duplicate.name}" (${duplicate.sku})!`);
        return;
      }
    }

    setInventory((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newItem = { ...item, ...updated };
          return newItem;
        }
        return item;
      })
    );

    const res = await MySQLDataService.updateProduct({ id, ...updated });
    if (res?.success) {
      addAuditLog('Inventory', 'Edit Product', `Updated details for item #${id}`);
      toast.success('Inventory item updated in MySQL');
      refreshAllData();
    } else {
      toast.error(res?.error || 'Failed to update item in database');
    }
  };

  const deleteItem = async (id: string, permanent = false) => {
    const itemToDelete = inventory.find((i) => i.id === id || i.sku === id);
    try {
      const res = await MySQLDataService.deleteProduct(id, permanent);
      if (res?.success) {
        setInventory((prev) => prev.filter((i) => i.id !== id && i.sku !== id));
        if (itemToDelete) {
          addAuditLog('Inventory', res?.mode === 'archived' ? 'Archive Product' : 'Delete Product', res?.message || `Removed item "${itemToDelete.name}" (${itemToDelete.sku})`);
        }
        toast.success(res?.message || `Removed "${itemToDelete?.name || id}" from inventory`);
        refreshAllData();
        return { success: true, mode: res?.mode || 'deleted', message: res?.message };
      } else {
        toast.error(res?.error || res?.message || 'Failed to remove inventory item');
        return { success: false, message: res?.error || res?.message };
      }
    } catch (err: any) {
      toast.error(err.message || 'Error removing item');
      return { success: false, message: err.message };
    }
  };

  const adjustStock = (id: string, qtyChange: number, reason: string) => {
    const itemToAdjust = inventory.find((i) => i.id === id);
    if (!itemToAdjust) return;

    setInventory((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(0, item.qtyOnHand + qtyChange);
          const newItem = { ...item, qtyOnHand: newQty, lastMovement: 'Today' };
          MySQLDataService.createProduct(newItem);
          return newItem;
        }
        return item;
      })
    );

    // Record in movement ledger
    const ledgerEntry: InventoryLedgerEntry = {
      id: `led-${Date.now()}`,
      productId: itemToAdjust.id,
      sku: itemToAdjust.sku,
      productName: itemToAdjust.name,
      storeCode: itemToAdjust.store,
      movementType: 'ADJUSTMENT',
      quantity: qtyChange,
      unitCost: itemToAdjust.costPrice,
      totalValue: Math.abs(qtyChange) * itemToAdjust.costPrice,
      fromLocation: itemToAdjust.store,
      toLocation: itemToAdjust.store,
      referenceNo: `ADJ-${Date.now().toString().slice(-6)}`,
      createdBy: currentUser.name || 'Admin',
      createdAt: new Date().toISOString(),
    };
    setInventoryLedger((prev) => [ledgerEntry, ...prev]);

    addAuditLog('Inventory', 'Stock Adjustment', `Adjusted stock for "${itemToAdjust.name}" by ${qtyChange > 0 ? '+' : ''}${qtyChange} units. Reason: ${reason}`);
    toast.success(`Stock adjusted successfully`);
  };

  const [defaultStoreTransferPrices, setDefaultStoreTransferPrices] = useState<ProductStoreTransferPrice[]>([
    { id: 'stp-1', productId: 'item-001', storeCode: 'MUM', defaultTransferPrice: 420 },
    { id: 'stp-2', productId: 'item-001', storeCode: 'DEL', defaultTransferPrice: 390 },
    { id: 'stp-3', productId: 'item-001', storeCode: 'BLR', defaultTransferPrice: 400 },
  ]);

  const setDefaultStoreTransferPrice = (productId: string, storeCode: string, price: number) => {
    setDefaultStoreTransferPrices((prev) => {
      const idx = prev.findIndex((p) => p.productId === productId && p.storeCode === storeCode);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], defaultTransferPrice: price };
        return updated;
      }
      return [...prev, { id: `stp-${Date.now()}`, productId, storeCode, defaultTransferPrice: price }];
    });
    addAuditLog('Inventory', 'Set Default Store Transfer Price', `Updated transfer price for product #${productId} at store ${storeCode} to ₹${price}`);
    toast.success(`Default transfer price set to ₹${price} for ${storeCode}`);
  };

  const transferStock = async (
    fromStore: string,
    toStore: string,
    itemId: string,
    qty: number,
    customTransferPrice?: number,
    status: 'Completed' | 'Draft' = 'Completed',
    notes?: string
  ) => {
    try {
      if (fromStore === toStore) {
        toast.error('Source store and destination store cannot be identical');
        return { success: false, error: 'Source and destination stores cannot be identical' };
      }

      // Find the item matching the product AND the source store
      const sourceItem =
        inventory.find(
          (i) => (i.id === itemId || i.sku === itemId || i.productId === itemId) && i.store === fromStore
        ) ||
        inventory.find((i) => i.id === itemId || i.sku === itemId || i.productId === itemId);

      if (!sourceItem) {
        toast.error(`Source product not found in ${fromStore}!`);
        return { success: false, error: 'Source item not found' };
      }

      if (sourceItem.qtyOnHand < qty) {
        toast.error(`Insufficient stock in ${fromStore} (${sourceItem.qtyOnHand} units available, requested ${qty})`);
        return { success: false, error: 'Insufficient stock' };
      }

      const unitCost = sourceItem.costPrice;
      const transferPrice =
        customTransferPrice !== undefined ? customTransferPrice : (sourceItem.transferPrice || Math.round(sourceItem.costPrice * 1.18));

      const realProductId = sourceItem.productId || (sourceItem.id.includes('-') ? sourceItem.id.split('-')[0] : sourceItem.id);

      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sourceStore: fromStore,
          destStore: toStore,
          notes: notes || `Transfer from ${fromStore} to ${toStore}`,
          items: [
            {
              productId: realProductId,
              qty,
              costPerUnit: unitCost,
              transferPricePerUnit: transferPrice,
            },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Transfer failed');
      }

      toast.success(`Transferred ${qty} units from ${fromStore} to ${toStore} (${data.transfer.transferNo})`);
      await refreshAllData();
      return { success: true, transfer: data.transfer };
    } catch (err: any) {
      console.error('[COSKO] transferStock error:', err);
      toast.error(err.message || 'Failed to complete stock transfer');
      return { success: false, error: err.message };
    }
  };

  const updateTransferStatus = (id: string, nextStatus: 'Completed' | 'Cancelled') => {
    const target = stockTransfers.find((t) => t.id === id);
    if (!target) return;

    if (target.status === 'Completed' && nextStatus === 'Cancelled') {
      toast.warning('Completed transfers cannot be directly cancelled. Corrective transfer required.');
      return;
    }

    if (target.status === 'Draft' && nextStatus === 'Completed') {
      const sourceItem = inventory.find((i) => i.id === target.productId || i.sku === target.sku);
      if (!sourceItem || sourceItem.qtyOnHand < target.qty) {
        toast.error(`Insufficient stock to complete transfer (${sourceItem?.qtyOnHand || 0} units available)`);
        return;
      }

      setInventory((prev) =>
        prev.map((item) => {
          if (item.id === sourceItem.id) {
            return { ...item, qtyOnHand: item.qtyOnHand - target.qty, lastMovement: 'Transfer Out' };
          }
          if (item.sku === sourceItem.sku && item.store === target.destStore) {
            return { ...item, qtyOnHand: item.qtyOnHand + target.qty, lastMovement: 'Transfer In' };
          }
          return item;
        })
      );

      setStockTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'Completed' } : t)));
      addAuditLog('Inventory', 'Complete Draft Transfer', `Completed draft transfer ${target.transferNo}`);
      toast.success(`Draft transfer ${target.transferNo} completed!`);
      return;
    }

    setStockTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)));
  };

  const addSale = (saleData: Omit<SalesOrder, 'id' | 'orderNo' | 'createdAt' | 'period'>): SalesOrder => {
    const storeCode = saleData.store || selectedStore || 'BLR';
    const storeNumeric = storeCode === 'BLR' ? '001' : storeCode === 'HYD' ? '002' : storeCode === 'DEL' ? '003' : storeCode === 'MUM' ? '004' : '009';
    
    const nextSeq = (invoiceCounters[storeCode] || 1) + 1;
    setInvoiceCounters((prev) => ({ ...prev, [storeCode]: nextSeq }));
    const formattedOrderNo = `CS26${storeNumeric}${nextSeq}`;

    let maxWarrantyMonths = 12;
    const saleItemsWithWarranty = saleData.items.map((item) => {
      const invItem = inventory.find((i) => i.id === item.itemId || i.sku === item.name);
      const months = invItem?.warrantyMonths || 12;
      if (months > maxWarrantyMonths) maxWarrantyMonths = months;
      
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + months);
      const formattedExpiry = expiryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

      return {
        ...item,
        warrantyMonths: months,
        warrantyExpiryDate: formattedExpiry,
      };
    });

    const overallExpiryDate = new Date();
    overallExpiryDate.setMonth(overallExpiryDate.getMonth() + maxWarrantyMonths);
    const formattedOverallExpiry = overallExpiryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const newSale: SalesOrder = {
      ...saleData,
      id: `sale-${Date.now()}`,
      orderNo: formattedOrderNo,
      items: saleItemsWithWarranty,
      taxEnabled: saleData.taxEnabled !== undefined ? saleData.taxEnabled : true,
      warrantyExpiryDate: formattedOverallExpiry,
      createdAt: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      period: 'Today',
    };

    setInventory((prev) =>
      prev.map((item) => {
        const sold = saleData.items.find((si) => si.itemId === item.id || si.name === item.name);
        if (sold && (item.store === storeCode || storeCode === 'All Stores')) {
          const newQty = Math.max(0, item.qtyOnHand - sold.qty);
          const newItem = { ...item, qtyOnHand: newQty, lastMovement: 'Just now' };

          const ledgerEntry: InventoryLedgerEntry = {
            id: `led-${Date.now()}-${item.id}`,
            productId: item.id,
            sku: item.sku,
            productName: item.name,
            storeCode,
            movementType: 'SALE',
            quantity: -sold.qty,
            unitCost: item.costPrice,
            totalValue: sold.qty * item.sellingPrice,
            fromLocation: storeCode,
            toLocation: `Customer: ${saleData.customerName}`,
            referenceNo: formattedOrderNo,
            createdBy: currentUser.name || 'Cashier',
            createdAt: new Date().toISOString(),
          };
          setInventoryLedger((ledgers) => [ledgerEntry, ...ledgers]);

          return newItem;
        }
        return item;
      })
    );

    setCustomers((prev) => {
      const match = prev.find((c) => c.phone === saleData.customerPhone || c.name === saleData.customerName);
      if (match) {
        return prev.map((c) => (c.id === match.id ? { ...c, totalSpend: c.totalSpend + newSale.total, lastPurchase: 'Today' } : c));
      } else if (saleData.customerName && saleData.customerName !== 'Walk-in Customer' && saleData.customerPhone) {
        const newCust: Customer = {
          id: `cust-${Date.now()}`,
          name: saleData.customerName,
          phone: saleData.customerPhone,
          email: `${saleData.customerName.toLowerCase().replace(/[^a-z0-9]/g, '')}@client.com`,
          city: storeCode === 'BLR' ? 'Bengaluru' : storeCode === 'HYD' ? 'Hyderabad' : storeCode === 'DEL' ? 'Delhi' : 'Mumbai',
          tier: 'Regular',
          totalSpend: newSale.total,
          creditBalance: saleData.paymentMethod === 'Credit' ? newSale.total : 0,
          lastPurchase: 'Today',
        };
        MySQLDataService.createCustomer(newCust);
        return [newCust, ...prev];
      }
      return prev;
    });

    setSales((prev) => [newSale, ...prev]);
    
    // Asynchronously commit POS sale transaction to MySQL API
    MySQLDataService.createSale({
      storeCode,
      customerName: newSale.customerName,
      customerPhone: newSale.customerPhone,
      items: newSale.items.map((it) => ({
        productId: it.itemId,
        name: it.name,
        sku: it.sku || it.name,
        qty: it.qty,
        unitPrice: it.unitPrice,
        unitCost: it.unitPrice * 0.7,
        taxRate: it.taxRate || 18,
      })),
      subtotal: newSale.subtotal,
      taxAmount: newSale.taxTotal,
      discount: newSale.discount,
      total: newSale.total,
      paymentMethod: newSale.paymentMethod,
      cashierName: currentUser.name,
    }).then(() => refreshAllData());

    const photoMsg = saleData.salePhotos && saleData.salePhotos.length > 0 ? ` with ${saleData.salePhotos.length} photo(s)` : '';
    addAuditLog('Sales', 'POS Sale Checkout', `Completed order ${newSale.orderNo} for ₹${newSale.total.toLocaleString('en-IN')}${photoMsg}`);
    toast.success(`Invoice ${newSale.orderNo} generated successfully!`);
    return newSale;
  };

  const addPurchase = async (poData: Omit<PurchaseOrder, 'id' | 'poNo' | 'createdAt'>) => {
    try {
      const res = await MySQLDataService.createPurchase(poData);
      if (res?.success && res.purchaseOrder) {
        const p = res.purchaseOrder;
        const newPO: PurchaseOrder = {
          id: p.id,
          poNo: p.poNo,
          vendorName: poData.vendorName,
          vendorId: p.vendorId,
          store: p.storeCode || 'CENTRAL',
          items: poData.items,
          totalAmount: Number(p.totalCost),
          status: p.status,
          paymentStatus: p.paymentStatus,
          createdAt: new Date(p.createdAt).toLocaleDateString('en-IN'),
          expectedDate: poData.expectedDate || 'ASAP',
        };
        setPurchases((prev) => [newPO, ...prev.filter(po => po.id !== newPO.id)]);
        addAuditLog('Purchases', 'Create Purchase Order', `Generated ${newPO.poNo} for ${newPO.vendorName} (₹${newPO.totalAmount.toLocaleString('en-IN')})`);
        toast.success(`Purchase Order ${newPO.poNo} saved to MySQL!`);
        refreshAllData();
        return newPO;
      } else {
        toast.error(res?.error || 'Failed to create purchase order');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error creating purchase order');
    }
  };

  const updatePurchase = async (id: string, updated: Partial<PurchaseOrder>) => {
    setPurchases((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    const res = await fetch('/api/purchases', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updated }),
    }).catch(() => null);

    if (res && res.ok) {
      addAuditLog('Purchases', 'Edit Purchase Order', `Updated PO #${id}`);
      toast.success('Purchase Order updated in MySQL');
      refreshAllData();
    }
  };

  const deletePurchase = async (id: string) => {
    const poToDelete = purchases.find((p) => p.id === id);
    try {
      const res = await MySQLDataService.deletePurchase(id);
      if (res?.success) {
        setPurchases((prev) => prev.filter((p) => p.id !== id));
        if (poToDelete) {
          addAuditLog('Purchases', res.mode === 'archived' ? 'Cancel Purchase Order' : 'Delete Purchase Order', res.message || `Removed PO ${poToDelete.poNo}`);
        }
        toast.success(res.message || `Removed Purchase Order ${poToDelete?.poNo || id}`);
        refreshAllData();
        return { success: true, mode: res.mode, message: res.message };
      } else {
        toast.error(res?.error || res?.message || 'Failed to delete purchase order');
        return { success: false, message: res?.error || res?.message };
      }
    } catch (err: any) {
      toast.error('Network error while deleting purchase order');
      return { success: false, message: err.message };
    }
  };

  const addCustomer = async (custData: Omit<Customer, 'id' | 'totalSpend' | 'lastPurchase'>) => {
    try {
      const res = await MySQLDataService.createCustomer(custData);
      if (res?.success && res.customer) {
        const c = res.customer;
        const newCust: Customer = {
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email || '',
          city: c.city || '',
          tier: 'Regular',
          totalSpend: Number(c.totalSpent) || 0,
          creditBalance: Number(c.creditBalance) || 0,
          lastPurchase: 'Never',
        };
        setCustomers((prev) => [newCust, ...prev.filter(cust => cust.id !== newCust.id)]);
        addAuditLog('Customers', 'Add Customer', `Registered customer "${newCust.name}"`);
        toast.success(`Customer "${newCust.name}" saved to MySQL!`);
        refreshAllData();
        return newCust;
      } else {
        toast.error(res?.error || 'Failed to save customer');
        const tempCust: Customer = { ...custData, id: `cust-${Date.now()}`, totalSpend: 0, lastPurchase: 'Never' };
        setCustomers((prev) => [tempCust, ...prev]);
        return tempCust;
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving customer');
      const tempCust: Customer = { ...custData, id: `cust-${Date.now()}`, totalSpend: 0, lastPurchase: 'Never' };
      setCustomers((prev) => [tempCust, ...prev]);
      return tempCust;
    }
  };

  const updateCustomer = async (id: string, updated: Partial<Customer>) => {
    const cust = customers.find((c) => c.id === id);
    if (!cust) return;
    const merged = { ...cust, ...updated };
    setCustomers((prev) => prev.map((c) => (c.id === id ? merged : c)));
    const res = await MySQLDataService.updateCustomer({ id, ...updated });
    if (res?.success) {
      addAuditLog('Customers', 'Edit Customer', `Updated profile for customer #${id}`);
      toast.success('Customer record updated in MySQL');
      refreshAllData();
    }
  };

  const deleteCustomer = async (id: string, permanent = false) => {
    const cust = customers.find((c) => c.id === id);
    try {
      const res = await MySQLDataService.deleteCustomer(id, permanent);
      if (res?.success) {
        setCustomers((prev) => prev.filter((c) => c.id !== id));
        if (cust) {
          addAuditLog('Customers', res?.mode === 'archived' ? 'Archive Customer' : 'Delete Customer', res?.message || `Removed customer "${cust.name}"`);
        }
        toast.success(res?.message || `Customer "${cust?.name || id}" removed`);
        refreshAllData();
        return { success: true, mode: res?.mode || 'deleted', message: res?.message };
      } else {
        toast.error(res?.error || res?.message || 'Failed to remove customer');
        return { success: false, message: res?.error || res?.message };
      }
    } catch (err: any) {
      toast.error(err.message || 'Error removing customer');
      return { success: false, message: err.message };
    }
  };

  const addVendor = async (vendorData: Omit<Vendor, 'id' | 'code'>) => {
    try {
      const res = await MySQLDataService.createVendor(vendorData);
      if (res?.success && res.vendor) {
        const v = res.vendor;
        const newVendor: Vendor = {
          id: v.id,
          code: v.code,
          name: v.name,
          contactPerson: v.contactPerson || '',
          email: v.email || '',
          phone: v.phone || '',
          city: v.city || '',
          address: v.address || '',
          category: v.categories || 'General',
          outstandingPayable: 0,
          rating: 4.8,
          leadTimeDays: 3,
        };
        setVendors((prev) => [newVendor, ...prev.filter(vnd => vnd.id !== newVendor.id)]);
        addAuditLog('Vendors', 'Add Vendor', `Onboarded supplier "${newVendor.name}"`);
        toast.success(`Vendor "${newVendor.name}" saved to MySQL!`);
        refreshAllData();
        return newVendor;
      } else {
        toast.error(res?.error || 'Failed to save vendor');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving vendor');
    }
  };

  const updateVendor = async (id: string, updated: Partial<Vendor>) => {
    const vend = vendors.find((v) => v.id === id);
    if (!vend) return;
    const merged = { ...vend, ...updated };
    setVendors((prev) => prev.map((v) => (v.id === id ? merged : v)));
    const res = await MySQLDataService.updateVendor({ id, ...updated });
    if (res?.success) {
      addAuditLog('Vendors', 'Edit Vendor', `Updated supplier #${id}`);
      toast.success('Vendor profile updated in MySQL');
      refreshAllData();
    }
  };

  const deleteVendor = async (id: string, permanent = false) => {
    const v = vendors.find((vend) => vend.id === id || vend.code === id);
    try {
      const res = await MySQLDataService.deleteVendor(id, permanent);
      if (res?.success) {
        setVendors((prev) => prev.filter((vend) => vend.id !== id && vend.code !== id));
        if (v) {
          addAuditLog('Vendors', res?.mode === 'archived' ? 'Archive Vendor' : 'Delete Vendor', res?.message || `Removed supplier "${v.name}"`);
        }
        toast.success(res?.message || `Vendor "${v?.name || id}" removed`);
        refreshAllData();
        return { success: true, mode: res?.mode || 'deleted', message: res?.message };
      } else {
        toast.error(res?.error || res?.message || 'Failed to remove vendor');
        return { success: false, message: res?.error || res?.message };
      }
    } catch (err: any) {
      toast.error(err.message || 'Error removing vendor');
      return { success: false, message: err.message };
    }
  };

  const addExpense = async (expenseData: Omit<Expense, 'id' | 'referenceNo' | 'date'>) => {
    try {
      const res = await MySQLDataService.createExpense(expenseData);
      if (res?.success && res.expense) {
        const e = res.expense;
        const newExp: Expense = {
          id: e.id,
          referenceNo: e.expenseNo,
          category: e.category,
          amount: Number(e.amount),
          store: e.storeCode,
          description: e.description,
          paymentMethod: e.paymentMethod,
          status: 'Approved',
          date: new Date(e.date).toLocaleDateString('en-IN'),
        };
        setExpenses((prev) => [newExp, ...prev.filter(exp => exp.id !== newExp.id)]);
        addAuditLog('Expenses', 'Create Expense Record', `Logged expense "${newExp.description}" for ₹${newExp.amount.toLocaleString('en-IN')} (${newExp.store})`);
        toast.success(`Expense record ${newExp.referenceNo} saved to MySQL!`);
        refreshAllData();
        return newExp;
      } else {
        toast.error(res?.error || 'Failed to record expense');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error recording expense');
    }
  };

  const deleteExpense = async (id: string) => {
    const exp = expenses.find((e) => e.id === id || e.referenceNo === id);
    try {
      const res = await MySQLDataService.deleteExpense(id);
      if (res?.success) {
        setExpenses((prev) => prev.filter((e) => e.id !== id && e.referenceNo !== id));
        if (exp) {
          addAuditLog('Expenses', 'Delete Expense Record', `Deleted expense "${exp.description}" (${exp.referenceNo})`);
        }
        toast.success(res?.message || `Expense record ${exp?.referenceNo || id} deleted`);
        refreshAllData();
        return { success: true, mode: 'deleted', message: res?.message };
      } else {
        toast.error(res?.error || res?.message || 'Failed to delete expense record');
        return { success: false, message: res?.error || res?.message };
      }
    } catch (err: any) {
      toast.error(err.message || 'Error deleting expense');
      return { success: false, message: err.message };
    }
  };

  const addAuditLog = (module: string, action: string, details: string) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      userName: currentUser.name || 'System',
      userRole: currentUser.role || 'Super Admin',
      module,
      action,
      details,
      ipAddress: '127.0.0.1',
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    MySQLDataService.syncAuditLog(newLog);
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success('All notifications marked as read');
  };

  return (
    <AppContext.Provider
      value={{
        branding,
        updateBranding,
        resetBranding,
        selectedStore,
        setSelectedStore,
        datePeriod,
        setDatePeriod,
        authStatus,
        currentUser,
        setCurrentUser,
        logoutUser,
        toggleCurrentUserShift,
        updateProfileAvatar,
        storesList,
        addStoreHub,
        updateStoreHub,
        deleteStoreHub,
        usersList,
        addUserAccount,
        updateUserAccount,
        toggleUserShiftStatus,
        toggleUserStatus,
        setUserPermissionOverride,
        toggleUserStoreAccess,
        deleteUserAccount,
        categoriesList,
        addCategory,
        updateCategory,
        toggleCategoryStatus,
        deleteCategory,
        changeUserPassword,
        updateUserProfile,
        inventory,
        addItem,
        updateItem,
        deleteItem,
        adjustStock,
        transferStock,
        updateTransferStatus,
        defaultStoreTransferPrices,
        setDefaultStoreTransferPrice,
        stockTransfers,
        inventoryLedger,
        repairsEnquiries,
        sales,
        addSale,
        purchases,
        addPurchase,
        updatePurchase,
        deletePurchase,
        customers,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        vendors,
        addVendor,
        updateVendor,
        deleteVendor,
        expenses,
        addExpense,
        deleteExpense,
        auditLogs,
        addAuditLog,
        refreshAllData,
        notifications,
        markNotificationRead,
        markAllNotificationsRead,
        searchOpen,
        setSearchOpen,
        notificationsOpen,
        setNotificationsOpen,
        storeSelectorOpen,
        setStoreSelectorOpen,
        userProfileOpen,
        setUserProfileOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
