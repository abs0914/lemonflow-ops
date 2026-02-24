
-- Add component_id column to bom_items (nullable, since items can be either component or raw_material)
ALTER TABLE public.bom_items
  ADD COLUMN component_id uuid REFERENCES public.components(id),
  ADD COLUMN item_type text NOT NULL DEFAULT 'raw_material';

-- Make raw_material_id nullable (since BOM item could be a component instead)
ALTER TABLE public.bom_items
  ALTER COLUMN raw_material_id DROP NOT NULL;

-- Add check constraint: exactly one of raw_material_id or component_id must be set
ALTER TABLE public.bom_items
  ADD CONSTRAINT check_single_bom_item_reference
  CHECK (
    (raw_material_id IS NOT NULL AND component_id IS NULL AND item_type = 'raw_material')
    OR
    (component_id IS NOT NULL AND raw_material_id IS NULL AND item_type = 'component')
  );

-- Update reserve_stock_for_assembly to handle components
CREATE OR REPLACE FUNCTION public.reserve_stock_for_assembly(p_assembly_order_id uuid, p_product_id uuid, p_quantity numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bom_item RECORD;
  v_required_qty NUMERIC;
  v_available_qty NUMERIC;
  v_insufficient_items JSONB := '[]'::JSONB;
BEGIN
  FOR v_bom_item IN
    SELECT 
      bi.raw_material_id, bi.component_id, bi.item_type, bi.quantity,
      COALESCE(rm.name, c.name) as name,
      COALESCE(rm.sku, c.sku) as sku,
      COALESCE(rm.stock_quantity, c.stock_quantity) as stock_quantity,
      COALESCE(rm.reserved_quantity, c.reserved_quantity) as reserved_quantity
    FROM bom_items bi
    LEFT JOIN raw_materials rm ON rm.id = bi.raw_material_id
    LEFT JOIN components c ON c.id = bi.component_id
    WHERE bi.product_id = p_product_id
  LOOP
    v_required_qty := v_bom_item.quantity * p_quantity;
    v_available_qty := v_bom_item.stock_quantity - v_bom_item.reserved_quantity;
    
    IF v_available_qty < v_required_qty THEN
      v_insufficient_items := v_insufficient_items || 
        jsonb_build_object(
          'raw_material_id', COALESCE(v_bom_item.raw_material_id, v_bom_item.component_id),
          'name', v_bom_item.name,
          'sku', v_bom_item.sku,
          'required', v_required_qty,
          'available', v_available_qty,
          'shortage', v_required_qty - v_available_qty
        );
    ELSE
      IF v_bom_item.item_type = 'raw_material' THEN
        UPDATE raw_materials
        SET reserved_quantity = reserved_quantity + v_required_qty
        WHERE id = v_bom_item.raw_material_id;
      ELSE
        UPDATE components
        SET reserved_quantity = reserved_quantity + v_required_qty
        WHERE id = v_bom_item.component_id;
      END IF;
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
      'message', 'Insufficient stock for some items',
      'insufficient_items', v_insufficient_items
    );
  END IF;
END;
$function$;

-- Update release_stock_reservation to handle components
CREATE OR REPLACE FUNCTION public.release_stock_reservation(p_assembly_order_id uuid, p_product_id uuid, p_quantity numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bom_item RECORD;
  v_reserved_qty NUMERIC;
BEGIN
  FOR v_bom_item IN
    SELECT bi.raw_material_id, bi.component_id, bi.item_type, bi.quantity
    FROM bom_items bi
    WHERE bi.product_id = p_product_id
  LOOP
    v_reserved_qty := v_bom_item.quantity * p_quantity;
    
    IF v_bom_item.item_type = 'raw_material' THEN
      UPDATE raw_materials
      SET reserved_quantity = GREATEST(0, reserved_quantity - v_reserved_qty)
      WHERE id = v_bom_item.raw_material_id;
    ELSE
      UPDATE components
      SET reserved_quantity = GREATEST(0, reserved_quantity - v_reserved_qty)
      WHERE id = v_bom_item.component_id;
    END IF;
  END LOOP;
  
  UPDATE assembly_orders
  SET stock_reserved = false
  WHERE id = p_assembly_order_id;
END;
$function$;
