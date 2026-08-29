-- ====================================================================
-- COSKO MIGRATION 005: ROW LEVEL SECURITY (RLS) POLICIES
-- Granular Table Security, Role Enforcement & Multi-Store Isolation
-- ====================================================================

-- 1. STORES TABLE POLICIES
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Stores visible to authenticated users" ON public.stores;
DROP POLICY IF EXISTS "Stores manageable by Level 100 Super Admin" ON public.stores;

CREATE POLICY "stores_select_policy"
  ON public.stores FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "stores_insert_policy"
  ON public.stores FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "stores_update_policy"
  ON public.stores FOR UPDATE TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "stores_delete_policy"
  ON public.stores FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- 2. PROFILES TABLE POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;

CREATE POLICY "profiles_select_policy"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    public.is_super_admin() OR 
    id = auth.uid() OR 
    public.current_user_security_level() >= 80
  );

CREATE POLICY "profiles_update_self"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_super_admin());

CREATE POLICY "profiles_admin_all"
  ON public.profiles FOR ALL TO authenticated
  USING (public.is_super_admin());

-- 3. USER STORE ASSIGNMENTS POLICIES
ALTER TABLE public.user_store_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_store_assignments_select"
  ON public.user_store_assignments FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "user_store_assignments_admin"
  ON public.user_store_assignments FOR ALL TO authenticated
  USING (public.is_super_admin());

-- 4. ROLES & PERMISSIONS POLICIES
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_read" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_write" ON public.roles FOR ALL TO authenticated USING (public.is_super_admin());

CREATE POLICY "permissions_read" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "permissions_write" ON public.permissions FOR ALL TO authenticated USING (public.is_super_admin());

CREATE POLICY "permission_overrides_read" ON public.user_permission_overrides FOR SELECT TO authenticated USING (profile_id = auth.uid() OR public.is_super_admin());
CREATE POLICY "permission_overrides_write" ON public.user_permission_overrides FOR ALL TO authenticated USING (public.is_super_admin());

-- 5. PRODUCTS & INVENTORY POLICIES
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_read" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_write" ON public.products FOR ALL TO authenticated USING (public.current_user_security_level() >= 60);

CREATE POLICY "inventory_read" ON public.inventory FOR SELECT TO authenticated USING (public.user_has_store_access(store_code));
CREATE POLICY "inventory_write" ON public.inventory FOR ALL TO authenticated USING (public.user_has_store_access(store_code) AND public.current_user_security_level() >= 60);

-- 6. CUSTOMERS & CREDIT LEDGER POLICIES
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_read" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers_write" ON public.customers FOR ALL TO authenticated USING (public.current_user_security_level() >= 20);

CREATE POLICY "credit_ledger_read" ON public.customer_credit_ledger FOR SELECT TO authenticated USING (public.user_has_store_access(store_code));
CREATE POLICY "credit_ledger_write" ON public.customer_credit_ledger FOR ALL TO authenticated USING (public.user_has_store_access(store_code) AND public.current_user_security_level() >= 80);

-- 7. VENDORS & PURCHASES POLICIES
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendors_read" ON public.vendors FOR SELECT TO authenticated USING (public.current_user_security_level() >= 60);
CREATE POLICY "vendors_write" ON public.vendors FOR ALL TO authenticated USING (public.current_user_security_level() >= 60);

CREATE POLICY "purchases_read" ON public.purchase_orders FOR SELECT TO authenticated USING (public.user_has_store_access(store_code) AND public.current_user_security_level() >= 60);
CREATE POLICY "purchases_write" ON public.purchase_orders FOR ALL TO authenticated USING (public.user_has_store_access(store_code) AND public.current_user_security_level() >= 60);

-- 8. SALES POLICIES
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_read" ON public.sales FOR SELECT TO authenticated USING (public.user_has_store_access(store_code));
CREATE POLICY "sales_insert" ON public.sales FOR INSERT TO authenticated WITH CHECK (public.user_has_store_access(store_code));
CREATE POLICY "sales_update_delete" ON public.sales FOR UPDATE TO authenticated USING (public.is_super_admin());

CREATE POLICY "sale_items_read" ON public.sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "sale_items_insert" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (true);

-- 9. EXPENSES POLICIES
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_read" ON public.expenses FOR SELECT TO authenticated USING (public.user_has_store_access(store_code) AND public.current_user_security_level() >= 60);
CREATE POLICY "expenses_write" ON public.expenses FOR ALL TO authenticated USING (public.user_has_store_access(store_code) AND public.current_user_security_level() >= 60);

-- 10. BRANDING & SETTINGS POLICIES
ALTER TABLE public.branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branding_read" ON public.branding FOR SELECT TO authenticated USING (true);
CREATE POLICY "branding_write" ON public.branding FOR ALL TO authenticated USING (public.is_super_admin());

-- 11. AUDIT LOGS POLICIES
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_read" ON public.audit_logs FOR SELECT TO authenticated USING (public.current_user_security_level() >= 80);
CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
