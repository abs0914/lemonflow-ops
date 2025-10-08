-- 1. Create unit_conversions table
CREATE TABLE IF NOT EXISTS public.unit_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_unit text NOT NULL,
  to_unit text NOT NULL,
  conversion_factor numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_unit, to_unit)
);

-- Seed common conversions (only if table is empty)
INSERT INTO public.unit_conversions (from_unit, to_unit, conversion_factor) 
SELECT * FROM (VALUES
  ('kg', 'g', 1000),
  ('g', 'kg', 0.001),
  ('L', 'mL', 1000),
  ('mL', 'L', 0.001),
  ('m', 'cm', 100),
  ('cm', 'm', 0.01),
  ('box', 'unit', 1),
  ('unit', 'box', 1),
  ('carton', 'box', 12),
  ('box', 'carton', 0.0833)
) AS v(from_unit, to_unit, conversion_factor)
WHERE NOT EXISTS (SELECT 1 FROM public.unit_conversions LIMIT 1);

-- RLS policies for unit_conversions
ALTER TABLE public.unit_conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view unit conversions" ON public.unit_conversions;
CREATE POLICY "Anyone can view unit conversions"
ON public.unit_conversions FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage unit conversions" ON public.unit_conversions;
CREATE POLICY "Admins can manage unit conversions"
ON public.unit_conversions FOR ALL
USING (is_admin(auth.uid()));

-- 2. Add reserved_quantity column to components if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'components' 
    AND column_name = 'reserved_quantity'
  ) THEN
    ALTER TABLE public.components ADD COLUMN reserved_quantity numeric DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Add constraints if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_reserved_not_negative'
  ) THEN
    ALTER TABLE public.components ADD CONSTRAINT check_reserved_not_negative CHECK (reserved_quantity >= 0);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_reserved_not_exceed_stock'
  ) THEN
    ALTER TABLE public.components ADD CONSTRAINT check_reserved_not_exceed_stock CHECK (reserved_quantity <= stock_quantity);
  END IF;
END $$;

-- 3. Enhance stock_movements for warehouse tracking
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'batch_number') THEN
    ALTER TABLE public.stock_movements ADD COLUMN batch_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'supplier_reference') THEN
    ALTER TABLE public.stock_movements ADD COLUMN supplier_reference text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'warehouse_location') THEN
    ALTER TABLE public.stock_movements ADD COLUMN warehouse_location text DEFAULT 'MAIN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'autocount_synced') THEN
    ALTER TABLE public.stock_movements ADD COLUMN autocount_synced boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'autocount_doc_no') THEN
    ALTER TABLE public.stock_movements ADD COLUMN autocount_doc_no text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'unit_received') THEN
    ALTER TABLE public.stock_movements ADD COLUMN unit_received text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'quantity_in_base_unit') THEN
    ALTER TABLE public.stock_movements ADD COLUMN quantity_in_base_unit numeric;
  END IF;
END $$;

-- Drop existing indexes if they exist and recreate
DROP INDEX IF EXISTS public.idx_stock_movements_item;
DROP INDEX IF EXISTS public.idx_stock_movements_reference;
DROP INDEX IF EXISTS public.idx_stock_movements_autocount;

CREATE INDEX idx_stock_movements_item ON public.stock_movements(item_type, item_id);
CREATE INDEX idx_stock_movements_reference ON public.stock_movements(reference_type, reference_id);
CREATE INDEX idx_stock_movements_autocount ON public.stock_movements(autocount_synced) WHERE autocount_synced = false;

-- 4. Create autocount_sync_log table
CREATE TABLE IF NOT EXISTS public.autocount_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL,
  reference_type text NOT NULL,
  reference_id uuid NOT NULL,
  sync_status text NOT NULL DEFAULT 'pending',
  autocount_doc_no text,
  error_message text,
  retry_count integer DEFAULT 0,
  synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes
DROP INDEX IF EXISTS public.idx_autocount_sync_status;
DROP INDEX IF EXISTS public.idx_autocount_sync_reference;
CREATE INDEX idx_autocount_sync_status ON public.autocount_sync_log(sync_status);
CREATE INDEX idx_autocount_sync_reference ON public.autocount_sync_log(reference_type, reference_id);

-- RLS policies for autocount_sync_log
ALTER TABLE public.autocount_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view sync logs" ON public.autocount_sync_log;
CREATE POLICY "Admins can view sync logs"
ON public.autocount_sync_log FOR SELECT
USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "System can insert sync logs" ON public.autocount_sync_log;
CREATE POLICY "System can insert sync logs"
ON public.autocount_sync_log FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update sync logs" ON public.autocount_sync_log;
CREATE POLICY "Admins can update sync logs"
ON public.autocount_sync_log FOR UPDATE
USING (is_admin(auth.uid()));

-- 5. Update assembly_orders for stock reservation
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembly_orders' AND column_name = 'stock_reserved') THEN
    ALTER TABLE public.assembly_orders ADD COLUMN stock_reserved boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembly_orders' AND column_name = 'reservation_notes') THEN
    ALTER TABLE public.assembly_orders ADD COLUMN reservation_notes text;
  END IF;
END $$;

-- 6. Create stock reservation functions
CREATE OR REPLACE FUNCTION public.reserve_stock_for_assembly(
  p_assembly_order_id uuid,
  p_product_id uuid,
  p_quantity numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bom_item RECORD;
  v_required_qty numeric;
  v_available_qty numeric;
  v_insufficient_items jsonb := '[]'::jsonb;
BEGIN
  FOR v_bom_item IN
    SELECT bi.component_id, bi.quantity, c.name, c.sku, c.stock_quantity, c.reserved_quantity
    FROM bom_items bi
    JOIN components c ON c.id = bi.component_id
    WHERE bi.product_id = p_product_id
  LOOP
    v_required_qty := v_bom_item.quantity * p_quantity;
    v_available_qty := v_bom_item.stock_quantity - v_bom_item.reserved_quantity;
    
    IF v_available_qty < v_required_qty THEN
      v_insufficient_items := v_insufficient_items || 
        jsonb_build_object(
          'component_id', v_bom_item.component_id,
          'name', v_bom_item.name,
          'sku', v_bom_item.sku,
          'required', v_required_qty,
          'available', v_available_qty,
          'shortage', v_required_qty - v_available_qty
        );
    ELSE
      UPDATE components
      SET reserved_quantity = reserved_quantity + v_required_qty
      WHERE id = v_bom_item.component_id;
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
      'message', 'Insufficient stock for some components',
      'insufficient_items', v_insufficient_items
    );
  END IF;
END;
$$;

-- 7. Create stock release function
CREATE OR REPLACE FUNCTION public.release_stock_reservation(
  p_assembly_order_id uuid,
  p_product_id uuid,
  p_quantity numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bom_item RECORD;
  v_reserved_qty numeric;
BEGIN
  FOR v_bom_item IN
    SELECT bi.component_id, bi.quantity
    FROM bom_items bi
    WHERE bi.product_id = p_product_id
  LOOP
    v_reserved_qty := v_bom_item.quantity * p_quantity;
    
    UPDATE components
    SET reserved_quantity = GREATEST(0, reserved_quantity - v_reserved_qty)
    WHERE id = v_bom_item.component_id;
  END LOOP;
  
  UPDATE assembly_orders
  SET stock_reserved = false
  WHERE id = p_assembly_order_id;
END;
$$;