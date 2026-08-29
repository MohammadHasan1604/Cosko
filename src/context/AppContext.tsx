'use client';
import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { SupabaseClientService, supabase } from '@/lib/supabase';

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

const initialInventory: InventoryItem[] = [
  { id: 'item-001', sku: 'SKU-0091', barcode: '8901234567890', name: 'Crompton Fan Regulator 5-Speed', brand: 'Crompton', model: 'REG-5S', category: 'Electricals', subcategory: 'Fans', store: 'CENTRAL', qtyOnHand: 150, reorderPt: 8, costPrice: 320, transferPrice: 380, sellingPrice: 485, mrp: 550, hsn: '84145990', taxRate: 18, warrantyMonths: 12, minStock: 10, status: 'active', fifoLots: 5, lastMovement: '09 Aug 2026' },
  { id: 'item-002', sku: 'SKU-0218', barcode: '8901234567891', name: 'Philips LED 9W Warm White (Pack of 6)', brand: 'Philips', model: 'LED-9W-PK6', category: 'Lighting', subcategory: 'LED Bulbs', store: 'HYD', qtyOnHand: 25, reorderPt: 20, costPrice: 480, transferPrice: 560, sellingPrice: 680, mrp: 750, hsn: '85395000', taxRate: 12, warrantyMonths: 24, minStock: 15, status: 'active', fifoLots: 2, lastMovement: '11 Aug 2026' },
  { id: 'item-003', sku: 'SKU-0312', barcode: '8901234567892', name: 'Anchor Roma 3-Pin 6A Plug Top', brand: 'Anchor', model: 'ROMA-6A', category: 'Electricals', subcategory: 'Plugs & Sockets', store: 'BLR', qtyOnHand: 142, reorderPt: 50, costPrice: 28, transferPrice: 35, sellingPrice: 45, mrp: 55, hsn: '85364900', taxRate: 18, warrantyMonths: 6, minStock: 20, status: 'active', fifoLots: 4, lastMovement: '12 Aug 2026' },
  { id: 'item-004', sku: 'SKU-0562', barcode: '8901234567893', name: 'Polycab 1.5 Sq mm FR Wire 90m Coil', brand: 'Polycab', model: 'FR-1.5-90M', category: 'Wiring', subcategory: 'FR Wires', store: 'HYD', qtyOnHand: 18, reorderPt: 12, costPrice: 1850, transferPrice: 2100, sellingPrice: 2400, mrp: 2650, hsn: '85444900', taxRate: 18, warrantyMonths: 60, minStock: 10, status: 'active', fifoLots: 1, lastMovement: '10 Aug 2026' },
  { id: 'item-005', sku: 'SKU-0834', barcode: '8901234567894', name: 'Havells Crabtree 6A Switch 1-Way', brand: 'Havells', model: 'CT-6A-1W', category: 'Electricals', subcategory: 'Switches', store: 'BLR', qtyOnHand: 85, reorderPt: 15, costPrice: 65, transferPrice: 78, sellingPrice: 95, mrp: 115, hsn: '85365000', taxRate: 18, warrantyMonths: 12, minStock: 15, status: 'active', fifoLots: 3, lastMovement: '07 Aug 2026' },
  { id: 'item-006', sku: 'SKU-1042', barcode: '8901234567895', name: 'Bosch GSR 12V-15 Cordless Drill', brand: 'Bosch', model: 'GSR-12V-15', category: 'Power Tools', subcategory: 'Drills', store: 'BLR', qtyOnHand: 12, reorderPt: 10, costPrice: 4800, transferPrice: 5600, sellingPrice: 6800, mrp: 7500, hsn: '84672900', taxRate: 18, warrantyMonths: 12, minStock: 5, status: 'active', fifoLots: 1, lastMovement: '08 Aug 2026' },
  { id: 'item-007', sku: 'SKU-1198', barcode: '8901234567896', name: 'Anchor Roma 3-Pin 16A Socket', brand: 'Anchor', model: 'ROMA-16A', category: 'Electricals', subcategory: 'Plugs & Sockets', store: 'DEL', qtyOnHand: 48, reorderPt: 25, costPrice: 42, transferPrice: 52, sellingPrice: 68, mrp: 80, hsn: '85364900', taxRate: 18, warrantyMonths: 6, minStock: 15, status: 'active', fifoLots: 2, lastMovement: '11 Aug 2026' },
  { id: 'item-008', sku: 'SKU-1341', barcode: '8901234567897', name: 'Syska LED Strip Light 5m RGB', brand: 'Syska', model: 'STRIP-5M-RGB', category: 'Lighting', subcategory: 'Strip Lights', store: 'HYD', qtyOnHand: 34, reorderPt: 15, costPrice: 680, transferPrice: 790, sellingPrice: 950, mrp: 1100, hsn: '85395000', taxRate: 12, warrantyMonths: 12, minStock: 10, status: 'active', fifoLots: 3, lastMovement: '12 Aug 2026' },
  { id: 'item-009', sku: 'SKU-1512', barcode: '8901234567898', name: 'Legrand MCB 32A Single Pole', brand: 'Legrand', model: 'MCB-32A-1P', category: 'Circuit Protection', subcategory: 'MCBs', store: 'DEL', qtyOnHand: 96, reorderPt: 30, costPrice: 185, transferPrice: 220, sellingPrice: 270, mrp: 320, hsn: '85362000', taxRate: 18, warrantyMonths: 24, minStock: 20, status: 'active', fifoLots: 5, lastMovement: '09 Aug 2026' },
  { id: 'item-010', sku: 'SKU-1688', barcode: '8901234567899', name: 'V-Guard Voltage Stabilizer 4kVA', brand: 'V-Guard', model: 'STAB-4KVA', category: 'Power Conditioning', subcategory: 'Stabilizers', store: 'BLR', qtyOnHand: 18, reorderPt: 8, costPrice: 3200, transferPrice: 3800, sellingPrice: 4500, mrp: 5200, hsn: '85044000', taxRate: 18, warrantyMonths: 36, minStock: 5, status: 'active', fifoLots: 2, lastMovement: '10 Aug 2026' },
  { id: 'item-011', sku: 'SKU-1834', barcode: '8901234567900', name: 'Finolex 2.5 Sq mm FR PVC Wire 90m', brand: 'Finolex', model: 'FR-2.5-90M', category: 'Wiring', subcategory: 'FR Wires', store: 'HYD', qtyOnHand: 29, reorderPt: 20, costPrice: 2100, transferPrice: 2450, sellingPrice: 2800, mrp: 3100, hsn: '85444900', taxRate: 18, warrantyMonths: 60, minStock: 10, status: 'active', fifoLots: 3, lastMovement: '11 Aug 2026' },
  { id: 'item-012', sku: 'SKU-2001', barcode: '8901234567901', name: 'Stanley 10-Piece Screwdriver Set', brand: 'Stanley', model: 'SD-SET-10P', category: 'Hand Tools', subcategory: 'Screwdrivers', store: 'DEL', qtyOnHand: 42, reorderPt: 15, costPrice: 420, transferPrice: 510, sellingPrice: 620, mrp: 720, hsn: '82059900', taxRate: 12, warrantyMonths: 12, minStock: 10, status: 'active', fifoLots: 2, lastMovement: '08 Aug 2026' },
  { id: 'item-013', sku: 'SKU-2189', barcode: '8901234567902', name: 'Halonix 18W LED Batten Light 2FT', brand: 'Halonix', model: 'BAT-18W-2FT', category: 'Lighting', subcategory: 'Batten Lights', store: 'BLR', qtyOnHand: 74, reorderPt: 30, costPrice: 240, transferPrice: 290, sellingPrice: 360, mrp: 420, hsn: '94054090', taxRate: 12, warrantyMonths: 12, minStock: 15, status: 'active', fifoLots: 4, lastMovement: '12 Aug 2026' },
  { id: 'item-014', sku: 'SKU-2341', barcode: '8901234567903', name: 'Schneider 32A 3-Phase MCB', brand: 'Schneider', model: 'MCB-32A-3P', category: 'Circuit Protection', subcategory: 'MCBs', store: 'HYD', qtyOnHand: 18, reorderPt: 10, costPrice: 680, transferPrice: 810, sellingPrice: 980, mrp: 1150, hsn: '85362000', taxRate: 18, warrantyMonths: 24, minStock: 5, status: 'inactive', fifoLots: 2, lastMovement: '03 Aug 2026' },
  { id: 'item-015', sku: 'SKU-2498', barcode: '8901234567904', name: 'Makita 750W Angle Grinder 4.5"', brand: 'Makita', model: 'AG-750W', category: 'Power Tools', subcategory: 'Grinders', store: 'BLR', qtyOnHand: 14, reorderPt: 5, costPrice: 3400, transferPrice: 4000, sellingPrice: 4800, mrp: 5500, hsn: '84672900', taxRate: 18, warrantyMonths: 12, minStock: 5, status: 'active', fifoLots: 1, lastMovement: '07 Aug 2026' },
  { id: 'item-016', sku: 'SKU-2138', barcode: '8901234567905', name: 'Havells Gold Fan 1200mm', brand: 'Havells', model: 'GF-1200MM', category: 'Electricals', subcategory: 'Fans', store: 'BLR', qtyOnHand: 22, reorderPt: 3, costPrice: 1800, transferPrice: 2100, sellingPrice: 2499, mrp: 2800, hsn: '84145990', taxRate: 18, warrantyMonths: 24, minStock: 5, status: 'active', fifoLots: 2, lastMovement: 'Today' },
];

const initialStockTransfers: StockTransferRecord[] = [
  { id: 'tr-101', transferNo: 'TR-2026-001', sourceStore: 'CENTRAL', destStore: 'BLR', productId: 'item-003', sku: 'SKU-0312', productName: 'Anchor Roma 3-Pin 6A Plug Top', qty: 50, purchaseCost: 28, transferPrice: 35, transferProfit: 350, status: 'Completed', createdBy: 'Super Admin', createdAt: '20 Aug 2026' },
  { id: 'tr-102', transferNo: 'TR-2026-002', sourceStore: 'CENTRAL', destStore: 'HYD', productId: 'item-004', sku: 'SKU-0562', productName: 'Polycab 1.5 Sq mm FR Wire 90m Coil', qty: 20, purchaseCost: 1850, transferPrice: 2100, transferProfit: 5000, status: 'Completed', createdBy: 'Super Admin', createdAt: '22 Aug 2026' },
];

const initialInventoryLedger: InventoryLedgerEntry[] = [
  { id: 'led-1', productId: 'item-003', sku: 'SKU-0312', productName: 'Anchor Roma 3-Pin 6A Plug Top', storeCode: 'CENTRAL', movementType: 'PURCHASE', quantity: 200, unitCost: 28, totalValue: 5600, fromLocation: 'Vendor: Anchor', toLocation: 'CENTRAL', referenceNo: 'PO-2026-0010', createdBy: 'Super Admin', createdAt: '15 Aug 2026' },
  { id: 'led-2', productId: 'item-003', sku: 'SKU-0312', productName: 'Anchor Roma 3-Pin 6A Plug Top', storeCode: 'BLR', movementType: 'TRANSFER_IN', quantity: 50, unitCost: 35, totalValue: 1750, fromLocation: 'CENTRAL', toLocation: 'BLR', referenceNo: 'TR-2026-001', createdBy: 'Super Admin', createdAt: '20 Aug 2026' },
];

const initialRepairsEnquiries: RepairEnquiry[] = [
  { id: 'rep-1', customerPhone: '+91 98765 43210', customerName: 'Rajesh Kumar Electronics', enquiryDate: '24 Aug 2026 11:00 AM', repairStatus: 'Ready for Delivery', repairRequested: 'Bosch Cordless Drill motor brush replacement & battery check', technicianNotes: 'Replaced carbon brushes, recalibrated motor head.', internalCost: 450, createdAt: '24 Aug 2026' },
  { id: 'rep-2', customerPhone: '+91 97432 50071', customerName: 'Mohammad Yunus', enquiryDate: '26 Aug 2026 03:30 PM', repairStatus: 'In Progress', repairRequested: 'V-Guard Stabilizer voltage trip indicator blinking continuously', technicianNotes: 'Testing relay board and primary coil capacitor.', internalCost: 320, createdAt: '26 Aug 2026' },
];

const initialSales: SalesOrder[] = [
  { id: 'sale-101', orderNo: 'CS260011', customerName: 'Rajesh Kumar Electronics', customerPhone: '+91 98765 43210', store: 'BLR', items: [{ itemId: 'item-003', name: 'Anchor Roma 3-Pin 6A Plug Top', qty: 20, unitPrice: 45, taxRate: 18, warrantyMonths: 6, warrantyExpiryDate: '28 Feb 2027' }], subtotal: 900, taxTotal: 162, discount: 0, total: 1062, taxEnabled: true, paymentMethod: 'UPI', status: 'Completed', createdAt: '28 Aug 2026 10:15 AM', period: 'Today', warrantyExpiryDate: '28 Feb 2027' },
  { id: 'sale-102', orderNo: 'CS260021', customerName: 'Priya Sharma Buildcon', customerPhone: '+91 98111 22334', store: 'HYD', items: [{ itemId: 'item-004', name: 'Polycab 1.5 Sq mm FR Wire 90m Coil', qty: 5, unitPrice: 2400, taxRate: 18, warrantyMonths: 60, warrantyExpiryDate: '28 Aug 2031' }], subtotal: 12000, taxTotal: 2160, discount: 500, total: 13660, taxEnabled: true, paymentMethod: 'Card', status: 'Completed', createdAt: '28 Aug 2026 11:30 AM', period: 'Today', warrantyExpiryDate: '28 Aug 2031' },
  { id: 'sale-103', orderNo: 'CS260031', customerName: 'Apex Electrical Solutions', customerPhone: '+91 97222 33445', store: 'DEL', items: [{ itemId: 'item-009', name: 'Legrand MCB 32A Single Pole', qty: 12, unitPrice: 270, taxRate: 18, warrantyMonths: 24, warrantyExpiryDate: '28 Aug 2028' }], subtotal: 3240, taxTotal: 583.2, discount: 0, total: 3823.2, taxEnabled: true, paymentMethod: 'Cash', status: 'Completed', createdAt: '28 Aug 2026 01:05 PM', period: 'Today', warrantyExpiryDate: '28 Aug 2028' },
];

const initialPurchases: PurchaseOrder[] = [
  { id: 'po-301', poNo: 'PO-2026-0041', vendorName: 'Polycab India Ltd', store: 'CENTRAL', items: [{ name: 'Polycab 1.5 Sq mm FR Wire 90m Coil', qty: 25, unitCost: 1850, sku: 'SKU-0562' }], totalAmount: 46250, status: 'Received', paymentStatus: 'Paid', expectedDate: '25 Aug 2026', createdAt: '20 Aug 2026' },
  { id: 'po-302', poNo: 'PO-2026-0042', vendorName: 'Havells India Limited', store: 'CENTRAL', items: [{ name: 'Havells Crabtree 6A Switch 1-Way', qty: 100, unitCost: 65, sku: 'SKU-0834' }], totalAmount: 6500, status: 'Sent', paymentStatus: 'Unpaid', expectedDate: '30 Aug 2026', createdAt: '26 Aug 2026' },
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
  { id: 'usr-1', name: 'Super Admin', email: 'cosko@gmail.com', password: 'Cosko2026@', phone: '+91 98765 00000', role: 'Super Admin', securityLevel: 100, store: 'All Stores', allowedStores: ['CENTRAL', 'BLR', 'HYD', 'DEL', 'MUM'], status: 'Active', shiftStatus: 'On Shift', lastLogin: 'Just now', permissions: ['ALL_PERMISSIONS', 'super_admin.manage', 'roles.manage', 'permissions.manage', 'security.manage', 'audit_logs.enterprise_view', 'settings.global_manage'] },
  { id: 'usr-2', name: 'Sneha Patel', email: 'sneha@cosko.com', password: 'Password2026@', phone: '+91 80 2555 1234', role: 'Store Manager', securityLevel: 80, store: 'BLR', allowedStores: ['BLR'], status: 'Active', shiftStatus: 'On Shift', lastLogin: '1 hour ago', permissions: ['dashboard.view', 'sales.view', 'sales.create', 'sales.discount', 'sales.refund', 'inventory.view', 'inventory.add', 'inventory.edit', 'inventory.adjust', 'inventory.transfer', 'purchases.view', 'purchases.create', 'customers.view', 'customers.edit', 'vendors.view', 'expenses.view', 'accounting.view', 'reports.view', 'employees.view', 'stores.view'] },
  { id: 'usr-3', name: 'Rohan Sharma', email: 'rohan@cosko.com', password: 'Password2026@', phone: '+91 11 4100 9988', role: 'Inventory Auditor', securityLevel: 60, store: 'DEL', allowedStores: ['DEL'], status: 'Active', shiftStatus: 'On Shift', lastLogin: '3 hours ago', permissions: ['dashboard.view', 'inventory.view', 'inventory.add', 'inventory.edit', 'inventory.adjust', 'purchases.view', 'purchases.receive_grn', 'vendors.view', 'reports.view'] },
  { id: 'usr-4', name: 'Karan Verma', email: 'karan@cosko.com', password: 'Password2026@', phone: '+91 40 6677 8899', role: 'POS Cashier', securityLevel: 20, store: 'HYD', allowedStores: ['HYD'], status: 'Active', shiftStatus: 'On Shift', lastLogin: 'Yesterday', permissions: ['sales.view', 'sales.create', 'customers.view'] },
  { id: 'usr-5', name: 'Vikram Singh', email: 'vikram@cosko.com', password: 'Password2026@', phone: '+91 99000 11223', role: 'POS Cashier', securityLevel: 20, store: 'BLR', allowedStores: ['BLR'], status: 'Suspended', shiftStatus: 'On Leave', lastLogin: '5 days ago', permissions: ['sales.view'] },
  { id: 'usr-6', name: 'Pooja Deshmukh', email: 'pooja@cosko.com', password: 'Password2026@', phone: '+91 98765 43210', role: 'Sales Executive', securityLevel: 40, store: 'BLR', allowedStores: ['BLR'], status: 'Active', shiftStatus: 'On Shift', lastLogin: '2 hours ago', permissions: ['sales.view', 'sales.create', 'sales.pay_cash', 'sales.pay_upi', 'sales.pay_card', 'sales.print_receipt', 'sales.history', 'sales.attach_photo', 'customers.view', 'customers.add'] },
  { id: 'usr-7', name: 'Rakesh Verma', email: 'rakesh@cosko.com', password: 'Password2026@', phone: '+91 98222 33445', role: 'Store Manager', securityLevel: 80, store: 'MUM', allowedStores: ['MUM'], status: 'Active', shiftStatus: 'On Shift', lastLogin: 'Today', permissions: ['dashboard.view', 'sales.view', 'sales.create', 'inventory.view', 'inventory.add', 'inventory.edit', 'inventory.adjust', 'inventory.transfer', 'purchases.view', 'purchases.create', 'customers.view', 'customers.edit', 'expenses.view', 'reports.view', 'employees.view', 'stores.view'] },
];

const initialAuditLogs: AuditLog[] = [
  { id: 'log-1', timestamp: '28 Aug 2026 14:10:02', userName: 'Super Admin', userRole: 'Super Admin', module: 'Inventory', action: 'Stock Adjustment', details: 'Adjusted SKU-0312 qty from +20 to +142 (Physical Audit)', ipAddress: '192.168.1.14' },
  { id: 'log-2', timestamp: '28 Aug 2026 11:30:15', userName: 'Super Admin', userRole: 'Super Admin', module: 'Sales', action: 'POS Sale Checkout', details: 'Completed Order CS260021 (₹13,660)', ipAddress: '192.168.1.42' },
];

const initialNotifications: NotificationItem[] = [
  { id: 'notif-1', title: 'Low Stock Alert', message: '38 items across stores are below reorder threshold.', time: '10 min ago', type: 'warning', read: false },
  { id: 'notif-2', title: 'New PO Received', message: 'PO-2026-0041 marked received at Central Warehouse.', time: '2 hours ago', type: 'success', read: false },
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

  // Enforce store scope lock continuously for non-Super Admin users
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
