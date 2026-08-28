'use client';
import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { SupabaseClientService, supabase } from '@/lib/supabase';

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
  barcode: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  store: string;
  qtyOnHand: number;
  reorderPt: number;
  costPrice: number;
  sellingPrice: number;
  mrp: number;
  hsn: string;
  taxRate: number;
  status: 'active' | 'inactive' | 'discontinued';
  fifoLots: number;
  lastMovement: string;
  images?: string[];
  primaryImage?: string;
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
  items: { itemId: string; name: string; qty: number; unitPrice: number; taxRate: number }[];
  subtotal: number;
  taxTotal: number;
  discount: number;
  total: number;
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Credit';
  status: 'Completed' | 'Refunded' | 'Pending';
  createdAt: string;
  period: 'Today' | 'Yesterday' | 'Last 7 Days' | 'This Month' | 'Last Month' | 'This Quarter' | 'This Year';
  salePhotos?: SalePhoto[];
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  vendorName: string;
  store: string;
  items: { name: string; qty: number; unitCost: number }[];
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

const initialInventory: InventoryItem[] = [
  { id: 'item-001', sku: 'SKU-0091', barcode: '8901234567890', name: 'Crompton Fan Regulator 5-Speed', brand: 'Crompton', category: 'Electricals', subcategory: 'Fans', store: 'DEL', qtyOnHand: 0, reorderPt: 8, costPrice: 320, sellingPrice: 485, mrp: 550, hsn: '84145990', taxRate: 18, status: 'active', fifoLots: 0, lastMovement: '09 Aug 2026' },
  { id: 'item-002', sku: 'SKU-0218', barcode: '8901234567891', name: 'Philips LED 9W Warm White (Pack of 6)', brand: 'Philips', category: 'Lighting', subcategory: 'LED Bulbs', store: 'HYD', qtyOnHand: 5, reorderPt: 20, costPrice: 480, sellingPrice: 680, mrp: 750, hsn: '85395000', taxRate: 12, status: 'active', fifoLots: 2, lastMovement: '11 Aug 2026' },
  { id: 'item-003', sku: 'SKU-0312', barcode: '8901234567892', name: 'Anchor Roma 3-Pin 6A Plug Top', brand: 'Anchor', category: 'Electricals', subcategory: 'Plugs & Sockets', store: 'BLR', qtyOnHand: 142, reorderPt: 50, costPrice: 28, sellingPrice: 45, mrp: 55, hsn: '85364900', taxRate: 18, status: 'active', fifoLots: 4, lastMovement: '12 Aug 2026' },
  { id: 'item-004', sku: 'SKU-0562', barcode: '8901234567893', name: 'Polycab 1.5 Sq mm FR Wire 90m Coil', brand: 'Polycab', category: 'Wiring', subcategory: 'FR Wires', store: 'HYD', qtyOnHand: 3, reorderPt: 12, costPrice: 1850, sellingPrice: 2400, mrp: 2650, hsn: '85444900', taxRate: 18, status: 'active', fifoLots: 1, lastMovement: '10 Aug 2026' },
  { id: 'item-005', sku: 'SKU-0834', barcode: '8901234567894', name: 'Havells Crabtree 6A Switch 1-Way', brand: 'Havells', category: 'Electricals', subcategory: 'Switches', store: 'BLR', qtyOnHand: 0, reorderPt: 15, costPrice: 65, sellingPrice: 95, mrp: 115, hsn: '85365000', taxRate: 18, status: 'active', fifoLots: 0, lastMovement: '07 Aug 2026' },
  { id: 'item-006', sku: 'SKU-1042', barcode: '8901234567895', name: 'Bosch GSR 12V-15 Cordless Drill', brand: 'Bosch', category: 'Power Tools', subcategory: 'Drills', store: 'BLR', qtyOnHand: 2, reorderPt: 10, costPrice: 4800, sellingPrice: 6800, mrp: 7500, hsn: '84672900', taxRate: 18, status: 'active', fifoLots: 1, lastMovement: '08 Aug 2026' },
  { id: 'item-007', sku: 'SKU-1198', barcode: '8901234567896', name: 'Anchor Roma 3-Pin 16A Socket', brand: 'Anchor', category: 'Electricals', subcategory: 'Plugs & Sockets', store: 'DEL', qtyOnHand: 8, reorderPt: 25, costPrice: 42, sellingPrice: 68, mrp: 80, hsn: '85364900', taxRate: 18, status: 'active', fifoLots: 2, lastMovement: '11 Aug 2026' },
  { id: 'item-008', sku: 'SKU-1341', barcode: '8901234567897', name: 'Syska LED Strip Light 5m RGB', brand: 'Syska', category: 'Lighting', subcategory: 'Strip Lights', store: 'HYD', qtyOnHand: 24, reorderPt: 15, costPrice: 680, sellingPrice: 950, mrp: 1100, hsn: '85395000', taxRate: 12, status: 'active', fifoLots: 3, lastMovement: '12 Aug 2026' },
  { id: 'item-009', sku: 'SKU-1512', barcode: '8901234567898', name: 'Legrand MCB 32A Single Pole', brand: 'Legrand', category: 'Circuit Protection', subcategory: 'MCBs', store: 'DEL', qtyOnHand: 56, reorderPt: 30, costPrice: 185, sellingPrice: 270, mrp: 320, hsn: '85362000', taxRate: 18, status: 'active', fifoLots: 5, lastMovement: '09 Aug 2026' },
  { id: 'item-010', sku: 'SKU-1688', barcode: '8901234567899', name: 'V-Guard Voltage Stabilizer 4kVA', brand: 'V-Guard', category: 'Power Conditioning', subcategory: 'Stabilizers', store: 'BLR', qtyOnHand: 11, reorderPt: 8, costPrice: 3200, sellingPrice: 4500, mrp: 5200, hsn: '85044000', taxRate: 18, status: 'active', fifoLots: 2, lastMovement: '10 Aug 2026' },
  { id: 'item-011', sku: 'SKU-1834', barcode: '8901234567900', name: 'Finolex 2.5 Sq mm FR PVC Wire 90m', brand: 'Finolex', category: 'Wiring', subcategory: 'FR Wires', store: 'HYD', qtyOnHand: 19, reorderPt: 20, costPrice: 2100, sellingPrice: 2800, mrp: 3100, hsn: '85444900', taxRate: 18, status: 'active', fifoLots: 3, lastMovement: '11 Aug 2026' },
  { id: 'item-012', sku: 'SKU-2001', barcode: '8901234567901', name: 'Stanley 10-Piece Screwdriver Set', brand: 'Stanley', category: 'Hand Tools', subcategory: 'Screwdrivers', store: 'DEL', qtyOnHand: 34, reorderPt: 15, costPrice: 420, sellingPrice: 620, mrp: 720, hsn: '82059900', taxRate: 12, status: 'active', fifoLots: 2, lastMovement: '08 Aug 2026' },
  { id: 'item-013', sku: 'SKU-2189', barcode: '8901234567902', name: 'Halonix 18W LED Batten Light 2FT', brand: 'Halonix', category: 'Lighting', subcategory: 'Batten Lights', store: 'BLR', qtyOnHand: 67, reorderPt: 30, costPrice: 240, sellingPrice: 360, mrp: 420, hsn: '94054090', taxRate: 12, status: 'active', fifoLots: 4, lastMovement: '12 Aug 2026' },
  { id: 'item-014', sku: 'SKU-2341', barcode: '8901234567903', name: 'Schneider 32A 3-Phase MCB', brand: 'Schneider', category: 'Circuit Protection', subcategory: 'MCBs', store: 'HYD', qtyOnHand: 18, reorderPt: 10, costPrice: 680, sellingPrice: 980, mrp: 1150, hsn: '85362000', taxRate: 18, status: 'inactive', fifoLots: 2, lastMovement: '03 Aug 2026' },
  { id: 'item-015', sku: 'SKU-2498', barcode: '8901234567904', name: 'Makita 750W Angle Grinder 4.5"', brand: 'Makita', category: 'Power Tools', subcategory: 'Grinders', store: 'BLR', qtyOnHand: 7, reorderPt: 5, costPrice: 3400, sellingPrice: 4800, mrp: 5500, hsn: '84672900', taxRate: 18, status: 'active', fifoLots: 1, lastMovement: '07 Aug 2026' },
  { id: 'item-016', sku: 'SKU-2138', barcode: '8901234567905', name: 'Havells Gold Fan 1200mm', brand: 'Havells', category: 'Electricals', subcategory: 'Fans', store: 'BLR', qtyOnHand: 9, reorderPt: 3, costPrice: 1800, sellingPrice: 2499, mrp: 2800, hsn: '84145990', taxRate: 18, status: 'active', fifoLots: 2, lastMovement: 'Today' },
];

const initialSales: SalesOrder[] = [
  { id: 'sale-101', orderNo: 'ORD-2026-8821', customerName: 'Rajesh Kumar Electronics', customerPhone: '+91 98765 43210', store: 'BLR', items: [{ itemId: 'item-003', name: 'Anchor Roma 3-Pin 6A Plug Top', qty: 20, unitPrice: 45, taxRate: 18 }], subtotal: 900, taxTotal: 162, discount: 0, total: 1062, paymentMethod: 'UPI', status: 'Completed', createdAt: '28 Aug 2026 10:15 AM', period: 'Today' },
  { id: 'sale-102', orderNo: 'ORD-2026-8822', customerName: 'Priya Sharma Buildcon', customerPhone: '+91 98111 22334', store: 'HYD', items: [{ itemId: 'item-004', name: 'Polycab 1.5 Sq mm FR Wire 90m Coil', qty: 5, unitPrice: 2400, taxRate: 18 }], subtotal: 12000, taxTotal: 2160, discount: 500, total: 13660, paymentMethod: 'Card', status: 'Completed', createdAt: '28 Aug 2026 11:30 AM', period: 'Today' },
  { id: 'sale-103', orderNo: 'ORD-2026-8823', customerName: 'Apex Electrical Solutions', customerPhone: '+91 97222 33445', store: 'DEL', items: [{ itemId: 'item-009', name: 'Legrand MCB 32A Single Pole', qty: 12, unitPrice: 270, taxRate: 18 }], subtotal: 3240, taxTotal: 583.2, discount: 0, total: 3823.2, paymentMethod: 'Cash', status: 'Completed', createdAt: '28 Aug 2026 01:05 PM', period: 'Today' },
  { id: 'sale-104', orderNo: 'ORD-2026-8819', customerName: 'Mohammad Yunus', customerPhone: '+91 97432 50071', store: 'BLR', items: [{ itemId: 'item-016', name: 'Havells Gold Fan 1200mm', qty: 2, unitPrice: 2499, taxRate: 18 }], subtotal: 4998, taxTotal: 899.64, discount: 100, total: 5797.64, paymentMethod: 'UPI', status: 'Completed', createdAt: '27 Aug 2026 04:20 PM', period: 'Yesterday' },
  { id: 'sale-105', orderNo: 'ORD-2026-8800', customerName: 'Southern Infra Tech', customerPhone: '+91 94444 11223', store: 'HYD', items: [{ itemId: 'item-010', name: 'V-Guard Voltage Stabilizer 4kVA', qty: 4, unitPrice: 4500, taxRate: 18 }], subtotal: 18000, taxTotal: 3240, discount: 0, total: 21240, paymentMethod: 'Credit', status: 'Completed', createdAt: '22 Aug 2026 02:10 PM', period: 'This Month' },
];

const initialPurchases: PurchaseOrder[] = [
  { id: 'po-301', poNo: 'PO-2026-0041', vendorName: 'Polycab India Ltd', store: 'HYD', items: [{ name: 'Polycab 1.5 Sq mm FR Wire 90m Coil', qty: 25, unitCost: 1850 }], totalAmount: 46250, status: 'Received', paymentStatus: 'Paid', expectedDate: '25 Aug 2026', createdAt: '20 Aug 2026' },
  { id: 'po-302', poNo: 'PO-2026-0042', vendorName: 'Havells India Limited', store: 'BLR', items: [{ name: 'Havells Crabtree 6A Switch 1-Way', qty: 100, unitCost: 65 }], totalAmount: 6500, status: 'Sent', paymentStatus: 'Unpaid', expectedDate: '30 Aug 2026', createdAt: '26 Aug 2026' },
];

const initialCustomers: Customer[] = [
  { id: 'cust-1', name: 'Rajesh Kumar Electronics', email: 'rajesh@rk-elec.com', phone: '+91 98765 43210', city: 'Bengaluru', tier: 'VIP', totalSpend: 245000, creditBalance: 12500, lastPurchase: '28 Aug 2026' },
  { id: 'cust-2', name: 'Priya Sharma Buildcon', email: 'priya@sharmabuild.in', phone: '+91 98111 22334', city: 'Hyderabad', tier: 'Regular', totalSpend: 182000, creditBalance: 0, lastPurchase: '28 Aug 2026' },
  { id: 'cust-3', name: 'Apex Electrical Solutions', email: 'contact@apexelec.com', phone: '+91 97222 33445', city: 'Delhi', tier: 'Regular', totalSpend: 96400, creditBalance: 4200, lastPurchase: '28 Aug 2026' },
  { id: 'cust-4', name: 'Mohammad Yunus', email: 'mohammedhasanudyavar1@gmail.com', phone: '+91 97432 50071', city: 'Bengaluru', tier: 'VIP', totalSpend: 5797, creditBalance: 0, lastPurchase: '27 Aug 2026' },
];

const initialVendors: Vendor[] = [
  { id: 'vend-1', code: 'VND-1001', name: 'Polycab India Ltd', contactPerson: 'Suresh Menon', email: 'orders@polycab.com', phone: '+91 80 2345 6789', category: 'Wiring & Cables', outstandingPayable: 46250, rating: 4.8, leadTimeDays: 3 },
  { id: 'vend-2', code: 'VND-1002', name: 'Havells India Limited', contactPerson: 'Vikram Joshi', email: 'b2b@havells.com', phone: '+91 11 4567 8901', category: 'Switchgear & Lighting', outstandingPayable: 185000, rating: 4.9, leadTimeDays: 4 },
  { id: 'vend-3', code: 'VND-1003', name: 'Philips India Commercial', contactPerson: 'Ananya Roy', email: 'sales@lighting.philips.in', phone: '+91 22 6789 0123', category: 'Lighting Solutions', outstandingPayable: 34000, rating: 4.7, leadTimeDays: 2 },
];

const initialExpenses: Expense[] = [
  { id: 'exp-1', referenceNo: 'EXP-2026-081', category: 'Store Rent', description: 'Monthly lease for Bengaluru Central Hub', store: 'BLR', amount: 85000, paymentMethod: 'Bank Transfer', status: 'Approved', date: '01 Aug 2026' },
  { id: 'exp-2', referenceNo: 'EXP-2026-082', category: 'Utilities & Power', description: 'Electricity bill for Hyderabad Warehouse', store: 'HYD', amount: 24500, paymentMethod: 'Direct Debit', status: 'Approved', date: '15 Aug 2026' },
  { id: 'exp-3', referenceNo: 'EXP-2026-083', category: 'Logistics & Freight', description: 'Inter-store inventory transfer freight DEL to BLR', store: 'DEL', amount: 12400, paymentMethod: 'Corporate Card', status: 'Pending', date: '26 Aug 2026' },
];

const initialUsers: UserAccount[] = [
  { id: 'usr-1', name: 'Super Admin', email: 'cosko@gmail.com', password: 'Cosko2026@', phone: '+91 98765 00000', role: 'Super Admin', securityLevel: 100, store: 'All Stores', allowedStores: ['BLR', 'HYD', 'DEL'], status: 'Active', shiftStatus: 'On Shift', lastLogin: 'Just now', permissions: ['ALL_PERMISSIONS', 'super_admin.manage', 'roles.manage', 'permissions.manage', 'security.manage', 'audit_logs.enterprise_view', 'settings.global_manage'] },
  { id: 'usr-2', name: 'Sneha Patel', email: 'sneha@cosko.com', password: 'Password2026@', phone: '+91 80 2555 1234', role: 'Store Manager', securityLevel: 80, store: 'BLR', allowedStores: ['BLR'], status: 'Active', shiftStatus: 'On Shift', lastLogin: '1 hour ago', permissions: ['dashboard.view', 'sales.view', 'sales.create', 'sales.discount', 'sales.refund', 'inventory.view', 'inventory.add', 'inventory.edit', 'inventory.adjust', 'inventory.transfer', 'purchases.view', 'purchases.create', 'customers.view', 'customers.edit', 'vendors.view', 'expenses.view', 'accounting.view', 'reports.view', 'employees.view', 'stores.view'] },
  { id: 'usr-3', name: 'Rohan Sharma', email: 'rohan@cosko.com', password: 'Password2026@', phone: '+91 11 4100 9988', role: 'Inventory Auditor', securityLevel: 60, store: 'DEL', allowedStores: ['DEL'], status: 'Active', shiftStatus: 'On Shift', lastLogin: '3 hours ago', permissions: ['dashboard.view', 'inventory.view', 'inventory.add', 'inventory.edit', 'inventory.adjust', 'purchases.view', 'purchases.receive_grn', 'vendors.view', 'reports.view'] },
  { id: 'usr-4', name: 'Karan Verma', email: 'karan@cosko.com', password: 'Password2026@', phone: '+91 40 6677 8899', role: 'POS Cashier', securityLevel: 20, store: 'HYD', allowedStores: ['HYD'], status: 'Active', shiftStatus: 'On Shift', lastLogin: 'Yesterday', permissions: ['sales.view', 'sales.create', 'customers.view'] },
  { id: 'usr-5', name: 'Vikram Singh', email: 'vikram@cosko.com', password: 'Password2026@', phone: '+91 99000 11223', role: 'POS Cashier', securityLevel: 20, store: 'BLR', allowedStores: ['BLR'], status: 'Suspended', shiftStatus: 'On Leave', lastLogin: '5 days ago', permissions: ['sales.view'] },
  { id: 'usr-6', name: 'Pooja Deshmukh', email: 'pooja@cosko.com', password: 'Password2026@', phone: '+91 98765 43210', role: 'Sales Executive', securityLevel: 40, store: 'BLR', allowedStores: ['BLR'], status: 'Active', shiftStatus: 'On Shift', lastLogin: '2 hours ago', permissions: ['sales.view', 'sales.create', 'sales.pay_cash', 'sales.pay_upi', 'sales.pay_card', 'sales.print_receipt', 'sales.history', 'sales.attach_photo', 'customers.view', 'customers.add'] },
  { id: 'usr-7', name: 'Rakesh Verma', email: 'rakesh@cosko.com', password: 'Password2026@', phone: '+91 98222 33445', role: 'Store Manager', securityLevel: 80, store: 'MUM', allowedStores: ['MUM'], status: 'Active', shiftStatus: 'On Shift', lastLogin: 'Today', permissions: ['dashboard.view', 'sales.view', 'sales.create', 'inventory.view', 'inventory.add', 'inventory.edit', 'inventory.adjust', 'inventory.transfer', 'purchases.view', 'purchases.create', 'customers.view', 'customers.edit', 'expenses.view', 'reports.view', 'employees.view', 'stores.view'] },
];

const initialAuditLogs: AuditLog[] = [
  { id: 'log-1', timestamp: '28 Aug 2026 14:10:02', userName: 'Super Admin', userRole: 'Super Admin', module: 'Inventory', action: 'Stock Adjustment', details: 'Adjusted SKU-0312 qty from +20 to +142 (Physical Audit)', ipAddress: '192.168.1.14' },
  { id: 'log-2', timestamp: '28 Aug 2026 11:30:15', userName: 'Super Admin', userRole: 'Super Admin', module: 'Sales', action: 'POS Sale Checkout', details: 'Completed Order ORD-2026-8822 (₹13,660)', ipAddress: '192.168.1.42' },
  { id: 'log-3', timestamp: '28 Aug 2026 09:15:00', userName: 'Super Admin', userRole: 'Super Admin', module: 'Authentication', action: 'User Login', details: 'Super Admin login session initialized for cosko@gmail.com', ipAddress: '192.168.1.14' },
];

const initialNotifications: NotificationItem[] = [
  { id: 'notif-1', title: 'Low Stock Alert', message: '38 items across stores are below reorder threshold.', time: '10 min ago', type: 'warning', read: false },
  { id: 'notif-2', title: 'New PO Received', message: 'PO-2026-0041 marked received at Hyderabad store.', time: '2 hours ago', type: 'success', read: false },
];

const initialStoreHubs: StoreHub[] = [
  { id: 'st-blr', code: 'BLR', name: 'Bengaluru Central Hub', city: 'Bengaluru', address: 'Indiranagar 100ft Rd, Bengaluru', manager: 'Sneha Patel', phone: '+91 80 2555 1234', registers: 4, skusCount: 1420, monthlyRevenue: 1450000, status: 'Active' },
  { id: 'st-hyd', code: 'HYD', name: 'Hyderabad Warehouse & Outlet', city: 'Hyderabad', address: 'Hitech City Phase 2, Hyderabad', manager: 'Karan Verma', phone: '+91 40 6677 8899', registers: 3, skusCount: 980, monthlyRevenue: 1120000, status: 'Active' },
  { id: 'st-del', code: 'DEL', name: 'Delhi NCR Fulfillment Center', city: 'Delhi', address: 'Okhla Industrial Area Ph-III, New Delhi', manager: 'Rohan Sharma', phone: '+91 11 4100 9988', registers: 5, skusCount: 2100, monthlyRevenue: 980000, status: 'Active' },
  { id: 'st-mum', code: 'MUM', name: 'Mumbai Commercial Hub', city: 'Mumbai', address: 'Bandra Kurla Complex, Mumbai', manager: 'Rakesh Verma', phone: '+91 22 6688 9900', registers: 4, skusCount: 1200, monthlyRevenue: 1350000, status: 'Active' },
];

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
  transferStock: (fromStore: string, toStore: string, itemId: string, qty: number) => void;
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

  // Load persistent branding, stores, and users from localStorage on client side
  useEffect(() => {
    try {
      const savedBranding = localStorage.getItem('cosko_branding');
      if (savedBranding) setBranding(JSON.parse(savedBranding));

      const savedStores = localStorage.getItem('cosko_stores_list');
      if (savedStores) setStoresList(JSON.parse(savedStores));

      const savedUsers = localStorage.getItem('cosko_users_list');
      if (savedUsers) setUsersList(JSON.parse(savedUsers));
    } catch {
      // Fallback to defaults
    }
  }, []);

  const saveStoresToStorage = (updatedStores: StoreHub[]) => {
    setStoresList(updatedStores);
    try {
      localStorage.setItem('cosko_stores_list', JSON.stringify(updatedStores));
    } catch {}
  };

  const saveUsersToStorage = (updatedUsers: UserAccount[]) => {
    setUsersList(updatedUsers);
    try {
      localStorage.setItem('cosko_users_list', JSON.stringify(updatedUsers));
    } catch {}
  };

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

  // Restore authenticated user session from secure client storage on startup & sync assigned store scope
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem('cosko_active_session');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        // Find matching active user account in provisioned user accounts list
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

          // Auto-sync selectedStore to user's assigned store scope for non-Super Admin users
          if (match.role !== 'Super Admin') {
            const effectiveStore = (match.store && match.store !== 'All Stores') ? match.store : (match.allowedStores?.[0] || 'BLR');
            userObj.store = effectiveStore;
            setSelectedStoreState(effectiveStore);
          }
          return;
        }
      }
      // If no valid active session found, set status to UNAUTHENTICATED (DO NOT FALL BACK TO SUPER ADMIN)
      localStorage.removeItem('cosko_active_session');
      setCurrentUserState(unauthenticatedUser);
      setAuthStatus('UNAUTHENTICATED');
    } catch {
      localStorage.removeItem('cosko_active_session');
      setCurrentUserState(unauthenticatedUser);
      setAuthStatus('UNAUTHENTICATED');
    }
  }, [usersList]);

  // Enforce store scope lock continuously for authenticated non-Super Admin users
  useEffect(() => {
    if (authStatus === 'AUTHENTICATED' && currentUser.role !== 'Super Admin') {
      const assignedStore = (currentUser.store && currentUser.store !== 'All Stores') ? currentUser.store : 'BLR';
      if (selectedStore === 'All Stores' || selectedStore !== assignedStore) {
        setSelectedStoreState(assignedStore);
      }
    }
  }, [currentUser, authStatus, selectedStore]);

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
    } catch {
      // Storage fallback
    }
  };

  const logoutUser = () => {
    try {
      localStorage.removeItem('cosko_active_session');
    } catch {
      // Storage fallback
    }
    setCurrentUserState(unauthenticatedUser);
    setAuthStatus('UNAUTHENTICATED');
    setSelectedStoreState('All Stores');
  };

  const updateBranding = (updatedPartial: Partial<AppBranding>) => {
    setBranding((prev) => {
      const updated = { ...prev, ...updatedPartial };
      try {
        localStorage.setItem('cosko_branding', JSON.stringify(updated));
      } catch {
        // Storage fallback
      }
      return updated;
    });

    addAuditLog('Settings', 'Update White-Label Branding', `Updated app name to "${updatedPartial.appName || branding.appName}"`);
    toast.success('Application branding updated successfully!');
  };

  const resetBranding = () => {
    setBranding(defaultBranding);
    try {
      localStorage.removeItem('cosko_branding');
    } catch {
      // ignore
    }
    addAuditLog('Settings', 'Reset White-Label Branding', 'Reset branding back to default COSKO theme');
    toast.success('Branding reset to default COSKO settings');
  };

  const setSelectedStore = (storeCode: string) => {
    if (currentUser.role !== 'Super Admin') {
      if (storeCode === 'All Stores') {
        toast.error('Deny Access: Enterprise "All Stores" scope is restricted to Super Admin accounts only.');
        return;
      }
      const assignedStore = (currentUser.store && currentUser.store !== 'All Stores') ? currentUser.store : 'BLR';
      if (storeCode !== assignedStore) {
        toast.error(`Deny Access: Store Scope Lock prevents access to ${storeCode}. You are assigned to ${assignedStore}.`);
        return;
      }
    }
    setSelectedStoreState(storeCode);
  };

  const addStoreHub = (storeData: Omit<StoreHub, 'id'>) => {
    const newStore: StoreHub = {
      ...storeData,
      id: `st-${Date.now()}`,
    };
    const updated = [...storesList, newStore];
    saveStoresToStorage(updated);
    SupabaseClientService.syncStore(newStore);
    addAuditLog('Organization', 'Add Store Hub', `Created new store outlet "${newStore.name}" (${newStore.code})`);
    toast.success(`Store hub "${newStore.name}" (${newStore.code}) created successfully!`);
  };

  const updateStoreHub = (id: string, updated: Partial<StoreHub>) => {
    const updatedStores = storesList.map((s) => (s.id === id || s.code === id ? { ...s, ...updated } : s));
    saveStoresToStorage(updatedStores);
    const target = updatedStores.find((s) => s.id === id || s.code === id);
    if (target) SupabaseClientService.syncStore(target);
    addAuditLog('Organization', 'Edit Store Hub', `Updated details for store hub #${id}`);
    toast.success('Store hub details updated.');
  };

  const deleteStoreHub = (id: string) => {
    const s = storesList.find((st) => st.id === id || st.code === id);
    const updatedStores = storesList.filter((st) => st.id !== id && st.code !== id);
    saveStoresToStorage(updatedStores);
    if (s) {
      SupabaseClientService.deleteStore(id);
      addAuditLog('Organization', 'Delete Store Hub', `Removed store hub ${s.name} (${s.code})`);
      toast.success(`Removed store hub "${s.name}" (${s.code})`);
    }
  };

  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
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

  const addAuditLog = (module: string, action: string, details: string) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      userName: currentUser.name,
      userRole: currentUser.role,
      module,
      action,
      details,
      ipAddress: '192.168.1.14',
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    SupabaseClientService.syncAuditLog(newLog);
  };

  const toggleCurrentUserShift = () => {
    const nextStatus: 'On Shift' | 'On Leave' = currentUser.shiftStatus === 'On Shift' ? 'On Leave' : 'On Shift';
    setCurrentUser((prev: typeof currentUser) => ({ ...prev, shiftStatus: nextStatus }));
    const updatedUsers = usersList.map((u) => (u.id === currentUser.id ? { ...u, shiftStatus: nextStatus } : u));
    saveUsersToStorage(updatedUsers);
    addAuditLog('User Shift', 'Toggle Shift Status', `${currentUser.name} marked shift as ${nextStatus}`);
    toast.success(`Your shift status is now "${nextStatus}"`);
  };

  const updateProfileAvatar = (avatarUrl: string | null) => {
    setCurrentUser((prev: typeof currentUser) => ({ ...prev, avatarUrl: avatarUrl || undefined }));
    const updatedUsers = usersList.map((u) => (u.id === currentUser.id ? { ...u, avatarUrl: avatarUrl || undefined } : u));
    saveUsersToStorage(updatedUsers);
    addAuditLog('User Profile', 'Update Avatar Photo', `Updated profile picture for ${currentUser.name}`);
    if (avatarUrl) {
      toast.success('Profile picture updated successfully!');
    } else {
      toast.info('Profile picture removed');
    }
  };

  const toggleUserShiftStatus = (id: string) => {
    const updatedUsers = usersList.map((u) => {
      if (u.id === id) {
        const nextStatus: 'On Shift' | 'On Leave' = u.shiftStatus === 'On Shift' ? 'On Leave' : 'On Shift';
        if (u.id === currentUser.id) {
          setCurrentUser((curr: typeof currentUser) => ({ ...curr, shiftStatus: nextStatus }));
        }
        addAuditLog('User Shift', 'Toggle User Shift', `Toggled shift status for ${u.name} to ${nextStatus}`);
        toast.success(`${u.name} shift status set to "${nextStatus}"`);
        return { ...u, shiftStatus: nextStatus };
      }
      return u;
    });
    saveUsersToStorage(updatedUsers);
  };

  const deleteUserAccount = async (id: string) => {
    const u = usersList.find((usr) => usr.id === id);
    if (u) {
      if (u.role === 'Super Admin' && currentUser.role !== 'Super Admin') {
        toast.error('Deny Access: Lower-level roles cannot delete Super Admin accounts.');
        return;
      }
      const updatedUsers = usersList.filter((usr) => usr.id !== id);
      saveUsersToStorage(updatedUsers);
      try {
        await fetch('/api/users/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
      } catch {
        SupabaseClientService.deleteProfile(id);
      }
      addAuditLog('Security RBAC', 'Delete User Account', `Deleted user ${u.name} (${u.email})`);
      toast.success(`User account "${u.name}" deleted successfully.`);
    }
  };

  const addUserAccount = async (userData: Omit<UserAccount, 'id' | 'lastLogin' | 'permissions'> & { password?: string }) => {
    if (userData.role === 'Super Admin' && currentUser.role !== 'Super Admin') {
      toast.error('Deny Access: Only existing Level 100 Super Admin accounts can create new Super Admin accounts.');
      return;
    }

    const securityLevel =
      userData.role === 'Super Admin' ? 100 : userData.role === 'Store Manager' ? 80 : userData.role === 'Inventory Auditor' ? 60 : userData.role === 'Sales Executive' ? 40 : 20;

    const tempId = `usr-${Date.now()}`;
    const newUser: UserAccount = {
      ...userData,
      id: tempId,
      securityLevel,
      lastLogin: 'Never',
      permissions: userData.role === 'Super Admin' ? ['ALL_PERMISSIONS'] : ['STANDARD_ACCESS'],
    };

    const updatedUsers = [...usersList, newUser];
    saveUsersToStorage(updatedUsers);

    try {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userData, securityLevel }),
      });
      const data = await res.json();
      if (data.success && data.userId) {
        const finalUser = { ...newUser, id: data.userId };
        const currentList = JSON.parse(localStorage.getItem('cosko_users_list') || '[]');
        const updatedList = currentList.map((u: any) => (u.id === tempId ? finalUser : u));
        saveUsersToStorage(updatedList);
      }
    } catch {
      SupabaseClientService.syncProfile(newUser);
    }

    addAuditLog('Security RBAC', 'Add User Account', `Created user account for ${newUser.name} (${newUser.role} [Level ${securityLevel}] - ${newUser.email})`);
    toast.success(`User account created for ${newUser.name} (${newUser.role} - Level ${securityLevel})`);
  };

  const toggleUserStatus = (id: string, nextStatus: 'Active' | 'Inactive' | 'Suspended') => {
    const target = usersList.find((u) => u.id === id);
    if (!target) return;
    if (target.role === 'Super Admin' && currentUser.role !== 'Super Admin') {
      toast.error('Deny Access: Protected Boundary. Lower roles cannot modify Super Admin accounts.');
      return;
    }
    const updatedUsers = usersList.map((u) => (u.id === id ? { ...u, status: nextStatus } : u));
    saveUsersToStorage(updatedUsers);
    const updatedUser = updatedUsers.find((u) => u.id === id);
    if (updatedUser) {
      fetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: nextStatus }),
      }).catch(() => SupabaseClientService.syncProfile(updatedUser));
    }
    addAuditLog('Security RBAC', 'Change Account Status', `Set user status for ${target.name} to ${nextStatus}`);
    toast.success(`Account status for ${target.name} updated to "${nextStatus}"`);
  };

  const setUserPermissionOverride = (userId: string, permissionCode: string, overrideType: 'ALLOW' | 'DENY' | 'RESET') => {
    const target = usersList.find((u) => u.id === userId);
    if (!target) return;
    if (target.role === 'Super Admin' && currentUser.role !== 'Super Admin') {
      toast.error('Deny Access: Protected Boundary. Cannot alter Super Admin permission overrides.');
      return;
    }

    const updatedUsers = usersList.map((u) => {
      if (u.id === userId) {
        const currentOverrides = u.overrides || [];
        let updatedOverrides = currentOverrides.filter((o) => o.permissionCode !== permissionCode);
        if (overrideType !== 'RESET') {
          updatedOverrides.push({ permissionCode, overrideType });
        }
        return { ...u, overrides: updatedOverrides };
      }
      return u;
    });
    saveUsersToStorage(updatedUsers);
    addAuditLog('Security RBAC', 'Permission Override', `Configured ${overrideType} override for ${permissionCode} on ${target.name}`);
    toast.success(`Permission override (${overrideType}) updated for ${permissionCode}`);
  };

  const toggleUserStoreAccess = (userId: string, storeCode: string) => {
    const target = usersList.find((u) => u.id === userId);
    if (!target) return;
    if (target.role === 'Super Admin' && currentUser.role !== 'Super Admin') {
      toast.error('Deny Access: Protected Boundary. Cannot alter Super Admin store access.');
      return;
    }

    const updatedUsers = usersList.map((u) => {
      if (u.id === userId) {
        const stores = u.allowedStores || [u.store];
        const hasStore = stores.includes(storeCode);
        const updatedStores = hasStore ? stores.filter((s) => s !== storeCode) : [...stores, storeCode];
        const finalStores = updatedStores.length === 0 ? [storeCode] : updatedStores;
        return { ...u, allowedStores: finalStores };
      }
      return u;
    });
    saveUsersToStorage(updatedUsers);
    addAuditLog('Security RBAC', 'Store Access Assignment', `Toggled store access ${storeCode} for ${target.name}`);
    toast.success(`Toggled store access ${storeCode} for ${target.name}`);
  };

  const updateUserAccount = async (id: string, updated: Partial<UserAccount>) => {
    const updatedUsers = usersList.map((u) => (u.id === id ? { ...u, ...updated } : u));
    saveUsersToStorage(updatedUsers);
    const updatedUser = updatedUsers.find((u) => u.id === id);
    if (updatedUser) {
      try {
        await fetch('/api/users/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...updated }),
        });
      } catch {
        SupabaseClientService.syncProfile(updatedUser);
      }
    }
    toast.success('User role and account details updated.');
  };

  const addItem = (itemData: Omit<InventoryItem, 'id'>) => {
    const newItem: InventoryItem = {
      ...itemData,
      id: `item-${Date.now()}`,
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
    setInventory((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(0, item.qtyOnHand + qtyChange);
          const newItem = { ...item, qtyOnHand: newQty, lastMovement: 'Today' };
          SupabaseClientService.syncProduct(newItem);
          addAuditLog('Inventory', 'Stock Adjustment', `Adjusted stock for "${item.name}" by ${qtyChange > 0 ? '+' : ''}${qtyChange} units. Reason: ${reason}`);
          return newItem;
        }
        return item;
      })
    );
    toast.success(`Stock adjusted successfully`);
  };

  const transferStock = (fromStore: string, toStore: string, itemId: string, qty: number) => {
    setInventory((prev) =>
      prev.map((item) => {
        if (item.id === itemId && (item.store === fromStore || fromStore === 'ALL')) {
          const newItem = { ...item, qtyOnHand: Math.max(0, item.qtyOnHand - qty), lastMovement: 'Transfer Out' };
          SupabaseClientService.syncProduct(newItem);
          return newItem;
        }
        return item;
      })
    );
    addAuditLog('Stores', 'Stock Transfer', `Transferred ${qty} units of item ${itemId} from ${fromStore} to ${toStore}`);
    toast.success(`Transferred ${qty} units from ${fromStore} to ${toStore}`);
  };

  const addSale = (saleData: Omit<SalesOrder, 'id' | 'orderNo' | 'createdAt' | 'period'>): SalesOrder => {
    const newSale: SalesOrder = {
      ...saleData,
      id: `sale-${Date.now()}`,
      orderNo: `ORD-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      period: 'Today',
    };

    setInventory((prev) =>
      prev.map((item) => {
        const sold = saleData.items.find((si) => si.itemId === item.id);
        if (sold) {
          const newItem = { ...item, qtyOnHand: Math.max(0, item.qtyOnHand - sold.qty), lastMovement: 'Just now' };
          SupabaseClientService.syncProduct(newItem);
          return newItem;
        }
        return item;
      })
    );

    setCustomers((prev) =>
      prev.map((c) => {
        if (c.name === saleData.customerName || c.phone === saleData.customerPhone) {
          const updatedCust = {
            ...c,
            totalSpend: c.totalSpend + newSale.total,
            creditBalance: saleData.paymentMethod === 'Credit' ? c.creditBalance + newSale.total : c.creditBalance,
            lastPurchase: 'Today',
          };
          SupabaseClientService.syncCustomer(updatedCust);
          return updatedCust;
        }
        return c;
      })
    );

    setSales((prev) => [newSale, ...prev]);
    SupabaseClientService.syncSale({ ...newSale, cashierName: currentUser.name });
    const photoMsg = saleData.salePhotos && saleData.salePhotos.length > 0 ? ` with ${saleData.salePhotos.length} attached photo(s)` : '';
    addAuditLog('Sales', 'POS Sale Checkout', `Completed order ${newSale.orderNo} for ₹${newSale.total.toLocaleString('en-IN')}${photoMsg}`);
    toast.success(`Sale ${newSale.orderNo} completed successfully!`);
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
    addAuditLog('Purchases', 'Create Purchase Order', `Generated ${newPO.poNo} for ${newPO.vendorName} (₹${newPO.totalAmount.toLocaleString('en-IN')})`);
    toast.success(`Purchase Order ${newPO.poNo} created successfully!`);
  };

  const updatePurchase = (id: string, updated: Partial<PurchaseOrder>) => {
    setPurchases((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    addAuditLog('Purchases', 'Edit Purchase Order', `Updated PO #${id}`);
    toast.success('Purchase Order updated successfully');
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

  const addExpense = (expData: Omit<Expense, 'id' | 'referenceNo' | 'date'>) => {
    const newExp: Expense = {
      ...expData,
      id: `exp-${Date.now()}`,
      referenceNo: `EXP-2026-${Math.floor(100 + Math.random() * 900)}`,
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    };
    setExpenses((prev) => [newExp, ...prev]);
    SupabaseClientService.syncExpense({ ...newExp, spentBy: currentUser.name });
    addAuditLog('Expenses', 'Log Expense', `Recorded expense ${newExp.referenceNo} (${newExp.category} - ₹${newExp.amount.toLocaleString('en-IN')})`);
    toast.success(`Expense ${newExp.referenceNo} recorded`);
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success('All notifications marked as read');
  };

  const value = useMemo(
    () => ({
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
    }),
    [
      branding,
      selectedStore,
      datePeriod,
      authStatus,
      currentUser,
      usersList,
      inventory,
      sales,
      purchases,
      customers,
      vendors,
      expenses,
      auditLogs,
      notifications,
      searchOpen,
      notificationsOpen,
      storeSelectorOpen,
      userProfileOpen,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
