/**
 * COSKO Enterprise System — Supabase Client & Database Infrastructure
 * Centralized Supabase Auth, PostgreSQL Database, Storage, and Realtime Client
 */

import { createClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xsujcrphkmtprvgncsdw.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdWpjcnBoa210cHJ2Z25jc2R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MzIzMTIsImV4cCI6MjEwMzUwODMxMn0.H7lW8Bhs3gN6vHPNTs_RbEZ2vmMoD0QJSuFvJs7aPcs';

export const supabaseConfig: SupabaseConfig = {
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
};

// Official Supabase Client Instance
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/**
 * Checks if production Supabase credentials are configured
 */
export function isSupabaseConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://cosko-app.supabase.co'
  );
}

/**
 * Server-side Supabase Database & Auth API helper functions
 */
export class SupabaseClientService {
  /**
   * Generates public URL for assets in Supabase Storage buckets
   */
  static getStoragePublicUrl(bucket: 'product-images' | 'sale-attachments' | 'branding', path: string): string {
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  }

  /**
   * Health check diagnostic for Supabase connection
   */
  /**
   * Health check diagnostic for Supabase connection
   */
  static async checkHealth(): Promise<{ status: 'OK' | 'FALLBACK'; mode: string; endpoint: string }> {
    if (isSupabaseConfigured()) {
      return { status: 'OK', mode: 'Supabase PostgreSQL Production', endpoint: SUPABASE_URL };
    }
    return { status: 'FALLBACK', mode: 'Supabase Client Storage Mode', endpoint: 'Local Client Persistence' };
  }

  // ====================================================================
  // SUPABASE DATABASE CRUD SYNC HELPERS
  // ====================================================================

  static async syncProfile(profile: { id: string; name: string; email: string; phone?: string; role: string; securityLevel?: number; store: string; status: string; shiftStatus?: string; avatarUrl?: string }) {
    try {
      const payload = {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone || null,
        role: profile.role,
        security_level: profile.securityLevel || 80,
        store_scope: profile.store,
        status: profile.status,
        shift_status: profile.shiftStatus || 'On Shift',
        avatar_url: profile.avatarUrl || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
      if (error) console.warn('Supabase syncProfile warning:', error.message);
    } catch (err) {
      console.warn('Supabase syncProfile error:', err);
    }
  }

  static async deleteProfile(id: string) {
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) console.warn('Supabase deleteProfile warning:', error.message);
    } catch (err) {
      console.warn('Supabase deleteProfile error:', err);
    }
  }

  static async syncStore(store: { id: string; code: string; name: string; city: string; address: string; manager: string; phone: string; registers: number; skusCount: number; monthlyRevenue: number; status: string }) {
    try {
      const payload = {
        code: store.code,
        name: store.name,
        city: store.city,
        address: store.address,
        manager_name: store.manager,
        phone: store.phone,
        registers_count: store.registers,
        skus_count: store.skusCount,
        monthly_revenue: store.monthlyRevenue,
        status: store.status,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('stores').upsert(payload, { onConflict: 'code' });
      if (error) console.warn('Supabase syncStore warning:', error.message);
    } catch (err) {
      console.warn('Supabase syncStore error:', err);
    }
  }

  static async deleteStore(idOrCode: string) {
    try {
      const { error } = await supabase.from('stores').delete().or(`id.eq.${idOrCode},code.eq.${idOrCode}`);
      if (error) console.warn('Supabase deleteStore warning:', error.message);
    } catch (err) {
      console.warn('Supabase deleteStore error:', err);
    }
  }

  static async syncProduct(item: { id: string; sku: string; barcode: string; name: string; category: string; costPrice: number; sellingPrice: number; mrp: number; taxRate: number; hsn?: string; reorderPt: number; status: string }) {
    try {
      const payload = {
        sku: item.sku,
        barcode: item.barcode,
        name: item.name,
        category: item.category,
        cost_price: item.costPrice,
        selling_price: item.sellingPrice,
        mrp: item.mrp,
        gst_rate: item.taxRate,
        hsn_code: item.hsn || '8471',
        reorder_level: item.reorderPt,
        status: item.status === 'active' ? 'Active' : 'Archived',
      };
      const { error } = await supabase.from('products').upsert(payload, { onConflict: 'sku' });
      if (error) console.warn('Supabase syncProduct warning:', error.message);
    } catch (err) {
      console.warn('Supabase syncProduct error:', err);
    }
  }

  static async deleteProduct(id: string) {
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) console.warn('Supabase deleteProduct warning:', error.message);
    } catch (err) {
      console.warn('Supabase deleteProduct error:', err);
    }
  }

  static async syncCustomer(cust: { id: string; name: string; phone: string; email?: string; city?: string; creditBalance?: number; status?: string }) {
    try {
      const payload = {
        name: cust.name,
        phone: cust.phone,
        email: cust.email || null,
        city: cust.city || null,
        credit_balance: cust.creditBalance || 0,
        status: cust.status || 'Active',
      };
      const { error } = await supabase.from('customers').upsert(payload, { onConflict: 'phone' });
      if (error) console.warn('Supabase syncCustomer warning:', error.message);
    } catch (err) {
      console.warn('Supabase syncCustomer error:', err);
    }
  }

  static async syncVendor(vendor: { id: string; code: string; name: string; category: string; phone?: string; email?: string; gstin?: string; paymentTerms?: string; status?: string }) {
    try {
      const payload = {
        code: vendor.code,
        name: vendor.name,
        category: vendor.category,
        phone: vendor.phone || null,
        email: vendor.email || null,
        gstin: vendor.gstin || null,
        payment_terms: vendor.paymentTerms || null,
        status: vendor.status || 'Active',
      };
      const { error } = await supabase.from('vendors').upsert(payload, { onConflict: 'code' });
      if (error) console.warn('Supabase syncVendor warning:', error.message);
    } catch (err) {
      console.warn('Supabase syncVendor error:', err);
    }
  }

  static async syncExpense(expense: { id: string; description: string; category: string; amount: number; store: string; spentBy?: string; status?: string }) {
    try {
      const payload = {
        title: expense.description,
        category: expense.category,
        amount: expense.amount,
        store_code: expense.store,
        spent_by: expense.spentBy || 'Admin',
        status: expense.status || 'Approved',
      };
      const { error } = await supabase.from('expenses').insert(payload);
      if (error) console.warn('Supabase syncExpense warning:', error.message);
    } catch (err) {
      console.warn('Supabase syncExpense error:', err);
    }
  }

  static async syncSale(sale: { id: string; orderNo: string; store: string; customerName: string; customerPhone?: string; subtotal: number; taxTotal: number; discount: number; total: number; paymentMethod: string; cashierName?: string }) {
    try {
      const payload = {
        invoice_number: sale.orderNo,
        store_code: sale.store,
        customer_name: sale.customerName,
        customer_phone: sale.customerPhone || null,
        subtotal: sale.subtotal,
        gst_total: sale.taxTotal,
        discount_amount: sale.discount,
        grand_total: sale.total,
        payment_method: sale.paymentMethod,
        cashier_name: sale.cashierName || 'Cashier',
      };
      const { error } = await supabase.from('sales').upsert(payload, { onConflict: 'invoice_number' });
      if (error) console.warn('Supabase syncSale warning:', error.message);
    } catch (err) {
      console.warn('Supabase syncSale error:', err);
    }
  }

  static async syncAuditLog(log: { id: string; userName: string; userRole: string; module: string; action: string; details: string; ipAddress?: string }) {
    try {
      const payload = {
        user_name: log.userName,
        user_role: log.userRole,
        module: log.module,
        action: log.action,
        details: log.details,
        ip_address: log.ipAddress || '127.0.0.1',
      };
      const { error } = await supabase.from('audit_logs').insert(payload);
      if (error) console.warn('Supabase syncAuditLog warning:', error.message);
    } catch (err) {
      console.warn('Supabase syncAuditLog error:', err);
    }
  }
}
