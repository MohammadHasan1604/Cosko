-- ====================================================================
-- COSKO MIGRATION 004: FUNCTIONS & TRIGGERS
-- Automatic Profile Provisioning, RLS Helpers & Atomic Transactions
-- ====================================================================

-- 1. AUTOMATIC PROFILE CREATION TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    name,
    email,
    role,
    security_level,
    store_scope,
    status
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'Store Manager'),
    CASE 
      WHEN NEW.raw_user_meta_data->>'role' = 'Super Admin' THEN 100
      WHEN NEW.raw_user_meta_data->>'role' = 'Store Manager' THEN 80
      WHEN NEW.raw_user_meta_data->>'role' = 'Inventory Auditor' THEN 60
      WHEN NEW.raw_user_meta_data->>'role' = 'Sales Executive' THEN 40
      WHEN NEW.raw_user_meta_data->>'role' = 'POS Cashier' THEN 20
      ELSE 20
    END,
    COALESCE(NEW.raw_user_meta_data->>'store_code', 'BLR'),
    'Active'
  )
  ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Bind trigger to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. RLS HELPER FUNCTIONS FOR SECURITY POLICIES

-- Returns current authenticated user's security level from profiles table
CREATE OR REPLACE FUNCTION public.current_user_security_level()
RETURNS INT AS $$
DECLARE
  v_level INT;
BEGIN
  SELECT security_level INTO v_level
  FROM public.profiles
  WHERE id = auth.uid();

  RETURN COALESCE(v_level, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE;

-- Returns true if current user is Level 100 Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.current_user_security_level() = 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE;

-- Checks if current user has access scope to given store_code
CREATE OR REPLACE FUNCTION public.user_has_store_access(p_store_code VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_store VARCHAR;
  v_security_level INT;
BEGIN
  SELECT security_level, store_scope INTO v_security_level, v_user_store
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_security_level = 100 OR v_user_store = 'All Stores' OR v_user_store = p_store_code THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_store_assignments
    WHERE profile_id = auth.uid() AND store_code = p_store_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE;

-- 3. ATOMIC POS CHECKOUT RPC FUNCTION
CREATE OR REPLACE FUNCTION public.process_pos_checkout(
  p_invoice_number VARCHAR,
  p_store_code VARCHAR,
  p_customer_name VARCHAR,
  p_customer_phone VARCHAR,
  p_subtotal NUMERIC,
  p_gst_total NUMERIC,
  p_discount NUMERIC,
  p_grand_total NUMERIC,
  p_payment_method VARCHAR,
  p_cashier_name VARCHAR
) RETURNS UUID AS $$
DECLARE
  v_sale_id UUID;
BEGIN
  -- Verify store access authorization
  IF NOT public.user_has_store_access(p_store_code) THEN
    RAISE EXCEPTION '403 Forbidden: User does not have access to store scope %', p_store_code;
  END IF;

  INSERT INTO public.sales (
    invoice_number, store_code, customer_name, customer_phone,
    subtotal, gst_total, discount_amount, grand_total, payment_method, cashier_name
  ) VALUES (
    p_invoice_number, p_store_code, p_customer_name, p_customer_phone,
    p_subtotal, p_gst_total, p_discount, p_grand_total, p_payment_method, p_cashier_name
  ) RETURNING id INTO v_sale_id;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
