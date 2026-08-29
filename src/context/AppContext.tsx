'use client';
import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { SupabaseClientService, supabase, isSupabaseConfigured } from '@/lib/supabase';

export function normalizeMobileNumber(phone: string): string {
  if (!phone) return '';
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return digitsOnly.substring(2);
  }
  if (digitsOnly.length === 10) {
    return digitsOnly;
  }
  return digitsOnly;
}

export interface AppBranding {
  appName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  tagline: string;
  supportEmail: string;
}

export interface InventoryItem {
  id: string;
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

export interface RepairEnquiry {
  id: string;
  customerPhone: string;
  customerName: string;
  enquiryDate: string;
  repairStatus: 'Received' | 'Diagnosing' | 'In Progress' | 'Ready for Delivery' | 'Delivered' | 'Cancelled';
  repairRequested: string;
  technicianNotes?: string;
  internalCost?: number;
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
  items: { itemId: string; name: string; qty: number; unitPrice: number; taxRate: number; warrantyMonths?: number; warrantyExpiryDate?: string }[];
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
  currentUser: { id: string; name: string; email: string; role: UserAccount['role']; store: string; avatar: string; shiftStatus: 'On Shift' | 'On Leave'; avatarUrl?: string };
  setCurrentUser: (user: any) => void;
  logoutUser: () => void;
  toggleCurrentUserShift: () => void;
  updateProfileAvatar: (avatarUrl: string | null) => void;
  storesList: StoreHub[];
  addStoreHub: (store: Omit<StoreHub, 'id'>) => void;
  updateStoreHub: (id: string, updated: Partial<StoreHub>) => void;
  deleteStoreHub: (id: string) => void;
  usersList: UserAccount[];
  addUserAccount: (user: Omit<UserAccount, 'id' | 'lastLogin' | 'permissions'>) => void;
  updateUserAccount: (id: string, updated: Partial<UserAccount>) => void;
  toggleUserShiftStatus: (id: string) => void;
  toggleUserStatus: (id: string, nextStatus: 'Active' | 'Inactive' | 'Suspended') => void;
  setUserPermissionOverride: (userId: string, permissionCode: string, overrideType: 'ALLOW' | 'DENY' | 'RESET') => void;
  toggleUserStoreAccess: (userId: string, storeCode: string) => void;
  deleteUserAccount: (id: string) => void;
  inventory: InventoryItem[];
  addItem: (item: Omit<InventoryItem, 'id'>) => void;
  updateItem: (id: string, updated: Partial<InventoryItem>) => void;
  deleteItem: (id: string) => void;
  adjustStock: (id: string, qtyChange: number, reason: string) => void;
  transferStock: (fromStore: string, toStore: string, itemId: string, qty: number, customTransferPrice?: number, status?: 'Completed' | 'Draft') => void;
  updateTransferStatus: (id: string, nextStatus: 'Completed' | 'Cancelled') => void;
  defaultStoreTransferPrices: ProductStoreTransferPrice[];
  setDefaultStoreTransferPrice: (productId: string, storeCode: string, price: number) => void;
  stockTransfers: StockTransferRecord[];
  inventoryLedger: InventoryLedgerEntry[];
  repairsEnquiries: RepairEnquiry[];
  sales: SalesOrder[];
  addSale: (sale: Omit<SalesOrder, 'id' | 'orderNo' | 'createdAt' | 'period'>) => SalesOrder;
  purchases: PurchaseOrder[];
  addPurchase: (po: Omit<PurchaseOrder, 'id' | 'poNo' | 'createdAt'>) => void;
  updatePurchase: (id: string, updated: Partial<PurchaseOrder>) => void;
  deletePurchase: (id: string) => void;
  customers: Customer[];
  addCustomer: (cust: Omit<Customer, 'id' | 'totalSpend' | 'lastPurchase'>) => Customer;
  updateCustomer: (id: string, updated: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  vendors: Vendor[];
  addVendor: (vendor: Omit<Vendor, 'id' | 'code'>) => void;
  updateVendor: (id: string, updated: Partial<Vendor>) => void;
  deleteVendor: (id: string) => void;
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id' | 'referenceNo' | 'date'>) => void;
  auditLogs: AuditLog[];
  addAuditLog: (module: string, action: string, details: string) => void;
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
  const [branding, setBranding] = useState<AppBranding>(defaultBranding);
  const [selectedStore, setSelectedStoreState] = useState<string>('All Stores');
  const [datePeriod, setDatePeriod] = useState<string>('This Month');
  const [usersList, setUsersList] = useState<UserAccount[]>(initialUsers);
  const [storesList, setStoresList] = useState<StoreHub[]>(initialStoreHubs);
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
  const [currentUser, setCurrentUserState] = useState<{ id: string; name: string; email: string; role: UserAccount['role']; store: string; avatar: string; shiftStatus: 'On Shift' | 'On Leave'; avatarUrl?: string }>(unauthenticatedUser);

  // Restore active user session & enforce store scope lock
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem('cosko_active_session');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        const match = usersList.find((u) => (u.id === parsed.userId || u.email.toLowerCase() === (parsed.email || '').toLowerCase()) && u.status === 'Active');
        if (match) {
          const userObj = {
            id: match.id,
            name: match.name,
            email: match.email,
            role: match.role as any,
            store: match.store,
            avatar: match.name.substring(0, 2).toUpperCase(),
            shiftStatus: match.shiftStatus || 'On Shift',
            avatarUrl: match.avatarUrl,
          };
          setCurrentUserState(userObj);
          setAuthStatus('AUTHENTICATED');

          if (match.role !== 'Super Admin') {
            const effectiveStore = (match.store && match.store !== 'All Stores') ? match.store : (match.allowedStores?.[0] || 'BLR');
            userObj.store = effectiveStore;
            setSelectedStoreState(effectiveStore);
          }
          return;
        }
      }
      localStorage.removeItem('cosko_active_session');
      setCurrentUserState(unauthenticatedUser);
      setAuthStatus('UNAUTHENTICATED');
    } catch {
      localStorage.removeItem('cosko_active_session');
      setCurrentUserState(unauthenticatedUser);
      setAuthStatus('UNAUTHENTICATED');
    }
  }, [usersList]);

  // Realtime Live Supabase Change Synchronization
  useEffect(() => {
    if (!isSupabaseConfigured() || typeof window === 'undefined') return;

    try {
      const channel = supabase
        .channel('cosko-realtime-global')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public' },
          (payload: any) => {
            console.log('⚡ [Supabase Realtime Change Received]:', payload.eventType, payload.table);
            // Realtime toast indicator for live multi-user multi-store operations
            if (payload.table === 'sales' && payload.eventType === 'INSERT') {
              toast.info(`⚡ Live POS Sale Recorded on ${payload.new?.store_code || 'Store'}: ₹${payload.new?.grand_total || 0}`);
            } else if (payload.table === 'inventory' && payload.eventType === 'UPDATE') {
              toast.info(`⚡ Live Stock Updated on ${payload.new?.store || 'Store'}`);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.warn('Supabase Realtime Channel setup error:', err);
    }
  }, []);

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
      localStorage.setItem('cosko_active_session', JSON.stringify({ userId: user.id, email: user.email, role: user.role, store: user.store, timestamp: Date.now() }));
    } catch {}
  };

  const logoutUser = async () => {
    try {
      localStorage.removeItem('cosko_active_session');
      if (typeof window !== 'undefined') {
        const { createSupabaseBrowserClient } = await import('@/lib/supabase/client');
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
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
        localStorage.setItem('cosko_branding', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    addAuditLog('Settings', 'Update White-Label Branding', `Updated app name to "${updatedPartial.appName || branding.appName}"`);
    toast.success('Application branding updated successfully!');
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

  const addStoreHub = (storeData: Omit<StoreHub, 'id'>) => {
    const newStore: StoreHub = { ...storeData, id: `st-${Date.now()}` };
    setStoresList((prev) => [newStore, ...prev]);
    SupabaseClientService.syncStore(newStore);
    addAuditLog('Stores', 'Create Store Hub', `Created store hub "${newStore.name}" (${newStore.code})`);
    toast.success(`Store Hub "${newStore.name}" created!`);
  };

  const updateStoreHub = (id: string, updated: Partial<StoreHub>) => {
    setStoresList((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
    const target = storesList.find((s) => s.id === id);
    if (target) SupabaseClientService.syncStore({ ...target, ...updated });
    addAuditLog('Stores', 'Edit Store Hub', `Updated store #${id}`);
    toast.success('Store details updated');
  };

  const deleteStoreHub = (id: string) => {
    const s = storesList.find((st) => st.id === id);
    setStoresList((prev) => prev.filter((st) => st.id !== id));
    if (s) {
      SupabaseClientService.deleteStore(id);
      addAuditLog('Stores', 'Delete Store Hub', `Removed store hub "${s.name}" (${s.code})`);
      toast.success(`Removed store "${s.name}"`);
    }
  };

  const addUserAccount = (userData: Omit<UserAccount, 'id' | 'lastLogin' | 'permissions'>) => {
    const newUser: UserAccount = {
      ...userData,
      id: `usr-${Date.now()}`,
      lastLogin: 'Never',
      permissions: [],
    };
    setUsersList((prev) => [newUser, ...prev]);
    SupabaseClientService.syncProfile(newUser);
    addAuditLog('Users & Roles', 'Provision User', `Provisioned account for ${newUser.name} (${newUser.role})`);
    toast.success(`User "${newUser.name}" provisioned`);
  };

  const updateUserAccount = (id: string, updated: Partial<UserAccount>) => {
    setUsersList((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
    const updatedUser = usersList.find((u) => u.id === id);
    if (updatedUser) SupabaseClientService.syncProfile({ ...updatedUser, ...updated });
    addAuditLog('Users & Roles', 'Edit User Profile', `Updated user profile #${id}`);
    toast.success('User record updated');
  };

  const toggleUserShiftStatus = (id: string) => {
    setUsersList((prev) =>
      prev.map((u) => {
        if (u.id === id) {
          const nextShift = u.shiftStatus === 'On Shift' ? 'On Leave' : 'On Shift';
          const updatedUser = { ...u, shiftStatus: nextShift as any };
          SupabaseClientService.syncProfile(updatedUser);
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
          SupabaseClientService.syncProfile(updatedUser);
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

  const deleteUserAccount = (id: string) => {
    const u = usersList.find((usr) => usr.id === id);
    setUsersList((prev) => prev.filter((usr) => usr.id !== id));
    if (u) {
      SupabaseClientService.deleteProfile(id);
      addAuditLog('Users & Roles', 'Delete User Account', `Deleted account "${u.name}" (${u.email})`);
      toast.success(`Removed account "${u.name}"`);
    }
  };

  const addItem = (itemData: Omit<InventoryItem, 'id'>) => {
    const newItem: InventoryItem = {
      ...itemData,
      id: `item-${Date.now()}`,
      transferPrice: itemData.transferPrice || Math.round(itemData.costPrice * 1.18),
      warrantyMonths: itemData.warrantyMonths || 12,
      minStock: itemData.minStock || 10,
    };
    setInventory((prev) => [newItem, ...prev]);
    SupabaseClientService.syncProduct(newItem);
    addAuditLog('Inventory', 'Add Product', `Created new item "${newItem.name}" (${newItem.sku})`);
    toast.success(`Successfully added "${newItem.name}" to inventory`);
  };

  const updateItem = (id: string, updated: Partial<InventoryItem>) => {
    setInventory((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newItem = { ...item, ...updated };
          SupabaseClientService.syncProduct(newItem);
          addAuditLog('Inventory', 'Edit Product', `Updated details for "${newItem.name}" (${newItem.sku})`);
          return newItem;
        }
        return item;
      })
    );
    toast.success('Inventory item updated successfully');
  };

  const deleteItem = (id: string) => {
    const itemToDelete = inventory.find((i) => i.id === id);
    setInventory((prev) => prev.filter((i) => i.id !== id));
    if (itemToDelete) {
      SupabaseClientService.deleteProduct(id);
      addAuditLog('Inventory', 'Delete Product', `Deleted item "${itemToDelete.name}" (${itemToDelete.sku})`);
      toast.success(`Removed "${itemToDelete.name}" from inventory`);
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
          SupabaseClientService.syncProduct(newItem);
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

  /**
   * CENTRAL -> STORE TRANSFER WITH CENTRAL TRANSFER PROFIT / LOSS CALCULATION
   */
  const transferStock = (fromStore: string, toStore: string, itemId: string, qty: number, customTransferPrice?: number, status: 'Completed' | 'Draft' = 'Completed') => {
    const sourceItem = inventory.find((i) => i.id === itemId || i.sku === itemId);
    if (!sourceItem) {
      toast.error('Source item not found for transfer!');
      return;
    }

    if (sourceItem.qtyOnHand < qty) {
      toast.error(`Insufficient stock in ${fromStore} (${sourceItem.qtyOnHand} units available)`);
      return;
    }

    const transferPrice = customTransferPrice !== undefined ? customTransferPrice : (sourceItem.transferPrice || Math.round(sourceItem.costPrice * 1.18));
    const purchaseCost = sourceItem.costPrice;
    const transferProfitPerUnit = transferPrice - purchaseCost;
    const totalTransferProfit = transferProfitPerUnit * qty;

    if (status === 'Completed') {
      // 1. Update source inventory (e.g. CENTRAL)
      setInventory((prev) =>
        prev.map((item) => {
          if (item.id === sourceItem.id) {
            const newItem = { ...item, qtyOnHand: item.qtyOnHand - qty, lastMovement: 'Transfer Out' };
            SupabaseClientService.syncProduct(newItem);
            return newItem;
          }
          return item;
        })
      );

      // 2. Update destination inventory (e.g. BLR)
      let destItemExists = false;
      setInventory((prev) =>
        prev.map((item) => {
          if (item.sku === sourceItem.sku && item.store === toStore) {
            destItemExists = true;
            const newItem = { ...item, qtyOnHand: item.qtyOnHand + qty, lastMovement: 'Transfer In' };
            SupabaseClientService.syncProduct(newItem);
            return newItem;
          }
          return item;
        })
      );

      if (!destItemExists) {
        const newDestItem: InventoryItem = {
          ...sourceItem,
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          store: toStore,
          qtyOnHand: qty,
          lastMovement: 'Transfer In',
        };
        setInventory((prev) => [...prev, newDestItem]);
        SupabaseClientService.syncProduct(newDestItem);
      }
    }

    // 3. Record in stockTransfers table
    const transferRecord: StockTransferRecord = {
      id: `tr-${Date.now()}`,
      transferNo: `TR-2026-${Math.floor(100 + Math.random() * 900)}`,
      sourceStore: fromStore,
      destStore: toStore,
      productId: sourceItem.id,
      sku: sourceItem.sku,
      productName: sourceItem.name,
      qty,
      purchaseCost,
      transferPrice,
      transferProfit: totalTransferProfit,
      status,
      createdBy: currentUser.name || 'Super Admin',
      createdAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    };
    setStockTransfers((prev) => [transferRecord, ...prev]);

    if (status === 'Completed') {
      // 4. Log two ledger entries: TRANSFER_OUT from source, TRANSFER_IN to destination
      const outLedger: InventoryLedgerEntry = {
        id: `led-${Date.now()}-out`,
        productId: sourceItem.id,
        sku: sourceItem.sku,
        productName: sourceItem.name,
        storeCode: fromStore,
        movementType: 'TRANSFER_OUT',
        quantity: -qty,
        unitCost: purchaseCost,
        totalValue: qty * purchaseCost,
        fromLocation: fromStore,
        toLocation: toStore,
        referenceNo: transferRecord.transferNo,
        createdBy: currentUser.name || 'Admin',
        createdAt: new Date().toISOString(),
      };

      const inLedger: InventoryLedgerEntry = {
        id: `led-${Date.now()}-in`,
        productId: sourceItem.id,
        sku: sourceItem.sku,
        productName: sourceItem.name,
        storeCode: toStore,
        movementType: 'TRANSFER_IN',
        quantity: qty,
        unitCost: transferPrice,
        totalValue: qty * transferPrice,
        fromLocation: fromStore,
        toLocation: toStore,
        referenceNo: transferRecord.transferNo,
        createdBy: currentUser.name || 'Admin',
        createdAt: new Date().toISOString(),
      };

      setInventoryLedger((prev) => [outLedger, inLedger, ...prev]);
    }

    addAuditLog('Inventory', 'Stock Transfer', `Transferred ${qty}x ${sourceItem.name} (${fromStore} → ${toStore}) @ ₹${transferPrice}/unit. Central Profit: ₹${totalTransferProfit}. Status: ${status}`);
    toast.success(`Transfer ${status === 'Completed' ? 'completed' : 'saved as draft'}! Central Profit: ₹${totalTransferProfit.toLocaleString('en-IN')}`);
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

      // Execute atomic stock movement
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

  /**
   * POS CHECKOUT WITH SEQUENTIAL CS26 INVOICING, WARRANTY & AUTOMATIC STORE STOCK DEDUCTION
   */
  const addSale = (saleData: Omit<SalesOrder, 'id' | 'orderNo' | 'createdAt' | 'period'>): SalesOrder => {
    const storeCode = saleData.store || selectedStore || 'BLR';
    const storeNumeric = storeCode === 'BLR' ? '001' : storeCode === 'HYD' ? '002' : storeCode === 'DEL' ? '003' : storeCode === 'MUM' ? '004' : '009';
    
    // Increment sequential invoice counter for store
    const nextSeq = (invoiceCounters[storeCode] || 1) + 1;
    setInvoiceCounters((prev) => ({ ...prev, [storeCode]: nextSeq }));
    const formattedOrderNo = `CS26${storeNumeric}${nextSeq}`;

    // Calculate max warranty date across items
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

    // 1. Automatically deduct store inventory & log movement ledger
    setInventory((prev) =>
      prev.map((item) => {
        const sold = saleData.items.find((si) => si.itemId === item.id || si.name === item.name);
        if (sold && (item.store === storeCode || storeCode === 'All Stores')) {
          const newQty = Math.max(0, item.qtyOnHand - sold.qty);
          const newItem = { ...item, qtyOnHand: newQty, lastMovement: 'Just now' };
          SupabaseClientService.syncProduct(newItem);

          // Log SALE ledger entry
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

    // 2. Link transaction customer without overwriting master profile
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
        SupabaseClientService.syncCustomer(newCust);
        return [newCust, ...prev];
      }
      return prev;
    });

    setSales((prev) => [newSale, ...prev]);
    SupabaseClientService.syncSale({ ...newSale, cashierName: currentUser.name });
    const photoMsg = saleData.salePhotos && saleData.salePhotos.length > 0 ? ` with ${saleData.salePhotos.length} photo(s)` : '';
    addAuditLog('Sales', 'POS Sale Checkout', `Completed order ${newSale.orderNo} for ₹${newSale.total.toLocaleString('en-IN')}${photoMsg}`);
    toast.success(`Invoice ${newSale.orderNo} generated successfully!`);
    return newSale;
  };

  const addPurchase = (poData: Omit<PurchaseOrder, 'id' | 'poNo' | 'createdAt'>) => {
    const newPO: PurchaseOrder = {
      ...poData,
      id: `po-${Date.now()}`,
      poNo: `PO-2026-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    };
    setPurchases((prev) => [newPO, ...prev]);

    // If purchase order is received on creation, credit Central Inventory
    if (newPO.status === 'Received') {
      creditCentralStockForPO(newPO);
    }

    addAuditLog('Purchases', 'Create Purchase Order', `Generated ${newPO.poNo} for ${newPO.vendorName} (₹${newPO.totalAmount.toLocaleString('en-IN')})`);
    toast.success(`Purchase Order ${newPO.poNo} created successfully!`);
  };

  const updatePurchase = (id: string, updated: Partial<PurchaseOrder>) => {
    const targetPO = purchases.find((p) => p.id === id);
    const nextStatus = updated.status;

    setPurchases((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));

    // When PO transitions to 'Received', credit Central Warehouse Inventory automatically
    if (targetPO && targetPO.status !== 'Received' && nextStatus === 'Received') {
      creditCentralStockForPO({ ...targetPO, ...updated });
    }

    addAuditLog('Purchases', 'Edit Purchase Order', `Updated PO #${id}`);
    toast.success('Purchase Order updated successfully');
  };

  /**
   * CREDITS CENTRAL WAREHOUSE STOCK UPON PO RECEIPT & LOGS PURCHASE LEDGER
   */
  const creditCentralStockForPO = (po: PurchaseOrder) => {
    po.items.forEach((poItem) => {
      let foundInCentral = false;

      setInventory((prev) =>
        prev.map((invItem) => {
          if (invItem.store === 'CENTRAL' && (invItem.name === poItem.name || invItem.sku === poItem.sku)) {
            foundInCentral = true;
            const updatedInv = { ...invItem, qtyOnHand: invItem.qtyOnHand + poItem.qty, lastMovement: 'PO Received' };
            SupabaseClientService.syncProduct(updatedInv);
            return updatedInv;
          }
          return invItem;
        })
      );

      if (!foundInCentral) {
        const newCentralItem: InventoryItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          sku: poItem.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
          barcode: `890123456${Math.floor(1000 + Math.random() * 9000)}`,
          name: poItem.name,
          brand: 'Generic',
          category: 'Electricals',
          subcategory: 'General',
          store: 'CENTRAL',
          qtyOnHand: poItem.qty,
          reorderPt: 10,
          costPrice: poItem.unitCost,
          transferPrice: Math.round(poItem.unitCost * 1.18),
          sellingPrice: Math.round(poItem.unitCost * 1.45),
          mrp: Math.round(poItem.unitCost * 1.60),
          hsn: '8471',
          taxRate: 18,
          warrantyMonths: 12,
          minStock: 10,
          status: 'active',
          fifoLots: 1,
          lastMovement: 'PO Received',
        };
        setInventory((prev) => [...prev, newCentralItem]);
        SupabaseClientService.syncProduct(newCentralItem);
      }

      // Log PURCHASE ledger entry
      const ledgerEntry: InventoryLedgerEntry = {
        id: `led-${Date.now()}-po`,
        productId: `item-${po.id}`,
        sku: poItem.sku || `SKU-${poItem.name.substring(0, 3).toUpperCase()}`,
        productName: poItem.name,
        storeCode: 'CENTRAL',
        movementType: 'PURCHASE',
        quantity: poItem.qty,
        unitCost: poItem.unitCost,
        totalValue: poItem.qty * poItem.unitCost,
        fromLocation: `Vendor: ${po.vendorName}`,
        toLocation: 'CENTRAL',
        referenceNo: po.poNo,
        createdBy: currentUser.name || 'Procurement',
        createdAt: new Date().toISOString(),
      };
      setInventoryLedger((prev) => [ledgerEntry, ...prev]);
    });

    toast.success(`Credited ${po.items.reduce((acc, i) => acc + i.qty, 0)} units to Central Warehouse Stock`);
  };

  const deletePurchase = (id: string) => {
    const poToDelete = purchases.find((p) => p.id === id);
    setPurchases((prev) => prev.filter((p) => p.id !== id));
    if (poToDelete) {
      addAuditLog('Purchases', 'Delete Purchase Order', `Deleted PO ${poToDelete.poNo}`);
      toast.success(`Removed Purchase Order ${poToDelete.poNo}`);
    }
  };

  const addCustomer = (custData: Omit<Customer, 'id' | 'totalSpend' | 'lastPurchase'>): Customer => {
    const newCust: Customer = {
      ...custData,
      id: `cust-${Date.now()}`,
      totalSpend: 0,
      lastPurchase: 'Never',
    };
    setCustomers((prev) => [newCust, ...prev]);
    SupabaseClientService.syncCustomer(newCust);
    addAuditLog('Customers', 'Add Customer', `Registered customer "${newCust.name}"`);
    toast.success(`Customer "${newCust.name}" registered`);
    return newCust;
  };

  const updateCustomer = (id: string, updated: Partial<Customer>) => {
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
    const updatedCust = customers.find((c) => c.id === id);
    if (updatedCust) SupabaseClientService.syncCustomer({ ...updatedCust, ...updated });
    addAuditLog('Customers', 'Edit Customer', `Updated profile for customer #${id}`);
    toast.success('Customer record updated');
  };

  const deleteCustomer = (id: string) => {
    const cust = customers.find((c) => c.id === id);
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    if (cust) {
      addAuditLog('Customers', 'Delete Customer', `Removed customer "${cust.name}"`);
      toast.success(`Customer "${cust.name}" removed`);
    }
  };

  const addVendor = (vendorData: Omit<Vendor, 'id' | 'code'>) => {
    const newVendor: Vendor = {
      ...vendorData,
      id: `vend-${Date.now()}`,
      code: `VND-${Math.floor(1000 + Math.random() * 9000)}`,
    };
    setVendors((prev) => [newVendor, ...prev]);
    SupabaseClientService.syncVendor(newVendor);
    addAuditLog('Vendors', 'Add Vendor', `Onboarded supplier "${newVendor.name}"`);
    toast.success(`Vendor "${newVendor.name}" onboarded`);
  };

  const updateVendor = (id: string, updated: Partial<Vendor>) => {
    setVendors((prev) => prev.map((v) => (v.id === id ? { ...v, ...updated } : v)));
    const updatedVend = vendors.find((v) => v.id === id);
    if (updatedVend) SupabaseClientService.syncVendor({ ...updatedVend, ...updated });
    addAuditLog('Vendors', 'Edit Vendor', `Updated supplier #${id}`);
    toast.success('Vendor profile updated');
  };

  const deleteVendor = (id: string) => {
    const v = vendors.find((vend) => vend.id === id);
    setVendors((prev) => prev.filter((vend) => vend.id !== id));
    if (v) {
      addAuditLog('Vendors', 'Delete Vendor', `Removed supplier "${v.name}"`);
      toast.success(`Vendor "${v.name}" removed`);
    }
  };

  const addExpense = (expenseData: Omit<Expense, 'id' | 'referenceNo' | 'date'>) => {
    const newExp: Expense = {
      ...expenseData,
      id: `exp-${Date.now()}`,
      referenceNo: `EXP-2026-${Math.floor(100 + Math.random() * 900)}`,
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    };
    setExpenses((prev) => [newExp, ...prev]);
    SupabaseClientService.syncExpense({ ...newExp, spentBy: currentUser.name });
    addAuditLog('Expenses', 'Create Expense Record', `Logged expense "${newExp.description}" for ₹${newExp.amount.toLocaleString('en-IN')} (${newExp.store})`);
    toast.success(`Expense record ${newExp.referenceNo} logged`);
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
    SupabaseClientService.syncAuditLog(newLog);
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
        auditLogs,
        addAuditLog,
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
