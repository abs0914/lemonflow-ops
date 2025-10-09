-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_code TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  credit_terms INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  autocount_synced BOOLEAN NOT NULL DEFAULT false,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_code TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  credit_terms INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  autocount_synced BOOLEAN NOT NULL DEFAULT false,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create purchase_orders table
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number TEXT NOT NULL UNIQUE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  doc_date DATE NOT NULL,
  delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'cancelled')),
  total_amount NUMERIC NOT NULL DEFAULT 0,
  remarks TEXT,
  created_by UUID NOT NULL,
  autocount_doc_no TEXT,
  autocount_synced BOOLEAN NOT NULL DEFAULT false,
  sync_error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create purchase_order_lines table
CREATE TABLE public.purchase_order_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES public.components(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  uom TEXT NOT NULL,
  line_remarks TEXT,
  line_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add purchase_order_id to stock_movements for linking receipts to POs
ALTER TABLE public.stock_movements
ADD COLUMN purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL;

-- Enable Row Level Security
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for suppliers
CREATE POLICY "Admins can manage suppliers"
  ON public.suppliers
  FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Authenticated users can view suppliers"
  ON public.suppliers
  FOR SELECT
  USING (true);

-- RLS Policies for customers
CREATE POLICY "Admins can manage customers"
  ON public.customers
  FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Authenticated users can view customers"
  ON public.customers
  FOR SELECT
  USING (true);

-- RLS Policies for purchase_orders
CREATE POLICY "Admins and Warehouse can create purchase orders"
  ON public.purchase_orders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
      AND role IN ('Admin', 'Warehouse')
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Admins and Warehouse can view purchase orders"
  ON public.purchase_orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
      AND role IN ('Admin', 'Warehouse')
    )
  );

CREATE POLICY "Admins and Warehouse can update purchase orders"
  ON public.purchase_orders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
      AND role IN ('Admin', 'Warehouse')
    )
  );

CREATE POLICY "Admins can delete purchase orders"
  ON public.purchase_orders
  FOR DELETE
  USING (is_admin(auth.uid()));

-- RLS Policies for purchase_order_lines
CREATE POLICY "Admins and Warehouse can manage PO lines"
  ON public.purchase_order_lines
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
      AND role IN ('Admin', 'Warehouse')
    )
  );

-- Create triggers for updated_at
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_order_lines_updated_at
  BEFORE UPDATE ON public.purchase_order_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_suppliers_code ON public.suppliers(supplier_code);
CREATE INDEX idx_suppliers_active ON public.suppliers(is_active);
CREATE INDEX idx_customers_code ON public.customers(customer_code);
CREATE INDEX idx_customers_active ON public.customers(is_active);
CREATE INDEX idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX idx_purchase_orders_synced ON public.purchase_orders(autocount_synced);
CREATE INDEX idx_purchase_order_lines_po ON public.purchase_order_lines(purchase_order_id);
CREATE INDEX idx_stock_movements_po ON public.stock_movements(purchase_order_id);