-- ====================================================================
-- COSKO MIGRATION 002: CORE DATABASE TABLES
-- Authoritative Production Schema with Strict Data Constraints
-- ====================================================================

-- 1. STORES / HUBS TABLE
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(16) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  city VARCHAR(64) NOT NULL,
  address VARCHAR(255) NOT NULL,
  manager_name VARCHAR(128),
  phone VARCHAR(32),
  registers_count INT NOT NULL DEFAULT 2,
  skus_count INT NOT NULL DEFAULT 0,
  monthly_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(16) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. USER PROFILES TABLE (Mapped 1:1 to auth.users.id)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  email VARCHAR(128) NOT NULL UNIQUE,
  phone VARCHAR(32),
  role VARCHAR(32) NOT NULL DEFAULT 'Store Manager' CHECK (role IN (
    'Super Admin', 'Store Manager', 'Department Manager', 'Accountant', 
    'Procurement Staff', 'Inventory Auditor', 'Sales Executive', 'POS Cashier', 'Employee'
  )),
  security_level INT NOT NULL DEFAULT 80,
  store_scope VARCHAR(64) NOT NULL DEFAULT 'BLR',
  status VARCHAR(16) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended')),
  shift_status VARCHAR(16) NOT NULL DEFAULT 'On Shift' CHECK (shift_status IN ('On Shift', 'On Leave')),
  avatar_url TEXT,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. USER STORE ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.user_store_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_code VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, store_code)
);

-- 4. ROLES & PERMISSIONS
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(64) NOT NULL UNIQUE,
  security_level INT NOT NULL DEFAULT 10,
  description VARCHAR(255),
  is_system_role BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(128) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  category VARCHAR(64) NOT NULL,
  is_protected BOOLEAN NOT NULL DEFAULT false,
  min_security_level INT NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_code VARCHAR(128) NOT NULL,
  override_type VARCHAR(8) NOT NULL CHECK (override_type IN ('ALLOW', 'DENY')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, permission_code)
);

-- 5. PRODUCTS & INVENTORY
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(64) NOT NULL UNIQUE,
  barcode VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(64) NOT NULL,
  unit VARCHAR(32) NOT NULL DEFAULT 'Pcs',
  cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  mrp NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
  hsn_code VARCHAR(32) DEFAULT '8471',
  reorder_level INT NOT NULL DEFAULT 10,
  status VARCHAR(16) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_code VARCHAR(16) NOT NULL,
  stock_quantity INT NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, store_code)
);

-- 6. CUSTOMERS & CREDIT LEDGER
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  phone VARCHAR(32) NOT NULL UNIQUE,
  email VARCHAR(128),
  city VARCHAR(64),
  credit_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(16) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customer_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  transaction_type VARCHAR(16) NOT NULL CHECK (transaction_type IN ('CREDIT', 'DEBIT')),
  amount NUMERIC(12, 2) NOT NULL,
  reference_no VARCHAR(64),
  store_code VARCHAR(16) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. VENDORS & PURCHASES
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  category VARCHAR(64) NOT NULL,
  phone VARCHAR(32),
  email VARCHAR(128),
  gstin VARCHAR(32),
  payment_terms VARCHAR(64),
  status VARCHAR(16) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(64) NOT NULL UNIQUE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  store_code VARCHAR(16) NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(32) NOT NULL DEFAULT 'Draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. SALES & POS CHECKOUT
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(64) NOT NULL UNIQUE,
  store_code VARCHAR(16) NOT NULL,
  customer_name VARCHAR(128) NOT NULL,
  customer_phone VARCHAR(32),
  subtotal NUMERIC(12, 2) NOT NULL,
  gst_total NUMERIC(12, 2) NOT NULL,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  grand_total NUMERIC(12, 2) NOT NULL,
  payment_method VARCHAR(32) NOT NULL,
  cashier_name VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  sku VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL,
  quantity INT NOT NULL,
  gst_rate NUMERIC(5, 2) NOT NULL,
  total_price NUMERIC(12, 2) NOT NULL
);

-- 9. EXPENSES
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(64) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  store_code VARCHAR(16) NOT NULL,
  spent_by VARCHAR(128) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(16) NOT NULL DEFAULT 'Approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. BRANDING & SETTINGS
CREATE TABLE IF NOT EXISTS public.branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name VARCHAR(128) NOT NULL DEFAULT 'COSKO',
  tagline VARCHAR(255) DEFAULT 'Multi-Store Enterprise Retail & POS System',
  primary_color VARCHAR(16) DEFAULT '#1e40af',
  logo_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name VARCHAR(128) NOT NULL,
  user_role VARCHAR(64) NOT NULL,
  module VARCHAR(64) NOT NULL,
  action VARCHAR(128) NOT NULL,
  details TEXT NOT NULL,
  ip_address VARCHAR(64) DEFAULT '127.0.0.1',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
