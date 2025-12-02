-- ============================================================================
-- ORDER MANAGEMENT SYSTEM SCHEMA
-- Enables Franchisees and Own Stores to place orders from central inventory
-- Orders sync to AutoCount as Sales Orders (SO)
-- ============================================================================

-- ============================================================================
-- 1. STORES TABLE - Links authenticated users to AutoCount debtors
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code TEXT NOT NULL UNIQUE,                    -- e.g., 'STORE-001', 'FRAN-001'
  store_name TEXT NOT NULL,                           -- e.g., 'Lemonco SM Mall Branch'
  store_type TEXT NOT NULL DEFAULT 'own_store' 
    CHECK (store_type IN ('own_store', 'franchisee')),
  debtor_code TEXT NOT NULL,                          -- Maps to AutoCount debtor (customer)
  address TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on debtor_code for quick AutoCount lookups
CREATE INDEX IF NOT EXISTS idx_stores_debtor_code ON public.stores(debtor_code);
CREATE INDEX IF NOT EXISTS idx_stores_active ON public.stores(is_active);
CREATE INDEX IF NOT EXISTS idx_stores_type ON public.stores(store_type);

-- ============================================================================
-- 2. USER-STORE ASSIGNMENT - Links users to their assigned store(s)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_store_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT true,           -- Primary store for user
  can_place_orders BOOLEAN NOT NULL DEFAULT true,     -- Permission to create orders
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_user_store_user ON public.user_store_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_store_store ON public.user_store_assignments(store_id);

-- ============================================================================
-- 3. SALES ORDERS TABLE - Orders placed by stores
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,                  -- Generated: SO-YYYYMMDD-XXXX
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  debtor_code TEXT NOT NULL,                          -- Denormalized from store for AutoCount
  doc_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' 
    CHECK (status IN ('draft', 'submitted', 'processing', 'completed', 'cancelled')),
  description TEXT,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES auth.users(id),
  
  -- AutoCount sync fields
  autocount_doc_no TEXT,                              -- SO number from AutoCount
  autocount_synced BOOLEAN NOT NULL DEFAULT false,
  sync_error_message TEXT,
  synced_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_orders_store ON public.sales_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON public.sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_debtor ON public.sales_orders(debtor_code);
CREATE INDEX IF NOT EXISTS idx_sales_orders_synced ON public.sales_orders(autocount_synced);
CREATE INDEX IF NOT EXISTS idx_sales_orders_date ON public.sales_orders(doc_date DESC);

-- ============================================================================
-- 4. SALES ORDER LINES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sales_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  item_code TEXT NOT NULL,                            -- AutoCount item code
  item_name TEXT NOT NULL,                            -- Denormalized for display
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL DEFAULT 0,
  uom TEXT NOT NULL DEFAULT 'UNIT',
  discount TEXT,                                      -- Discount string (e.g., '10%' or '5.00')
  sub_total NUMERIC NOT NULL DEFAULT 0,
  tax_code TEXT,
  line_remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sales_order_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_so_lines_order ON public.sales_order_lines(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_so_lines_item ON public.sales_order_lines(item_code);

-- ============================================================================
-- 5. SEQUENCE TABLE FOR ORDER NUMBERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.order_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_key DATE NOT NULL UNIQUE,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6. FUNCTION: Generate next order number
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_sales_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_key DATE := CURRENT_DATE;
  v_sequence INTEGER;
  v_order_number TEXT;
BEGIN
  -- Get or create sequence for today
  INSERT INTO order_sequences (date_key, last_sequence)
  VALUES (v_date_key, 1)
  ON CONFLICT (date_key)
  DO UPDATE SET last_sequence = order_sequences.last_sequence + 1
  RETURNING last_sequence INTO v_sequence;

  -- Format: SO-YYYYMMDD-XXXX (e.g., SO-20251202-0001)
  v_order_number := 'SO-' || to_char(v_date_key, 'YYYYMMDD') || '-' || lpad(v_sequence::TEXT, 4, '0');

  RETURN v_order_number;
END;
$$;

-- ============================================================================
-- 7. TRIGGERS FOR updated_at
-- ============================================================================
CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_orders_updated_at
  BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_order_lines_updated_at
  BEFORE UPDATE ON public.sales_order_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 8. HELPER FUNCTION: Check if user has store access
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_has_store_access(p_user_id UUID, p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_store_assignments
    WHERE user_id = p_user_id AND store_id = p_store_id
  ) OR EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = p_user_id AND role = 'Admin'
  );
$$;

-- ============================================================================
-- 9. ADD 'Store' ROLE TO user_profiles IF NOT EXISTS
-- ============================================================================
DO $$
BEGIN
  -- Update the check constraint to include 'Store' role
  ALTER TABLE public.user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_role_check;

  ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_role_check
    CHECK (role IN ('Admin', 'Production', 'Warehouse', 'Store'));
END $$;

-- ============================================================================
-- 10. ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_store_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_lines ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 11. RLS POLICIES FOR STORES
-- ============================================================================
CREATE POLICY "Admins can manage all stores"
  ON public.stores FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Store users can view their assigned stores"
  ON public.stores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_store_assignments
      WHERE user_id = auth.uid() AND store_id = stores.id
    )
  );

-- ============================================================================
-- 12. RLS POLICIES FOR USER_STORE_ASSIGNMENTS
-- ============================================================================
CREATE POLICY "Admins can manage all assignments"
  ON public.user_store_assignments FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can view their own assignments"
  ON public.user_store_assignments FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================================
-- 13. RLS POLICIES FOR SALES_ORDERS
-- ============================================================================
CREATE POLICY "Admins can manage all orders"
  ON public.sales_orders FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Store users can view their store orders"
  ON public.sales_orders FOR SELECT
  USING (user_has_store_access(auth.uid(), store_id));

CREATE POLICY "Store users can create orders for their stores"
  ON public.sales_orders FOR INSERT
  WITH CHECK (
    user_has_store_access(auth.uid(), store_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "Store users can update draft orders"
  ON public.sales_orders FOR UPDATE
  USING (
    user_has_store_access(auth.uid(), store_id)
    AND status = 'draft'
  );

-- ============================================================================
-- 14. RLS POLICIES FOR SALES_ORDER_LINES
-- ============================================================================
CREATE POLICY "Admins can manage all order lines"
  ON public.sales_order_lines FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Store users can manage lines for their orders"
  ON public.sales_order_lines FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sales_orders so
      WHERE so.id = sales_order_lines.sales_order_id
      AND user_has_store_access(auth.uid(), so.store_id)
    )
  );

