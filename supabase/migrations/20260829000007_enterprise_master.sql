-- ====================================================================
-- COSKO MIGRATION 007: ENTERPRISE MASTER SCHEMA & ACCOUNTING PIPELINE
-- Central Stock, Stock Transfers, Transfer Profit, Ledger, Repairs Linkage & Sequential Invoicing
-- ====================================================================

-- 1. STOCK TRANSFERS TABLE
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_no VARCHAR(64) NOT NULL UNIQUE,
  source_store VARCHAR(16) NOT NULL,
  dest_store VARCHAR(16) NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  sku VARCHAR(64) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  qty INT NOT NULL CHECK (qty > 0),
  purchase_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  transfer_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  transfer_profit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(32) NOT NULL DEFAULT 'Completed',
  created_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_transfers_read" ON public.stock_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_transfers_write" ON public.stock_transfers FOR ALL TO authenticated USING (public.current_user_security_level() >= 60);

-- 2. INVENTORY MOVEMENT LEDGER TABLE
CREATE TABLE IF NOT EXISTS public.inventory_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  sku VARCHAR(64) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  store_code VARCHAR(16) NOT NULL,
  movement_type VARCHAR(32) NOT NULL CHECK (movement_type IN (
    'PURCHASE', 'TRANSFER_IN', 'TRANSFER_OUT', 'SALE', 'ADJUSTMENT', 'RETURN'
  )),
  quantity INT NOT NULL,
  unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  from_location VARCHAR(64),
  to_location VARCHAR(64),
  reference_no VARCHAR(64),
  created_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_ledger_read" ON public.inventory_ledger FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_ledger_write" ON public.inventory_ledger FOR ALL TO authenticated USING (public.current_user_security_level() >= 60);

-- 3. REPAIRS & ENQUIRIES LINKAGE TABLE
CREATE TABLE IF NOT EXISTS public.repairs_enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone VARCHAR(32) NOT NULL,
  customer_name VARCHAR(128) NOT NULL,
  enquiry_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  repair_status VARCHAR(64) NOT NULL DEFAULT 'Received' CHECK (repair_status IN (
    'Received', 'Diagnosing', 'In Progress', 'Ready for Delivery', 'Delivered', 'Cancelled'
  )),
  repair_requested TEXT NOT NULL,
  technician_notes TEXT, -- Hidden from sales employees
  internal_cost NUMERIC(12, 2) DEFAULT 0.00, -- Hidden from sales employees
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.repairs_enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repairs_read" ON public.repairs_enquiries FOR SELECT TO authenticated USING (true);
CREATE POLICY "repairs_write" ON public.repairs_enquiries FOR ALL TO authenticated USING (public.current_user_security_level() >= 40);

-- 4. SEQUENTIAL INVOICE COUNTER TABLE
CREATE TABLE IF NOT EXISTS public.store_invoice_sequences (
  store_code VARCHAR(16) PRIMARY KEY,
  last_sequence INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.store_invoice_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sequences_all" ON public.store_invoice_sequences FOR ALL TO authenticated USING (true);

-- Initialize Central Hub & Default Store Sequences
INSERT INTO public.stores (code, name, city, address, manager_name, phone, registers_count, skus_count, monthly_revenue, status)
VALUES ('CENTRAL', 'COSKO Central Warehouse & Owner Stock', 'Bengaluru', 'Central Hub, Bengaluru', 'Enterprise Owner', '+91 80 2555 0000', 0, 2500, 0.00, 'Active')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.store_invoice_sequences (store_code, last_sequence)
VALUES ('BLR', 10), ('HYD', 5), ('DEL', 8), ('MUM', 2), ('CENTRAL', 0)
ON CONFLICT (store_code) DO NOTHING;

-- 5. ATOMIC CONCURRENCY-SAFE INVOICE GENERATOR RPC FUNCTION
CREATE OR REPLACE FUNCTION public.generate_next_invoice_number(p_store_code VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_seq INT;
  v_numeric_code VARCHAR(8);
BEGIN
  -- Convert store code to 3-digit numeric representation
  v_numeric_code := CASE p_store_code
    WHEN 'BLR' THEN '001'
    WHEN 'HYD' THEN '002'
    WHEN 'DEL' THEN '003'
    WHEN 'MUM' THEN '004'
    ELSE '009'
  END;

  UPDATE public.store_invoice_sequences
  SET last_sequence = last_sequence + 1,
      updated_at = NOW()
  WHERE store_code = p_store_code
  RETURNING last_sequence INTO v_seq;

  IF v_seq IS NULL THEN
    INSERT INTO public.store_invoice_sequences (store_code, last_sequence)
    VALUES (p_store_code, 1)
    RETURNING last_sequence INTO v_seq;
  END IF;

  RETURN 'CS26' || v_numeric_code || v_seq::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. SCHEMA ALTERATIONS FOR PRODUCTS, SALES & SALE_ITEMS
ALTER TABLE public.products ALTER COLUMN barcode DROP NOT NULL;
ALTER TABLE public.products ALTER COLUMN hsn_code DROP NOT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand VARCHAR(64) DEFAULT 'Generic';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS model VARCHAR(64);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS transfer_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS warranty_months INT NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_stock INT NOT NULL DEFAULT 10;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS store_code_numeric VARCHAR(8);
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS warranty_expiry_date DATE;

ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS warranty_months INT DEFAULT 0;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS warranty_expiry_date DATE;
