-- Create raw_materials table (replaces components for BOM usage)
CREATE TABLE public.raw_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  item_group TEXT,
  item_type TEXT DEFAULT 'RAW_MATERIAL',
  stock_quantity NUMERIC NOT NULL DEFAULT 0,
  reserved_quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'unit',
  price NUMERIC,
  cost_per_unit NUMERIC,
  stock_control BOOLEAN DEFAULT true,
  has_batch_no BOOLEAN DEFAULT false,
  autocount_item_code TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Migrate existing components data to raw_materials (preserve IDs)
INSERT INTO public.raw_materials (
  id, sku, name, description, item_group, item_type,
  stock_quantity, reserved_quantity, unit, price, cost_per_unit,
  stock_control, has_batch_no, autocount_item_code, last_synced_at,
  created_at, updated_at
)
SELECT 
  id, sku, name, description, item_group, item_type,
  stock_quantity, reserved_quantity, unit, price, cost_per_unit,
  stock_control, has_batch_no, autocount_item_code, last_synced_at,
  created_at, updated_at
FROM public.components;

-- Enable RLS on raw_materials
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;

-- RLS policies for raw_materials
CREATE POLICY "Admins can manage raw materials"
ON public.raw_materials
FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Authenticated users can view raw materials"
ON public.raw_materials
FOR SELECT
USING (true);

CREATE POLICY "Warehouse can update raw materials"
ON public.raw_materials
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM user_profiles
  WHERE user_profiles.id = auth.uid()
  AND user_profiles.role IN ('Admin', 'Warehouse')
));

-- Update bom_items to reference raw_materials instead of components
ALTER TABLE public.bom_items DROP CONSTRAINT IF EXISTS bom_items_component_id_fkey;
ALTER TABLE public.bom_items RENAME COLUMN component_id TO raw_material_id;
ALTER TABLE public.bom_items ADD CONSTRAINT bom_items_raw_material_id_fkey
  FOREIGN KEY (raw_material_id) REFERENCES public.raw_materials(id);

-- Create finished_goods table (for completed products)
CREATE TABLE public.finished_goods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  item_group TEXT,
  item_type TEXT DEFAULT 'FINISHED_GOOD',
  stock_quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'unit',
  price NUMERIC,
  cost_per_unit NUMERIC,
  autocount_item_code TEXT NOT NULL,
  autocount_synced BOOLEAN NOT NULL DEFAULT false,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on finished_goods
ALTER TABLE public.finished_goods ENABLE ROW LEVEL SECURITY;

-- RLS policies for finished_goods
CREATE POLICY "Admins can manage finished goods"
ON public.finished_goods
FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Authenticated users can view finished goods"
ON public.finished_goods
FOR SELECT
USING (true);

CREATE POLICY "Production can update finished goods"
ON public.finished_goods
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM user_profiles
  WHERE user_profiles.id = auth.uid()
  AND user_profiles.role IN ('Admin', 'Production')
));

-- Update stock_movements to support raw_materials and finished_goods
ALTER TABLE public.stock_movements 
  DROP CONSTRAINT IF EXISTS stock_movements_item_id_check;

COMMENT ON COLUMN public.stock_movements.item_type IS 
  'Type of item: raw_material, finished_good, or product';

-- Create function to get next raw material code
CREATE OR REPLACE FUNCTION public.get_next_raw_material_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  latest_code TEXT;
  latest_number INTEGER;
  next_number INTEGER;
  next_code TEXT;
BEGIN
  SELECT sku INTO latest_code
  FROM raw_materials
  WHERE sku SIMILAR TO 'RM[0-9]{5}'
  ORDER BY sku DESC
  LIMIT 1;
  
  IF latest_code IS NULL THEN
    next_code := 'RM00001';
  ELSE
    latest_number := CAST(SUBSTRING(latest_code FROM 3 FOR 5) AS INTEGER);
    next_number := latest_number + 1;
    next_code := 'RM' || LPAD(next_number::TEXT, 5, '0');
  END IF;
  
  RETURN next_code;
END;
$$;

-- Update stock reservation functions to use raw_materials
CREATE OR REPLACE FUNCTION public.reserve_stock_for_assembly(
  p_assembly_order_id UUID,
  p_product_id UUID,
  p_quantity NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_bom_item RECORD;
  v_required_qty NUMERIC;
  v_available_qty NUMERIC;
  v_insufficient_items JSONB := '[]'::JSONB;
BEGIN
  FOR v_bom_item IN
    SELECT bi.raw_material_id, bi.quantity, rm.name, rm.sku, rm.stock_quantity, rm.reserved_quantity
    FROM bom_items bi
    JOIN raw_materials rm ON rm.id = bi.raw_material_id
    WHERE bi.product_id = p_product_id
  LOOP
    v_required_qty := v_bom_item.quantity * p_quantity;
    v_available_qty := v_bom_item.stock_quantity - v_bom_item.reserved_quantity;
    
    IF v_available_qty < v_required_qty THEN
      v_insufficient_items := v_insufficient_items || 
        jsonb_build_object(
          'raw_material_id', v_bom_item.raw_material_id,
          'name', v_bom_item.name,
          'sku', v_bom_item.sku,
          'required', v_required_qty,
          'available', v_available_qty,
          'shortage', v_required_qty - v_available_qty
        );
    ELSE
      UPDATE raw_materials
      SET reserved_quantity = reserved_quantity + v_required_qty
      WHERE id = v_bom_item.raw_material_id;
    END IF;
  END LOOP;
  
  IF jsonb_array_length(v_insufficient_items) = 0 THEN
    UPDATE assembly_orders
    SET stock_reserved = true
    WHERE id = p_assembly_order_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Stock reserved successfully');
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Insufficient stock for some raw materials',
      'insufficient_items', v_insufficient_items
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_stock_reservation(
  p_assembly_order_id UUID,
  p_product_id UUID,
  p_quantity NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_bom_item RECORD;
  v_reserved_qty NUMERIC;
BEGIN
  FOR v_bom_item IN
    SELECT bi.raw_material_id, bi.quantity
    FROM bom_items bi
    WHERE bi.product_id = p_product_id
  LOOP
    v_reserved_qty := v_bom_item.quantity * p_quantity;
    
    UPDATE raw_materials
    SET reserved_quantity = GREATEST(0, reserved_quantity - v_reserved_qty)
    WHERE id = v_bom_item.raw_material_id;
  END LOOP;
  
  UPDATE assembly_orders
  SET stock_reserved = false
  WHERE id = p_assembly_order_id;
END;
$$;

-- Update stock quantity trigger to support raw_materials and finished_goods
CREATE OR REPLACE FUNCTION public.update_stock_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.item_type = 'product' THEN
    UPDATE products
    SET stock_quantity = stock_quantity + NEW.quantity
    WHERE id = NEW.item_id;
  ELSIF NEW.item_type = 'raw_material' THEN
    UPDATE raw_materials
    SET stock_quantity = stock_quantity + NEW.quantity
    WHERE id = NEW.item_id;
  ELSIF NEW.item_type = 'finished_good' THEN
    UPDATE finished_goods
    SET stock_quantity = stock_quantity + NEW.quantity
    WHERE id = NEW.item_id;
  END IF;
  
  RETURN NEW;
END;
$$;