-- ====================================================================
-- COSKO MIGRATION 003: PERFORMANCE INDEXES
-- Optimizes query execution speeds for high-volume enterprise traffic
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_stores_code ON public.stores(code);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_store_scope ON public.profiles(store_scope);

CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);

CREATE INDEX IF NOT EXISTS idx_inventory_store_code ON public.inventory(store_code);
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON public.inventory(product_id);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_number ON public.sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_store_code ON public.sales(store_code);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_store_code ON public.expenses(store_code);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
