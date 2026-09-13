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
  supportPhone?: string;
  businessName?: string;
  businessAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  baseCurrency?: string;
  taxNumber?: string;
}

export interface SystemSettings {
  gstin: string | null;
  legalBusinessName: string | null;
  tradeName: string | null;
  gstState: string | null;
  gstStateCode: string | null;
  gstRegistrationType: string;
  defaultTaxRate: number;
  hsnMandatory: boolean;
  enableReverseCharge: boolean;
  gstBusinessAddress: string | null;
  invoiceHeader: string;
  invoiceFooter: string;
  invoiceTerms: string | null;
  invoiceAccentColor: string;
  watermarkOpacity: number;
  showStoreAddress: boolean;
  invoiceTemplateUrl: string | null;
  invoiceTemplateVersion: number;
  invoiceFieldMapping: string | null;
  showPaymentQr: boolean;
  paymentUpiId: string | null;
  paymentBankDetails: string | null;
  sessionTimeoutMins: number;
  maxLoginAttempts: number;
  enforcePasswordPolicy: boolean;
  sensitiveActionConfirm: boolean;
  lowStockAlerts: boolean;
  lowStockThreshold: number;
  overduePaymentAlerts: boolean;
  overdueThresholdDays: number;
  dailySalesDigest: boolean;
  securityEventAlerts: boolean;
  alertRecipientEmails: string | null;
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
  description?: string;
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
  locationStock?: Record<string, number>;
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
  status: 'Completed' | 'Received' | 'Draft' | 'In Transit' | 'Cancelled';
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
  grossProfit?: number;
  totalCost?: number;
  taxEnabled: boolean;
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Credit';
  status: 'Completed' | 'Refunded' | 'Pending' | 'Cancelled' | 'Voided';
  createdAt: string;
  period: 'Today' | 'Yesterday' | 'Last 7 Days' | 'This Month' | 'Last Month' | 'This Quarter' | 'This Year' | 'DB';
  salePhotos?: SalePhoto[];
  warrantyExpiryDate?: string;
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  invoiceNo?: string;
  vendorName: string;
  vendorId?: string;
  store: string;
  items: { name: string; qty: number; unitCost: number; sku?: string }[];
  totalAmount: number;
  paidAmount?: number;
  creditAmount?: number;
  remainingAmount?: number;
  status: 'Draft' | 'Sent' | 'Ordered' | 'Pending' | 'Received' | 'Completed' | 'Cancelled' | 'Archived';
  paymentStatus: 'Paid' | 'Partial' | 'Unpaid';
  expectedDate: string;
  dueDate?: string;
  createdAt: string;
  notes?: string;
  payments?: any[];
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  address?: string;
  status?: string;
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
  gstin?: string;
  paymentTerms?: string;
  outstandingPayable: number;
  totalBilledAmount?: number;
  totalPaidAmount?: number;
  totalCreditsAmount?: number;
  totalBillsCount?: number;
  unpaidBillsCount?: number;
  overdueBillsCount?: number;
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
  supportPhone: '+91 80 4000 8800',
  businessName: 'COSKO Retail Enterprise',
  businessAddress: '100 Feet Ring Road, Indiranagar',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560038',
  baseCurrency: 'INR (₹)',
  taxNumber: '29AABCU9603R1ZM',
};

export const defaultSystemSettings: SystemSettings = {
  gstin: '29AABCU9603R1ZM',
  legalBusinessName: 'COSKO Retail Enterprise Private Limited',
  tradeName: 'COSKO Stores',
  gstState: 'Karnataka',
  gstStateCode: '29',
  gstRegistrationType: 'Regular',
  defaultTaxRate: 18,
  hsnMandatory: true,
  enableReverseCharge: false,
  gstBusinessAddress: '100 Feet Ring Road, Indiranagar, Bengaluru, Karnataka - 560038',
  invoiceHeader: 'COSKO Retail Enterprise',
  invoiceFooter: 'Thank you for shopping with COSKO! Goods once sold cannot be returned without original receipt.',
  invoiceTerms: '1. Standard 12-month warranty on manufacturing defects.\n2. Retain this invoice for warranty & service support.\n3. Physical and liquid damage are excluded.',
  invoiceAccentColor: 'primary',
  watermarkOpacity: 5,
  showStoreAddress: true,
  invoiceTemplateUrl: null,
  invoiceTemplateVersion: 1,
  invoiceFieldMapping: null,
  showPaymentQr: false,
  paymentUpiId: 'cosko@icici',
  paymentBankDetails: 'HDFC Bank · A/C 50200012345678 · IFSC HDFC0001234',
  sessionTimeoutMins: 30,
  maxLoginAttempts: 5,
  enforcePasswordPolicy: true,
  sensitiveActionConfirm: true,
  lowStockAlerts: true,
  lowStockThreshold: 5,
  overduePaymentAlerts: true,
  overdueThresholdDays: 30,
  dailySalesDigest: false,
  securityEventAlerts: true,
  alertRecipientEmails: 'alerts@cosko.com',
};

const initialStoreHubs: StoreHub[] = [];

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

const initialUsers: UserAccount[] = [];

const initialAuditLogs: AuditLog[] = [];

const initialNotifications: NotificationItem[] = [];

interface AppContextType {
  branding: AppBranding;
  updateBranding: (updated: Partial<AppBranding>) => void;
  resetBranding: () => void;
  systemSettings: SystemSettings;
  updateSystemSettings: (section: 'branding' | 'profile' | 'tax' | 'invoice' | 'security' | 'alerts', data: any) => Promise<{ success: boolean; message?: string; error?: string }>;
  reloadSettings: () => Promise<void>;
  selectedStore: string;
  setSelectedStore: (store: string) => void;
  datePeriod: string;
  setDatePeriod: (period: string) => void;
  customDateRange: { start: string; end: string };
  setCustomDateRange: (range: { start: string; end: string }) => void;
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
  updateTransferStatus: (id: string, nextStatus: 'Completed' | 'Cancelled') => Promise<any> | void;
  deleteTransfer: (id: string) => Promise<{ success: boolean; message?: string }>;
  defaultStoreTransferPrices: ProductStoreTransferPrice[];
  setDefaultStoreTransferPrice: (productId: string, storeCode: string, price: number) => void;
  stockTransfers: StockTransferRecord[];
  inventoryLedger: InventoryLedgerEntry[];
  repairsEnquiries: RepairEnquiry[];
  addRepairEnquiry: (enquiry: any) => Promise<any>;
  updateRepairEnquiry: (id: string, updated: any) => Promise<any>;
  deleteRepairEnquiry: (id: string) => Promise<any>;
  sales: SalesOrder[];
  addSale: (sale: Omit<SalesOrder, 'id' | 'orderNo' | 'createdAt' | 'period'>) => Promise<SalesOrder | null>;
  updateSale: (id: string, updated: Partial<SalesOrder>) => Promise<any>;
  voidSale: (id: string) => Promise<{ success: boolean; message?: string }>;
  purchases: PurchaseOrder[];
  addPurchase: (po: Omit<PurchaseOrder, 'id' | 'poNo' | 'createdAt'>) => Promise<any>;
  updatePurchase: (id: string, updated: Partial<PurchaseOrder>) => Promise<any>;
  deletePurchase: (id: string) => Promise<{ success: boolean; mode?: string; message?: string }>;
  recordPurchasePayment: (paymentData: {
    purchaseId: string;
    amount: number;
    paymentMethod?: string;
    paymentDate?: string;
    referenceNo?: string;
    notes?: string;
    receiptUrl?: string;
  }) => Promise<{ success: boolean; error?: string; payment?: any; receiptVoucher?: any; remaining?: number }>;
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
  updateExpense: (id: string, updated: Partial<Expense>) => Promise<any>;
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
        if (saved) return { ...defaultBranding, ...JSON.parse(saved) };
      } catch {}
    }
    return defaultBranding;
  });

  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cosko_system_settings');
        if (saved) return { ...defaultSystemSettings, ...JSON.parse(saved) };
      } catch {}
    }
    return defaultSystemSettings;
  });

  // Cross-tab live synchronization for white-label branding & system settings updates
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cosko_branding' && e.newValue) {
        try {
          setBranding(JSON.parse(e.newValue));
        } catch {}
      }
      if (e.key === 'cosko_system_settings' && e.newValue) {
        try {
          setSystemSettings(JSON.parse(e.newValue));
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const [selectedStore, setSelectedStoreState] = useState<string>('All Stores');
  const [datePeriod, setDatePeriod] = useState<string>('This Month');
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
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

  // Invoice sequence is now handled server-side in salesService.ts via DB count

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
      let activeToken = '';
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem('cosko_active_session');
          if (saved) {
            const parsed = JSON.parse(saved);
            activeToken = parsed.token || '';
          }
        } catch {}
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }
      const opts: RequestInit = { credentials: 'include', headers };

      // Fetch all authoritative data in parallel
      const [
        storesRes, categoriesRes, inventoryRes, salesRes, purchasesRes,
        customersRes, vendorsRes, expensesRes, repairsRes, usersRes,
        transfersRes, ledgerRes, settingsRes, auditLogsRes
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
        fetch('/api/settings', opts),
        fetch('/api/audit-logs?limit=200', opts),
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

          // Build location stock map for this product
          const locStock: Record<string, number> = {};
          if (p.inventoryItems && p.inventoryItems.length > 0) {
            p.inventoryItems.forEach((inv: any) => {
              locStock[inv.storeCode] = inv.qtyOnHand;
            });
          }

          const productMrp = p.mrp !== null && p.mrp !== undefined ? Number(p.mrp) : (Number(p.baseSellingPrice) || 0);
          const productImg = p.imageUrl || undefined;

          if (p.inventoryItems && p.inventoryItems.length > 0) {
            for (const inv of p.inventoryItems) {
              items.push({
                id: inv.id || `${p.id}-${inv.storeCode}`,
                productId: p.id,
                sku: p.sku,
                barcode: p.barcode || '',
                name: p.name,
                brand: p.brand || '',
                model: p.model || '',
                category: p.category,
                subcategory: p.subcategory || '',
                description: p.description || '',
                store: inv.storeCode,
                qtyOnHand: inv.qtyOnHand,
                reorderPt: inv.reorderPt || 5,
                costPrice: Number(p.baseCostPrice),
                transferPrice: Number(p.baseCostPrice),
                sellingPrice: Number(p.baseSellingPrice),
                mrp: productMrp,
                hsn: '',
                taxRate: Number(p.gstRate) || 0,
                warrantyMonths: p.warrantyMonths || 0,
                minStock: inv.reorderPt || 10,
                status: p.status as any,
                fifoLots: 1,
                lastMovement: 'Synced',
                imageUrl: productImg,
                primaryImage: productImg,
                images: productImg ? [productImg] : [],
                locationStock: locStock,
              });
            }
          } else {
            items.push({
              id: `${p.id}-UNASSIGNED`,
              productId: p.id,
              sku: p.sku,
              barcode: p.barcode || '',
              name: p.name,
              brand: p.brand || '',
              model: p.model || '',
              category: p.category,
              subcategory: p.subcategory || '',
              description: p.description || '',
              store: 'UNASSIGNED',
              qtyOnHand: 0,
              reorderPt: 5,
              costPrice: Number(p.baseCostPrice),
              transferPrice: Number(p.baseCostPrice),
              sellingPrice: Number(p.baseSellingPrice),
              mrp: productMrp,
              hsn: '',
              taxRate: Number(p.gstRate) || 0,
              warrantyMonths: p.warrantyMonths || 0,
              minStock: 10,
              status: p.status as any,
              fifoLots: 0,
              lastMovement: 'Never',
              imageUrl: productImg,
              primaryImage: productImg,
              images: productImg ? [productImg] : [],
              locationStock: locStock,
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
          cashierName: s.cashierName || 'Sales Staff',
          items: s.items?.map((it: any) => ({
            itemId: it.productId, name: it.productName, sku: it.sku,
            qty: it.qty, unitPrice: Number(it.unitPrice),
            unitCost: Number(it.unitCost) || 0,
            lineTotal: Number(it.lineTotal) || 0,
            lineProfit: Number(it.lineProfit) || 0,
            taxRate: 18,
          })) || [],
          subtotal: Number(s.subtotal), taxTotal: Number(s.taxAmount),
          discount: Number(s.discountAmount) || 0,
          total: Number(s.grandTotal), taxEnabled: true,
          paymentMethod: s.paymentMethod, status: s.status,
          createdAt: s.createdAt,
          grossProfit: Number(s.grossProfit) || 0,
          totalCost: Number(s.totalCost) || 0,
          period: 'DB',
        })));
      }

      const purchasesData = await safeJson(purchasesRes);
      if (purchasesData?.success && Array.isArray(purchasesData.purchases)) {
        setPurchases(purchasesData.purchases.map((p: any) => {
          const total = Number(p.totalCost) || 0;
          const credit = Number(p.creditAmount) || 0;
          const realPaid = p.payments?.reduce((sum: number, pay: any) => sum + (Number(pay.amount) || 0), 0) ?? (p.paidAmount !== undefined && p.paidAmount !== null ? Number(p.paidAmount) : 0);
          const remaining = Math.max(0, Math.round((total - realPaid - credit) * 100) / 100);

          return {
            id: p.id,
            poNo: p.poNo,
            invoiceNo: p.invoiceNo || p.poNo,
            vendorName: p.vendor?.name || 'Vendor',
            vendorId: p.vendorId,
            store: p.storeCode || 'CENTRAL',
            items: p.items?.map((it: any) => ({
              itemId: it.productId,
              name: it.productName || 'Item',
              sku: it.sku || '',
              qty: it.qtyOrdered,
              unitCost: Number(it.unitCost),
            })) || [],
            totalAmount: total,
            paidAmount: realPaid,
            creditAmount: credit,
            remainingAmount: remaining,
            status: p.status,
            paymentStatus: p.paymentStatus,
            notes: p.notes || '',
            createdAt: p.createdAt,
            expectedDate: p.expectedDate ? p.expectedDate : '',
            dueDate: p.dueDate ? p.dueDate : (p.expectedDate ? p.expectedDate : ''),
            payments: p.payments || [],
          };
        }));
      }

      const customersData = await safeJson(customersRes);
      if (customersData?.success && Array.isArray(customersData.customers)) {
        setCustomers(customersData.customers.filter((c: any) => c.status !== 'Archived').map((c: any) => ({
          id: c.id, name: c.name, phone: c.phone,
          email: c.email || '', city: c.city || '',
          address: c.address || '',
          status: c.status || 'Active',
          tier: Number(c.totalSpent) > 50000 ? 'VIP' : 'Regular',
          totalSpend: Number(c.totalSpent) || 0,
          creditBalance: Number(c.creditBalance) || 0,
          lastPurchase: c.updatedAt ? new Date(c.updatedAt).toLocaleDateString('en-IN') : 'Never',
        })));
      }

      const vendorsData = await safeJson(vendorsRes);
      if (vendorsData?.success && Array.isArray(vendorsData.vendors)) {
        setVendors(vendorsData.vendors.filter((v: any) => v.status !== 'Archived').map((v: any) => ({
          id: v.id,
          code: v.code,
          name: v.name,
          contactPerson: v.contactPerson,
          email: v.email,
          phone: v.phone,
          city: v.city,
          address: v.address || '',
          category: v.categories || 'General',
          gstin: v.gstin || '',
          paymentTerms: v.paymentTerms || 'Net 30',
          outstandingPayable: Number(v.outstandingPayable) || 0,
          totalBilledAmount: Number(v.totalBilledAmount) || 0,
          totalPaidAmount: Number(v.totalPaidAmount) || 0,
          totalCreditsAmount: Number(v.totalCreditsAmount) || 0,
          totalBillsCount: Number(v.totalBillsCount) || 0,
          unpaidBillsCount: Number(v.unpaidBillsCount) || 0,
          overdueBillsCount: Number(v.overdueBillsCount) || 0,
          rating: Number(v.rating) || 5.0,
          leadTimeDays: Number(v.leadTimeDays) || 3,
        })));
      }

      const expensesData = await safeJson(expensesRes);
      if (expensesData?.success && Array.isArray(expensesData.expenses)) {
        setExpenses(expensesData.expenses.map((e: any) => ({
          id: e.id, referenceNo: e.expenseNo,
          category: e.category, amount: Number(e.amount),
          store: e.storeCode, description: e.description,
          paymentMethod: e.paymentMethod, status: 'Approved',
          date: e.date || e.createdAt,
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
          id: r.id,
          ticketNo: r.ticketNo,
          customerPhone: r.customerPhone,
          customerName: r.customerName,
          enquiryDate: r.enquiryDate || (r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : 'Recent'),
          deviceType: r.deviceType || 'Mobile',
          deviceName: r.deviceName,
          repairStatus: r.status,
          repairRequested: r.issueDescription,
          technicianNotes: r.technicianNotes || '',
          estimatedCost: Number(r.estimatedCost) || 0,
          assignedTech: r.assignedTech || '',
          storeCode: r.storeCode || 'CENTRAL',
          createdAt: r.createdAt,
        })));
      }

      const settingsData = await safeJson(settingsRes);
      if (settingsData?.success) {
        if (settingsData.branding) {
          setBranding((prev) => {
            const updated = {
              ...prev,
              ...settingsData.branding,
              taxNumber: settingsData.systemSettings?.gstin || settingsData.branding.taxNumber || prev.taxNumber,
            };
            try {
              localStorage.setItem('cosko_branding', JSON.stringify(updated));
            } catch {}
            return updated;
          });
        }
        if (settingsData.systemSettings) {
          setSystemSettings((prev) => {
            const updated = {
              ...prev,
              ...settingsData.systemSettings,
              defaultTaxRate: Number(settingsData.systemSettings.defaultTaxRate) || prev.defaultTaxRate,
            };
            try {
              localStorage.setItem('cosko_system_settings', JSON.stringify(updated));
            } catch {}
            return updated;
          });
        }
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

      const auditLogsData = await safeJson(auditLogsRes);
      if (auditLogsData?.success && Array.isArray(auditLogsData.logs)) {
        setAuditLogs(auditLogsData.logs.map((a: any) => ({
          id: a.id,
          timestamp: a.createdAt ? new Date(a.createdAt).toLocaleString('en-IN') : 'Recent',
          userName: a.userName || a.userEmail || 'System',
          userRole: a.userRole || 'Admin',
          module: a.module || 'System',
          action: a.action || 'Action',
          details: a.details || a.description || '',
          ipAddress: a.ipAddress || '127.0.0.1',
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

    MySQLDataService.updateBrandingSettings(updatedPartial).catch((err) => {
      console.warn('Failed to sync branding to MySQL:', err);
    });

    addAuditLog('Settings', 'Update White-Label Branding', `Updated app branding logo & details`);
    toast.success('Application branding updated successfully across the entire system!');
  };

  const updateSystemSettings = async (section: 'branding' | 'profile' | 'tax' | 'invoice' | 'security' | 'alerts', data: any): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ section, data }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        const errMsg = result.error || 'Failed to update settings';
        toast.error(errMsg);
        return { success: false, error: errMsg };
      }

      if (section === 'branding' && result.branding) {
        setBranding((prev) => {
          const updated = { ...prev, ...result.branding };
          try {
            localStorage.setItem('cosko_branding', JSON.stringify(updated));
            window.dispatchEvent(new StorageEvent('storage', { key: 'cosko_branding', newValue: JSON.stringify(updated) }));
          } catch {}
          return updated;
        });
      } else if (section === 'profile' && result.branding) {
        setBranding((prev) => {
          const updated = { ...prev, ...result.branding };
          try {
            localStorage.setItem('cosko_branding', JSON.stringify(updated));
            window.dispatchEvent(new StorageEvent('storage', { key: 'cosko_branding', newValue: JSON.stringify(updated) }));
          } catch {}
          return updated;
        });
      } else if (result.systemSettings) {
        setSystemSettings((prev) => {
          const updated = { ...prev, ...result.systemSettings, defaultTaxRate: Number(result.systemSettings.defaultTaxRate) || prev.defaultTaxRate };
          try {
            localStorage.setItem('cosko_system_settings', JSON.stringify(updated));
            window.dispatchEvent(new StorageEvent('storage', { key: 'cosko_system_settings', newValue: JSON.stringify(updated) }));
          } catch {}
          return updated;
        });
        if (result.systemSettings.gstin) {
          setBranding((prev) => ({ ...prev, taxNumber: result.systemSettings.gstin }));
        }
      }

      addAuditLog('Settings', `Update ${section.toUpperCase()} Settings`, `Updated ${section} settings in system`);
      toast.success(result.message || `${section.toUpperCase()} settings saved successfully`);
      return { success: true, message: result.message };
    } catch (err: any) {
      toast.error(err.message || 'Network error updating settings');
      return { success: false, error: err.message };
    }
  };

  const reloadSettings = async () => {
    try {
      const res = await fetch('/api/settings', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.branding) setBranding(prev => ({ ...prev, ...data.branding }));
        if (data.systemSettings) setSystemSettings(prev => ({ ...prev, ...data.systemSettings }));
      }
    } catch (err) {
      console.warn('Failed to reload settings:', err);
    }
  };

  const resetBranding = () => {
    setBranding(defaultBranding);
    try {
      localStorage.removeItem('cosko_branding');
      MySQLDataService.updateBrandingSettings({
        appName: defaultBranding.appName,
        logoUrl: null,
        tagline: defaultBranding.tagline,
        supportEmail: defaultBranding.supportEmail,
      }).catch((err) => console.warn('Failed to reset branding in MySQL:', err));
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
    try {
      const res = await MySQLDataService.syncStore(merged);
      if (res?.success) {
        setStoresList((prev) => prev.map((s) => (s.id === id || s.code === id ? merged : s)));
        addAuditLog('Stores', 'Edit Store Hub', `Updated store #${id}`);
        toast.success('Store details updated in MySQL');
        await refreshAllData();
        return { success: true };
      } else {
        toast.error(res?.error || 'Failed to update store');
        return { success: false, error: res?.error };
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating store');
      return { success: false, error: err.message };
    }
  };

  const deleteStoreHub = async (id: string, permanent = false) => {
    const s = storesList.find((st) => st.id === id || st.code === id || st.code.toUpperCase() === id.toUpperCase());
    if (s?.code === 'CENTRAL' || id === 'CENTRAL' || id.toUpperCase() === 'CENTRAL') {
      toast.error('The default Central Warehouse & Owner Store (CENTRAL) is permanent and cannot be deleted.');
      return { success: false, message: 'CENTRAL store cannot be deleted' };
    }
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
    try {
      const res = await MySQLDataService.updateProfile(merged);
      if (res?.success) {
        setUsersList((prev) => prev.map((u) => (u.id === id ? merged : u)));
        addAuditLog('Users & Roles', 'Edit User Profile', `Updated user profile #${id}`);
        toast.success('User record updated in MySQL');
        await refreshAllData();
        return { success: true };
      } else {
        toast.error(res?.error || 'Failed to update user profile');
        return { success: false, error: res?.error };
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating user profile');
      return { success: false, error: err.message };
    }
  };

  const toggleUserShiftStatus = async (id: string) => {
    const u = usersList.find((usr) => usr.id === id);
    if (!u) return;
    const nextShift = u.shiftStatus === 'On Shift' ? 'On Leave' : 'On Shift';
    const updatedUser = { ...u, shiftStatus: nextShift as any };
    try {
      const res = await MySQLDataService.updateProfile(updatedUser);
      if (res?.success) {
        setUsersList((prev) => prev.map((usr) => (usr.id === id ? updatedUser : usr)));
        toast.success(`Shift status changed to ${nextShift}`);
        await refreshAllData();
      } else {
        toast.error(res?.error || 'Failed to update shift status');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating shift status');
    }
  };

  const toggleUserStatus = async (id: string, nextStatus: 'Active' | 'Inactive' | 'Suspended') => {
    const u = usersList.find((usr) => usr.id === id);
    if (!u) return;
    const updatedUser = { ...u, status: nextStatus };
    try {
      const res = await MySQLDataService.updateProfile(updatedUser);
      if (res?.success) {
        setUsersList((prev) => prev.map((usr) => (usr.id === id ? updatedUser : usr)));
        addAuditLog('Users & Roles', 'Change Account Status', `Set account #${id} status to ${nextStatus}`);
        toast.success(`Account status changed to ${nextStatus}`);
        await refreshAllData();
      } else {
        toast.error(res?.error || 'Failed to change account status');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error changing account status');
    }
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
    try {
      const res = await MySQLDataService.updateCategory({ id, ...updated });
      if (res?.success) {
        setCategoriesList((prev) =>
          prev.map((c) => {
            if (c.id === id) {
              const parent = updated.parentCategoryId !== undefined
                ? (updated.parentCategoryId ? prev.find((p) => p.id === updated.parentCategoryId)?.name : undefined)
                : c.parentCategoryName;
              return { ...c, ...updated, parentCategoryName: parent, updatedAt: new Date().toISOString() };
            }
            return c;
          })
        );
        addAuditLog('Categories', 'Update Category', `Updated category #${id}`);
        toast.success('Category updated successfully');
        await refreshAllData();
        return { success: true };
      } else {
        toast.error(res?.error || 'Failed to update category');
        return { success: false, error: res?.error };
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating category');
      return { success: false, error: err.message };
    }
  };

  const toggleCategoryStatus = async (id: string) => {
    const c = categoriesList.find((cat) => cat.id === id);
    if (!c) return;
    const nextStatus: 'Active' | 'Inactive' = c.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await MySQLDataService.updateCategory({ id: c.id, status: nextStatus });
      if (res?.success) {
        setCategoriesList((prev) =>
          prev.map((cat) => (cat.id === id ? { ...cat, status: nextStatus, updatedAt: new Date().toISOString() } : cat))
        );
        addAuditLog('Categories', 'Toggle Category Status', `Changed category "${c.name}" status to ${nextStatus}`);
        toast.success(`Category "${c.name}" is now ${nextStatus}`);
        await refreshAllData();
      } else {
        toast.error(res?.error || 'Failed to update category status');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating category status');
    }
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
          productId: p.id,
          sku: p.sku,
          barcode: p.barcode || '',
          name: p.name,
          brand: p.brand || '',
          model: p.model || '',
          category: p.category,
          subcategory: p.subcategory || '',
          description: p.description || '',
          store: itemData.store || 'CENTRAL',
          qtyOnHand: itemData.qtyOnHand || 0,
          reorderPt: itemData.reorderPt || 5,
          costPrice: Number(p.baseCostPrice),
          transferPrice: Math.round(Number(p.baseCostPrice) * 1.18),
          sellingPrice: Number(p.baseSellingPrice),
          mrp: p.mrp !== null && p.mrp !== undefined ? Number(p.mrp) : (Number(itemData.mrp) || 0),
          taxRate: Number(p.gstRate) || 18,
          warrantyMonths: p.warrantyMonths || 12,
          minStock: itemData.minStock || 10,
          status: p.status as any,
          fifoLots: 1,
          lastMovement: 'Created',
          imageUrl: p.imageUrl || itemData.imageUrl,
          primaryImage: p.imageUrl || itemData.primaryImage || itemData.imageUrl,
          images: itemData.images || (p.imageUrl ? [p.imageUrl] : []),
        };
        setInventory((prev) => [newItem, ...prev.filter(i => i.id !== newItem.id && i.sku !== newItem.sku)]);
        addAuditLog('Inventory', 'Add Product', `Created new item "${newItem.name}" (${newItem.sku})`);
        toast.success(`Successfully saved "${newItem.name}" to MySQL inventory`);
        await refreshAllData();
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
      const duplicate = inventory.find((i) => i.id !== id && i.productId !== id && i.barcode === cleanBarcode);
      if (duplicate) {
        toast.error(`Barcode "${cleanBarcode}" is already assigned to "${duplicate.name}" (${duplicate.sku})!`);
        return { success: false, error: 'Duplicate barcode' };
      }
    }

    const currentItem = inventory.find((i) => i.id === id || i.productId === id || i.sku === id);
    const targetProductId = currentItem?.productId || id;

    try {
      const res = await MySQLDataService.updateProduct({
        id,
        productId: targetProductId,
        sku: currentItem?.sku,
        ...updated,
      });
      if (res?.success) {
        setInventory((prev) =>
          prev.map((item) => {
            if (item.id === id || item.productId === targetProductId) {
              return { ...item, ...updated };
            }
            return item;
          })
        );
        addAuditLog('Inventory', 'Edit Product', `Updated details for item "${currentItem?.name || id}"`);
        toast.success('Inventory item updated in MySQL');
        await refreshAllData();
        return { success: true };
      } else {
        toast.error(res?.error || 'Failed to update item in database');
        return { success: false, error: res?.error };
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating item');
      return { success: false, error: err.message };
    }
  };

  const deleteItem = async (id: string, permanent = false) => {
    const itemToDelete = inventory.find((i) => i.id === id || i.sku === id || (i as any).productId === id);
    const targetProductId = (itemToDelete as any)?.productId || (id.includes('-') && id.split('-').length > 5 ? id.split('-').slice(0, 5).join('-') : id);
    try {
      const res = await MySQLDataService.deleteProduct(targetProductId, permanent);
      if (res?.success) {
        setInventory((prev) => prev.filter((i) => i.id !== id && i.sku !== (itemToDelete?.sku || id) && (i as any).productId !== targetProductId));
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

  const adjustStock = async (id: string, qtyChange: number, reason: string) => {
    const itemToAdjust = inventory.find((i) => i.id === id);
    if (!itemToAdjust) return;

    try {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: itemToAdjust.productId || id,
          storeCode: itemToAdjust.store,
          qtyChange,
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to adjust stock');
        return;
      }

      toast.success(`Stock adjusted successfully (new qty: ${data.newQty})`);
      await refreshAllData();
    } catch (err: any) {
      toast.error(err.message || 'Error adjusting stock');
    }
  };

  const [defaultStoreTransferPrices, setDefaultStoreTransferPrices] = useState<ProductStoreTransferPrice[]>([]);

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

  const updateTransferStatus = async (id: string, nextStatus: 'Completed' | 'Cancelled') => {
    const target = stockTransfers.find((t) => t.id === id);
    if (!target) return;

    if (target.status === 'Completed' && nextStatus === 'Cancelled' && currentUser?.role !== 'Super Admin') {
      toast.warning('Only Super Admin can cancel completed transfers with automatic inventory reversal.');
      return;
    }

    try {
      const res = await fetch('/api/transfers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id,
          status: nextStatus === 'Completed' ? 'Received' : 'Cancelled',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update transfer status');
      }

      toast.success(`Transfer ${target.transferNo} ${nextStatus === 'Cancelled' ? 'cancelled with inventory reversal' : 'completed'}!`);
      await refreshAllData();
      return { success: true };
    } catch (err: any) {
      console.error('[COSKO] updateTransferStatus error:', err);
      toast.error(err.message || 'Failed to update transfer status');
      return { success: false, error: err.message };
    }
  };

  const deleteTransfer = async (id: string) => {
    try {
      const res = await fetch(`/api/transfers?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to cancel/reverse transfer');
      }
      toast.success(data.message || 'Stock transfer reversed successfully');
      await refreshAllData();
      return { success: true, message: data.message };
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel transfer');
      return { success: false, message: err.message };
    }
  };

  const addSale = async (saleData: Omit<SalesOrder, 'id' | 'orderNo' | 'createdAt' | 'period'>): Promise<SalesOrder | null> => {
    const storeCode = saleData.store || selectedStore || 'BLR';

    try {
      // Build sale items with real cost from product master — never fabricate unitCost
      const apiItems = saleData.items.map((it) => {
        const invItem = inventory.find((i) => i.id === it.itemId || i.productId === it.itemId || i.sku === it.name);
        const realCost = invItem?.costPrice || 0;
        return {
          productId: invItem?.productId || it.itemId,
          productName: it.name,
          sku: invItem?.sku || it.sku || it.name,
          qty: it.qty,
          unitPrice: it.unitPrice,
          unitCost: realCost,
          discountPercent: 0,
        };
      });

      // Call API FIRST — only show success after DB commit
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          storeCode,
          customerId: null,
          customerName: saleData.customerName,
          customerPhone: saleData.customerPhone,
          items: apiItems,
          taxAmount: saleData.taxTotal || 0,
          discountAmount: saleData.discount || 0,
          paymentMethod: saleData.paymentMethod,
          cashierName: currentUser.name,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to process checkout transaction');
        return null;
      }

      const dbSale = data.sale;

      // Build client-side sale object from DB response
      const saleItemsWithWarranty = saleData.items.map((item) => {
        const invItem = inventory.find((i) => i.id === item.itemId || i.sku === item.name);
        const months = invItem?.warrantyMonths || 0;
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + (months || 12));
        const formattedExpiry = expiryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        return {
          ...item,
          warrantyMonths: months,
          warrantyExpiryDate: formattedExpiry,
        };
      });

      const newSale: SalesOrder = {
        ...saleData,
        id: dbSale.id,
        orderNo: dbSale.orderNo,
        items: saleItemsWithWarranty,
        taxEnabled: saleData.taxEnabled !== undefined ? saleData.taxEnabled : true,
        createdAt: dbSale.createdAt || new Date().toISOString(),
        grossProfit: Number(dbSale.grossProfit) || (Number(dbSale.grandTotal) - Number(dbSale.totalCost)),
        totalCost: Number(dbSale.totalCost) || 0,
        period: 'Today',
      };

      // Update client state AFTER DB success
      setSales((prev) => [newSale, ...prev]);

      const photoMsg = saleData.salePhotos && saleData.salePhotos.length > 0 ? ` with ${saleData.salePhotos.length} photo(s)` : '';
      addAuditLog('Sales', 'POS Sale Checkout', `Completed order ${newSale.orderNo} for ₹${newSale.total.toLocaleString('en-IN')}${photoMsg}`);
      toast.success(`Invoice ${newSale.orderNo} generated successfully!`);

      // Refresh all data to sync inventory, customer totals, etc.
      await refreshAllData();
      return newSale;
    } catch (err: any) {
      console.error('[COSKO] addSale error:', err);
      toast.error(err.message || 'Failed to process sale. No changes were made.');
      return null;
    }
  };

  const updateSale = async (id: string, updated: Partial<SalesOrder>) => {
    try {
      const res = await MySQLDataService.updateSale({ id, ...updated });
      if (res?.success) {
        toast.success(res.message || 'Sale order updated');
        await refreshAllData();
        return { success: true };
      } else {
        toast.error(res?.error || 'Failed to update sale order');
        return { success: false, error: res?.error };
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating sale order');
      return { success: false, error: err.message };
    }
  };

  const voidSale = async (id: string) => {
    try {
      const res = await MySQLDataService.deleteSale(id);
      if (res?.success) {
        toast.success(res.message || 'Sale order voided and stock restored');
        await refreshAllData();
        return { success: true, message: res.message };
      } else {
        toast.error(res?.error || 'Failed to void sale order');
        return { success: false, error: res?.error };
      }
    } catch (err: any) {
      toast.error(err.message || 'Error voiding sale order');
      return { success: false, error: err.message };
    }
  };

  const addPurchase = async (poData: Omit<PurchaseOrder, 'id' | 'poNo' | 'createdAt'>) => {
    try {
      const res = await MySQLDataService.createPurchase(poData);
      if (res?.success && res.purchaseOrder) {
        const p = res.purchaseOrder;
        const newPO: PurchaseOrder = {
          id: p.id,
          poNo: p.poNo,
          invoiceNo: p.invoiceNo || p.poNo,
          vendorName: poData.vendorName,
          vendorId: p.vendorId,
          store: p.storeCode || 'CENTRAL',
          items: poData.items,
          totalAmount: Number(p.totalCost),
          paidAmount: 0,
          creditAmount: 0,
          remainingAmount: Number(p.totalCost),
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
    try {
      const res = await fetch('/api/purchases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, ...updated }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to update purchase order in database');
        return;
      }

      setPurchases((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
      addAuditLog('Purchases', 'Edit Purchase Order', `Updated PO #${id}`);
      toast.success('Purchase Order updated in MySQL');
      await refreshAllData();
    } catch (err: any) {
      toast.error(err.message || 'Error updating purchase order');
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

  const recordPurchasePayment = async (paymentData: {
    purchaseId: string;
    amount: number;
    paymentMethod?: string;
    paymentDate?: string;
    referenceNo?: string;
    notes?: string;
    receiptUrl?: string;
  }) => {
    try {
      const res = await fetch('/api/purchases/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(paymentData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to record payment in database');
        return { success: false, error: data.error };
      }

      toast.success(`Payment of ₹${paymentData.amount.toLocaleString('en-IN')} recorded successfully!`);
      await refreshAllData();
      return {
        success: true,
        payment: data.payment,
        receiptVoucher: data.receiptVoucher,
        purchaseOrder: data.purchaseOrder,
        remaining: data.remaining,
      };
    } catch (err: any) {
      toast.error(err.message || 'Error recording purchase payment');
      return { success: false, error: err.message };
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
          city: c.city || custData.city || '',
          address: c.address || custData.address || '',
          status: c.status || custData.status || 'Active',
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
        return null;
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving customer');
      return null;
    }
  };

  const updateCustomer = async (id: string, updated: Partial<Customer>) => {
    const cust = customers.find((c) => c.id === id);
    if (!cust) return;
    const merged = { ...cust, ...updated };
    try {
      const res = await MySQLDataService.updateCustomer({ id, ...updated });
      if (res?.success) {
        setCustomers((prev) => prev.map((c) => (c.id === id ? merged : c)));
        addAuditLog('Customers', 'Edit Customer', `Updated profile for customer #${id}`);
        toast.success('Customer record updated in MySQL');
        await refreshAllData();
        return { success: true };
      } else {
        toast.error(res?.error || 'Failed to update customer');
        return { success: false, error: res?.error };
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating customer');
      return { success: false, error: err.message };
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
          gstin: v.gstin || '',
          outstandingPayable: 0,
          rating: Number(v.rating) || Number(vendorData.rating) || 5.0,
          leadTimeDays: Number(v.leadTimeDays) || Number(vendorData.leadTimeDays) || 3,
        };
        setVendors((prev) => [newVendor, ...prev.filter(vnd => vnd.id !== newVendor.id)]);
        addAuditLog('Vendors', 'Add Vendor', `Onboarded supplier "${newVendor.name}"`);
        toast.success(`Vendor "${newVendor.name}" saved to MySQL!`);
        await refreshAllData();
        return newVendor;
      } else {
        toast.error(res?.error || 'Failed to save vendor');
        return null;
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving vendor');
      return null;
    }
  };

  const updateVendor = async (id: string, updated: Partial<Vendor>) => {
    const vend = vendors.find((v) => v.id === id);
    if (!vend) return;
    const merged = { ...vend, ...updated };
    try {
      const res = await MySQLDataService.updateVendor({ id, ...updated });
      if (res?.success) {
        setVendors((prev) => prev.map((v) => (v.id === id ? merged : v)));
        addAuditLog('Vendors', 'Edit Vendor', `Updated supplier #${id}`);
        toast.success('Vendor profile updated in MySQL');
        await refreshAllData();
        return { success: true };
      } else {
        toast.error(res?.error || 'Failed to update vendor');
        return { success: false, error: res?.error };
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating vendor');
      return { success: false, error: err.message };
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

  const updateExpense = async (id: string, updated: Partial<Expense>) => {
    try {
      const res = await MySQLDataService.updateExpense(id, updated);
      if (res?.success && res.expense) {
        const e = res.expense;
        const updatedExp: Expense = {
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
        setExpenses((prev) => prev.map((item) => (item.id === id || item.referenceNo === id ? updatedExp : item)));
        addAuditLog('Expenses', 'Update Expense Record', `Updated expense "${updatedExp.description}" for ₹${updatedExp.amount.toLocaleString('en-IN')} (${updatedExp.store})`);
        toast.success(`Expense record ${updatedExp.referenceNo} updated successfully`);
        refreshAllData();
        return { success: true, expense: updatedExp };
      } else {
        toast.error(res?.error || 'Failed to update expense record');
        return { success: false, message: res?.error };
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating expense');
      return { success: false, message: err.message };
    }
  };

  const addRepairEnquiry = async (repairData: any) => {
    try {
      const res = await MySQLDataService.createRepair(repairData);
      if (res?.success && res.repair) {
        toast.success(`Repair ticket ${res.repair.ticketNo} created successfully!`);
        addAuditLog('Repairs', 'Create Repair Ticket', `Created ticket ${res.repair.ticketNo} for ${res.repair.customerName} (${res.repair.deviceName})`);
        refreshAllData();
        return { success: true, repair: res.repair };
      } else {
        toast.error(res?.error || 'Failed to create repair ticket');
        return { success: false, message: res?.error };
      }
    } catch (err: any) {
      toast.error(err.message || 'Error creating repair ticket');
      return { success: false, message: err.message };
    }
  };

  const updateRepairEnquiry = async (id: string, updated: any) => {
    try {
      const res = await MySQLDataService.updateRepair(id, updated);
      if (res?.success && res.repair) {
        toast.success(`Repair ticket ${res.repair.ticketNo} updated successfully!`);
        addAuditLog('Repairs', 'Update Repair Ticket', `Updated ticket ${res.repair.ticketNo} (${res.repair.status})`);
        refreshAllData();
        return { success: true, repair: res.repair };
      } else {
        toast.error(res?.error || 'Failed to update repair ticket');
        return { success: false, message: res?.error };
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating repair ticket');
      return { success: false, message: err.message };
    }
  };

  const deleteRepairEnquiry = async (id: string) => {
    try {
      const res = await MySQLDataService.deleteRepair(id);
      if (res?.success) {
        toast.success(res?.message || 'Repair ticket deleted successfully');
        addAuditLog('Repairs', 'Delete Repair Ticket', `Deleted ticket ID ${id}`);
        refreshAllData();
        return { success: true, message: res?.message };
      } else {
        toast.error(res?.error || 'Failed to delete repair ticket');
        return { success: false, message: res?.error };
      }
    } catch (err: any) {
      toast.error(err.message || 'Error deleting repair ticket');
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
        systemSettings,
        updateSystemSettings,
        reloadSettings,
        selectedStore,
        setSelectedStore,
        datePeriod,
        setDatePeriod,
        customDateRange,
        setCustomDateRange,
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
        deleteTransfer,
        defaultStoreTransferPrices,
        setDefaultStoreTransferPrice,
        stockTransfers,
        inventoryLedger,
        repairsEnquiries,
        addRepairEnquiry,
        updateRepairEnquiry,
        deleteRepairEnquiry,
        sales,
        addSale,
        updateSale,
        voidSale,
        purchases,
        addPurchase,
        updatePurchase,
        deletePurchase,
        recordPurchasePayment,
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
        updateExpense,
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
