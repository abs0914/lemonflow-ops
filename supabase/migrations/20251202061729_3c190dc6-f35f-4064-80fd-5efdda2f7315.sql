-- 1. Stores table (links to AutoCount debtors)
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code TEXT NOT NULL UNIQUE,
  store_name TEXT NOT NULL,
  store_type TEXT CHECK (store_type IN ('own_store', 'franchisee')),
  debtor_code TEXT NOT NULL,
  address TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. User-Store assignments
CREATE TABLE user_store_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT true,
  can_place_orders BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, store_id)
);

-- 3. Sales Orders
CREATE TABLE sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  store_id UUID REFERENCES stores(id),
  debtor_code TEXT NOT NULL,
  doc_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'processing', 'completed', 'cancelled')),
  description TEXT,
  total_amount NUMERIC DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES auth.users(id),
  autocount_doc_no TEXT,
  autocount_synced BOOLEAN DEFAULT false,
  sync_error_message TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Sales Order Lines
CREATE TABLE sales_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  item_code TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC DEFAULT 0,
  uom TEXT DEFAULT 'UNIT',
  discount TEXT,
  sub_total NUMERIC DEFAULT 0,
  tax_code TEXT,
  line_remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Auto-generate order number function
CREATE OR REPLACE FUNCTION generate_sales_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_date TEXT;
  seq_number INTEGER;
  new_order_number TEXT;
BEGIN
  today_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(order_number FROM 'SO-' || today_date || '-([0-9]+)') AS INTEGER)
  ), 0) + 1
  INTO seq_number
  FROM sales_orders
  WHERE order_number LIKE 'SO-' || today_date || '-%';
  
  new_order_number := 'SO-' || today_date || '-' || LPAD(seq_number::TEXT, 4, '0');
  RETURN new_order_number;
END;
$$;

-- 6. Update trigger for updated_at
CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_orders_updated_at
  BEFORE UPDATE ON sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_order_lines_updated_at
  BEFORE UPDATE ON sales_order_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. RLS Policies
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_store_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_lines ENABLE ROW LEVEL SECURITY;

-- Stores: Admins manage, authenticated view
CREATE POLICY "Admins can manage stores" 
  ON stores FOR ALL 
  USING (is_admin(auth.uid()));

CREATE POLICY "Authenticated users can view stores" 
  ON stores FOR SELECT 
  USING (true);

-- User Store Assignments: Admins manage, users see own
CREATE POLICY "Admins can manage assignments" 
  ON user_store_assignments FOR ALL 
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can view own assignments" 
  ON user_store_assignments FOR SELECT 
  USING (auth.uid() = user_id);

-- Sales Orders: Store users see own, Admins see all
CREATE POLICY "Admins can manage all orders" 
  ON sales_orders FOR ALL 
  USING (is_admin(auth.uid()));

CREATE POLICY "Store users can view own store orders" 
  ON sales_orders FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM user_store_assignments 
      WHERE user_id = auth.uid() AND store_id = sales_orders.store_id
    )
  );

CREATE POLICY "Store users can create orders" 
  ON sales_orders FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_store_assignments 
      WHERE user_id = auth.uid() 
        AND store_id = sales_orders.store_id 
        AND can_place_orders = true
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Store users can update own draft orders" 
  ON sales_orders FOR UPDATE
  USING (created_by = auth.uid() AND status = 'draft');

-- Sales Order Lines: follow parent order access
CREATE POLICY "Admins can manage all lines" 
  ON sales_order_lines FOR ALL 
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can view lines for accessible orders" 
  ON sales_order_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sales_orders so
      JOIN user_store_assignments usa ON usa.store_id = so.store_id
      WHERE so.id = sales_order_lines.sales_order_id 
        AND usa.user_id = auth.uid()
    ) OR is_admin(auth.uid())
  );

CREATE POLICY "Store users can manage lines for own draft orders"
  ON sales_order_lines FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sales_orders so
      WHERE so.id = sales_order_lines.sales_order_id
        AND so.created_by = auth.uid()
        AND so.status = 'draft'
    )
  );