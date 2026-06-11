
-- 1) Atomic production logging RPC
CREATE OR REPLACE FUNCTION public.log_production(
  p_item_type text,
  p_item_id uuid,
  p_quantity numeric,
  p_notes text DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_parent_raw_material_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_user uuid := auth.uid();
  v_bom_product_id uuid := p_product_id;
  v_parent_rm_id uuid := p_parent_raw_material_id;
  v_component_id uuid;
  v_component_sku text;
  v_rm_id uuid;
  v_movement_id uuid;
  v_bi RECORD;
  v_required numeric;
  v_available numeric;
  v_shortages jsonb := '[]'::jsonb;
  v_consumed_ids uuid[] := ARRAY[]::uuid[];
  v_consume_movement_id uuid;
  v_new_qty numeric;
  v_bom_rows RECORD;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_role FROM user_profiles WHERE id = v_user;
  IF v_role NOT IN ('Admin','Production','Warehouse') THEN
    RAISE EXCEPTION 'Insufficient permissions to log production';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Produced quantity must be greater than zero';
  END IF;

  IF p_item_type NOT IN ('component','raw_material') THEN
    RAISE EXCEPTION 'Invalid item_type: %', p_item_type;
  END IF;

  -- Resolve output and BOM lookup keys
  IF p_item_type = 'raw_material' THEN
    -- Lock output row
    SELECT id INTO v_rm_id FROM raw_materials WHERE id = p_item_id FOR UPDATE;
    IF v_rm_id IS NULL THEN
      RAISE EXCEPTION 'Raw material not found';
    END IF;
    IF v_parent_rm_id IS NULL THEN
      v_parent_rm_id := v_rm_id;
    END IF;
  ELSE
    -- component output: resolve component_id (may have been passed a product id)
    SELECT id INTO v_component_id FROM components WHERE id = p_item_id FOR UPDATE;
    IF v_component_id IS NULL THEN
      -- fall back to product.sku -> component.sku
      SELECT sku INTO v_component_sku FROM products WHERE id = p_item_id;
      IF v_component_sku IS NULL THEN
        RAISE EXCEPTION 'Product/component not found for production log';
      END IF;
      SELECT id INTO v_component_id FROM components WHERE sku = v_component_sku FOR UPDATE;
      IF v_component_id IS NULL THEN
        RAISE EXCEPTION 'No matching component found for SKU %', v_component_sku;
      END IF;
    END IF;
    IF v_bom_product_id IS NULL THEN
      SELECT id INTO v_bom_product_id FROM products WHERE component_id = v_component_id;
    END IF;
  END IF;

  -- Lock all BOM ingredient rows in a stable order to avoid deadlocks
  -- (component first, then raw_material; per-table sorted by id)
  IF v_bom_product_id IS NOT NULL OR v_parent_rm_id IS NOT NULL THEN
    PERFORM 1 FROM (
      SELECT c.id
      FROM bom_items bi
      JOIN components c ON c.id = bi.component_id
      WHERE (v_bom_product_id IS NOT NULL AND bi.product_id = v_bom_product_id)
         OR (v_parent_rm_id  IS NOT NULL AND bi.parent_raw_material_id = v_parent_rm_id)
      ORDER BY c.id
      FOR UPDATE OF c
    ) s;

    PERFORM 1 FROM (
      SELECT rm.id
      FROM bom_items bi
      JOIN raw_materials rm ON rm.id = bi.raw_material_id
      WHERE (v_bom_product_id IS NOT NULL AND bi.product_id = v_bom_product_id)
         OR (v_parent_rm_id  IS NOT NULL AND bi.parent_raw_material_id = v_parent_rm_id)
      ORDER BY rm.id
      FOR UPDATE OF rm
    ) s;

    -- Pre-flight availability check
    FOR v_bi IN
      SELECT bi.item_type, bi.raw_material_id, bi.component_id, bi.quantity,
             COALESCE(rm.name, c.name) AS name,
             COALESCE(rm.sku,  c.sku)  AS sku,
             COALESCE(rm.unit, c.unit) AS unit,
             COALESCE(rm.stock_quantity, c.stock_quantity) AS stock_quantity,
             COALESCE(rm.reserved_quantity, c.reserved_quantity) AS reserved_quantity
      FROM bom_items bi
      LEFT JOIN raw_materials rm ON rm.id = bi.raw_material_id
      LEFT JOIN components    c  ON c.id  = bi.component_id
      WHERE (v_bom_product_id IS NOT NULL AND bi.product_id = v_bom_product_id)
         OR (v_parent_rm_id  IS NOT NULL AND bi.parent_raw_material_id = v_parent_rm_id)
    LOOP
      v_required := v_bi.quantity * p_quantity;
      IF v_required = 0 THEN
        CONTINUE;
      END IF;
      v_available := COALESCE(v_bi.stock_quantity, 0) - COALESCE(v_bi.reserved_quantity, 0);
      IF v_available < v_required THEN
        v_shortages := v_shortages || jsonb_build_object(
          'name', v_bi.name,
          'sku', v_bi.sku,
          'unit', v_bi.unit,
          'required', v_required,
          'available', v_available,
          'short_by', v_required - v_available
        );
      END IF;
    END LOOP;

    IF jsonb_array_length(v_shortages) > 0 THEN
      RAISE EXCEPTION 'BOM_SHORTAGE: %', v_shortages::text;
    END IF;
  END IF;

  -- Insert produce movement + bump output stock
  IF p_item_type = 'raw_material' THEN
    INSERT INTO stock_movements (
      item_id, item_type, movement_type, quantity, performed_by, notes, autocount_synced
    ) VALUES (
      v_rm_id, 'raw_material', 'assembly_produce', p_quantity, v_user, p_notes, true
    ) RETURNING id INTO v_movement_id;

    UPDATE raw_materials
       SET stock_quantity = stock_quantity + p_quantity,
           updated_at = now()
     WHERE id = v_rm_id;
  ELSE
    INSERT INTO stock_movements (
      item_id, item_type, movement_type, quantity, performed_by, notes, autocount_synced
    ) VALUES (
      v_component_id, 'component', 'assembly_produce', p_quantity, v_user, p_notes, false
    ) RETURNING id INTO v_movement_id;

    UPDATE components
       SET stock_quantity = stock_quantity + p_quantity,
           updated_at = now()
     WHERE id = v_component_id;
  END IF;

  -- Consume BOM ingredients (no clamps — negatives surface real drift)
  IF v_bom_product_id IS NOT NULL OR v_parent_rm_id IS NOT NULL THEN
    FOR v_bi IN
      SELECT bi.item_type, bi.raw_material_id, bi.component_id, bi.quantity
      FROM bom_items bi
      WHERE (v_bom_product_id IS NOT NULL AND bi.product_id = v_bom_product_id)
         OR (v_parent_rm_id  IS NOT NULL AND bi.parent_raw_material_id = v_parent_rm_id)
    LOOP
      v_required := v_bi.quantity * p_quantity;
      IF v_required = 0 THEN
        CONTINUE;
      END IF;

      IF v_bi.item_type = 'raw_material' AND v_bi.raw_material_id IS NOT NULL THEN
        INSERT INTO stock_movements (
          item_id, item_type, movement_type, quantity, performed_by, notes,
          reference_type, reference_id, autocount_synced
        ) VALUES (
          v_bi.raw_material_id, 'raw_material', 'assembly_consume', -v_required, v_user,
          'Consumed for production (movement ' || v_movement_id || ')',
          'stock_movement', v_movement_id, true
        ) RETURNING id INTO v_consume_movement_id;
        v_consumed_ids := v_consumed_ids || v_consume_movement_id;

        UPDATE raw_materials
           SET stock_quantity = stock_quantity - v_required,
               updated_at = now()
         WHERE id = v_bi.raw_material_id;

      ELSIF v_bi.component_id IS NOT NULL THEN
        INSERT INTO stock_movements (
          item_id, item_type, movement_type, quantity, performed_by, notes,
          reference_type, reference_id, autocount_synced
        ) VALUES (
          v_bi.component_id, 'component', 'assembly_consume', -v_required, v_user,
          'Consumed for production (movement ' || v_movement_id || ')',
          'stock_movement', v_movement_id, false
        ) RETURNING id INTO v_consume_movement_id;
        v_consumed_ids := v_consumed_ids || v_consume_movement_id;

        UPDATE components
           SET stock_quantity = stock_quantity - v_required,
               updated_at = now()
         WHERE id = v_bi.component_id;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'movement_id', v_movement_id,
    'component_id', v_component_id,
    'raw_material_id', v_rm_id,
    'consumed_movement_ids', to_jsonb(v_consumed_ids)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_production(text, uuid, numeric, text, uuid, uuid) TO authenticated;

-- 2) Remove silent zero-clamps so drift surfaces

CREATE OR REPLACE FUNCTION public.complete_sales_order_stock(p_sales_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_line RECORD;
BEGIN
  FOR v_line IN
    SELECT sol.item_code, sol.quantity,
           c.id as component_id
    FROM sales_order_lines sol
    LEFT JOIN components c ON c.autocount_item_code = sol.item_code OR c.sku = sol.item_code
    WHERE sol.sales_order_id = p_sales_order_id
  LOOP
    IF v_line.component_id IS NOT NULL THEN
      UPDATE components
      SET stock_quantity = stock_quantity - v_line.quantity,
          reserved_quantity = reserved_quantity - v_line.quantity
      WHERE id = v_line.component_id;
    END IF;
  END LOOP;

  UPDATE sales_orders
  SET stock_reserved = false
  WHERE id = p_sales_order_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.post_shrinkage_adjustment(p_raw_material_id uuid, p_loss_quantity numeric, p_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_is_perishable boolean;
  v_current_qty numeric;
  v_new_qty numeric;
  v_name text;
  v_sku text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_role FROM user_profiles WHERE id = auth.uid();
  IF v_role NOT IN ('Admin','Warehouse','Production') THEN
    RAISE EXCEPTION 'Insufficient permissions to log shrinkage';
  END IF;

  IF p_loss_quantity IS NULL OR p_loss_quantity <= 0 THEN
    RAISE EXCEPTION 'Loss quantity must be greater than zero';
  END IF;

  IF p_notes IS NULL OR length(trim(p_notes)) = 0 THEN
    RAISE EXCEPTION 'Notes / reason are required';
  END IF;

  SELECT is_perishable, stock_quantity, name, sku
    INTO v_is_perishable, v_current_qty, v_name, v_sku
  FROM raw_materials WHERE id = p_raw_material_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Raw material not found';
  END IF;

  IF NOT v_is_perishable THEN
    RAISE EXCEPTION 'Shrinkage can only be logged on perishable raw materials';
  END IF;

  v_new_qty := v_current_qty - p_loss_quantity;

  INSERT INTO stock_movements (
    item_id, item_type, movement_type, quantity,
    notes, performed_by, autocount_synced
  ) VALUES (
    p_raw_material_id, 'raw_material', 'shrinkage', -p_loss_quantity,
    p_notes, auth.uid(), false
  );

  UPDATE raw_materials
    SET stock_quantity = v_new_qty, updated_at = now()
    WHERE id = p_raw_material_id;

  RETURN jsonb_build_object(
    'success', true,
    'previous_quantity', v_current_qty,
    'new_quantity', v_new_qty,
    'loss', p_loss_quantity
  );
END;
$function$;
