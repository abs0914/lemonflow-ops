
-- 1. Allow new movement type for production consumption adjustments
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS valid_movement_type;
ALTER TABLE public.stock_movements ADD CONSTRAINT valid_movement_type CHECK (
  movement_type = ANY (ARRAY[
    'receipt'::text, 'issue'::text, 'adjustment'::text,
    'assembly_consume'::text, 'assembly_produce'::text,
    'assembly_adjust'::text, 'shrinkage'::text
  ])
);

-- 2. Extend log_production to accept actual consumption overrides
CREATE OR REPLACE FUNCTION public.log_production(
  p_item_type text,
  p_item_id uuid,
  p_quantity numeric,
  p_notes text DEFAULT NULL::text,
  p_product_id uuid DEFAULT NULL::uuid,
  p_parent_raw_material_id uuid DEFAULT NULL::uuid,
  p_actual_consumption jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_expected numeric;
  v_actual_override numeric;
  v_available numeric;
  v_shortages jsonb := '[]'::jsonb;
  v_consumed_ids uuid[] := ARRAY[]::uuid[];
  v_consume_movement_id uuid;
  v_lookup_key text;
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

  IF p_item_type = 'raw_material' THEN
    SELECT id INTO v_rm_id FROM raw_materials WHERE id = p_item_id FOR UPDATE;
    IF v_rm_id IS NULL THEN
      RAISE EXCEPTION 'Raw material not found';
    END IF;
    IF v_parent_rm_id IS NULL THEN
      v_parent_rm_id := v_rm_id;
    END IF;
  ELSE
    SELECT id INTO v_component_id FROM components WHERE id = p_item_id FOR UPDATE;
    IF v_component_id IS NULL THEN
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

  IF v_bom_product_id IS NOT NULL OR v_parent_rm_id IS NOT NULL THEN
    PERFORM 1 FROM (
      SELECT c.id FROM bom_items bi JOIN components c ON c.id = bi.component_id
      WHERE (v_bom_product_id IS NOT NULL AND bi.product_id = v_bom_product_id)
         OR (v_parent_rm_id  IS NOT NULL AND bi.parent_raw_material_id = v_parent_rm_id)
      ORDER BY c.id FOR UPDATE OF c
    ) s;

    PERFORM 1 FROM (
      SELECT rm.id FROM bom_items bi JOIN raw_materials rm ON rm.id = bi.raw_material_id
      WHERE (v_bom_product_id IS NOT NULL AND bi.product_id = v_bom_product_id)
         OR (v_parent_rm_id  IS NOT NULL AND bi.parent_raw_material_id = v_parent_rm_id)
      ORDER BY rm.id FOR UPDATE OF rm
    ) s;

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
      v_expected := v_bi.quantity * p_quantity;
      v_actual_override := NULL;

      IF p_actual_consumption IS NOT NULL THEN
        v_lookup_key := COALESCE(v_bi.raw_material_id::text, v_bi.component_id::text);
        SELECT (elem->>'quantity')::numeric INTO v_actual_override
        FROM jsonb_array_elements(p_actual_consumption) elem
        WHERE elem->>'item_id' = v_lookup_key
          AND elem->>'item_type' = v_bi.item_type
        LIMIT 1;
      END IF;

      v_required := COALESCE(v_actual_override, v_expected);

      IF v_required = 0 THEN
        CONTINUE;
      END IF;

      v_available := COALESCE(v_bi.stock_quantity, 0) - COALESCE(v_bi.reserved_quantity, 0);
      IF v_available < v_required THEN
        v_shortages := v_shortages || jsonb_build_object(
          'name', v_bi.name, 'sku', v_bi.sku, 'unit', v_bi.unit,
          'required', v_required, 'available', v_available,
          'short_by', v_required - v_available
        );
      END IF;
    END LOOP;

    IF jsonb_array_length(v_shortages) > 0 THEN
      RAISE EXCEPTION 'BOM_SHORTAGE: %', v_shortages::text;
    END IF;
  END IF;

  -- Insert produce movement
  IF p_item_type = 'raw_material' THEN
    INSERT INTO stock_movements (item_id, item_type, movement_type, quantity, performed_by, notes, autocount_synced)
    VALUES (v_rm_id, 'raw_material', 'assembly_produce', p_quantity, v_user, p_notes, true)
    RETURNING id INTO v_movement_id;

    UPDATE raw_materials SET stock_quantity = stock_quantity + p_quantity, updated_at = now() WHERE id = v_rm_id;
  ELSE
    INSERT INTO stock_movements (item_id, item_type, movement_type, quantity, performed_by, notes, autocount_synced)
    VALUES (v_component_id, 'component', 'assembly_produce', p_quantity, v_user, p_notes, false)
    RETURNING id INTO v_movement_id;

    UPDATE components SET stock_quantity = stock_quantity + p_quantity, updated_at = now() WHERE id = v_component_id;
  END IF;

  -- Consume BOM ingredients
  IF v_bom_product_id IS NOT NULL OR v_parent_rm_id IS NOT NULL THEN
    FOR v_bi IN
      SELECT bi.item_type, bi.raw_material_id, bi.component_id, bi.quantity
      FROM bom_items bi
      WHERE (v_bom_product_id IS NOT NULL AND bi.product_id = v_bom_product_id)
         OR (v_parent_rm_id  IS NOT NULL AND bi.parent_raw_material_id = v_parent_rm_id)
    LOOP
      v_expected := v_bi.quantity * p_quantity;
      v_actual_override := NULL;

      IF p_actual_consumption IS NOT NULL THEN
        v_lookup_key := COALESCE(v_bi.raw_material_id::text, v_bi.component_id::text);
        SELECT (elem->>'quantity')::numeric INTO v_actual_override
        FROM jsonb_array_elements(p_actual_consumption) elem
        WHERE elem->>'item_id' = v_lookup_key
          AND elem->>'item_type' = v_bi.item_type
        LIMIT 1;
      END IF;

      v_required := COALESCE(v_actual_override, v_expected);

      IF v_required = 0 THEN
        CONTINUE;
      END IF;

      IF v_bi.item_type = 'raw_material' AND v_bi.raw_material_id IS NOT NULL THEN
        INSERT INTO stock_movements (
          item_id, item_type, movement_type, quantity, performed_by, notes,
          reference_type, reference_id, autocount_synced
        ) VALUES (
          v_bi.raw_material_id, 'raw_material', 'assembly_consume', -v_required, v_user,
          'Consumed for production (movement ' || v_movement_id || '). Expected: ' || v_expected,
          'stock_movement', v_movement_id, true
        ) RETURNING id INTO v_consume_movement_id;
        v_consumed_ids := v_consumed_ids || v_consume_movement_id;

        UPDATE raw_materials SET stock_quantity = stock_quantity - v_required, updated_at = now()
          WHERE id = v_bi.raw_material_id;

      ELSIF v_bi.component_id IS NOT NULL THEN
        INSERT INTO stock_movements (
          item_id, item_type, movement_type, quantity, performed_by, notes,
          reference_type, reference_id, autocount_synced
        ) VALUES (
          v_bi.component_id, 'component', 'assembly_consume', -v_required, v_user,
          'Consumed for production (movement ' || v_movement_id || '). Expected: ' || v_expected,
          'stock_movement', v_movement_id, false
        ) RETURNING id INTO v_consume_movement_id;
        v_consumed_ids := v_consumed_ids || v_consume_movement_id;

        UPDATE components SET stock_quantity = stock_quantity - v_required, updated_at = now()
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
$function$;

-- 3. New RPC for post-log consumption adjustments
CREATE OR REPLACE FUNCTION public.adjust_production_consumption(
  p_produce_movement_id uuid,
  p_adjustments jsonb,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
  v_produce RECORD;
  v_adj RECORD;
  v_current_consumed numeric;
  v_new_actual numeric;
  v_delta numeric;
  v_adjustments_made jsonb := '[]'::jsonb;
  v_adj_movement_id uuid;
  v_item_name text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_role FROM user_profiles WHERE id = v_user;
  IF v_role NOT IN ('Admin','Production','Warehouse') THEN
    RAISE EXCEPTION 'Insufficient permissions to adjust production consumption';
  END IF;

  SELECT * INTO v_produce FROM stock_movements
    WHERE id = p_produce_movement_id AND movement_type = 'assembly_produce';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production movement not found';
  END IF;

  FOR v_adj IN
    SELECT
      (elem->>'item_id')::uuid AS item_id,
      elem->>'item_type'       AS item_type,
      (elem->>'quantity')::numeric AS new_actual
    FROM jsonb_array_elements(p_adjustments) elem
  LOOP
    IF v_adj.item_type NOT IN ('raw_material','component') THEN
      CONTINUE;
    END IF;
    IF v_adj.new_actual IS NULL OR v_adj.new_actual < 0 THEN
      CONTINUE;
    END IF;

    -- Sum all existing consume + adjust movements for this item linked to the produce
    SELECT COALESCE(SUM(-quantity), 0) INTO v_current_consumed
    FROM stock_movements
    WHERE reference_type = 'stock_movement'
      AND reference_id = p_produce_movement_id
      AND item_id = v_adj.item_id
      AND item_type = v_adj.item_type
      AND movement_type IN ('assembly_consume','assembly_adjust');

    v_delta := v_adj.new_actual - v_current_consumed;
    IF v_delta = 0 THEN
      CONTINUE;
    END IF;

    -- Pre-check availability if consuming more
    IF v_delta > 0 THEN
      IF v_adj.item_type = 'raw_material' THEN
        SELECT name INTO v_item_name FROM raw_materials WHERE id = v_adj.item_id;
        PERFORM 1 FROM raw_materials
          WHERE id = v_adj.item_id
            AND (stock_quantity - reserved_quantity) >= v_delta;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Insufficient stock for % to increase consumption by %', v_item_name, v_delta;
        END IF;
      ELSE
        SELECT name INTO v_item_name FROM components WHERE id = v_adj.item_id;
        PERFORM 1 FROM components
          WHERE id = v_adj.item_id
            AND (stock_quantity - reserved_quantity) >= v_delta;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Insufficient stock for % to increase consumption by %', v_item_name, v_delta;
        END IF;
      END IF;
    END IF;

    INSERT INTO stock_movements (
      item_id, item_type, movement_type, quantity, performed_by, notes,
      reference_type, reference_id, autocount_synced
    ) VALUES (
      v_adj.item_id, v_adj.item_type, 'assembly_adjust', -v_delta, v_user,
      COALESCE(p_notes, 'Production consumption adjustment') ||
        ' (prev actual: ' || v_current_consumed || ' → new actual: ' || v_adj.new_actual || ')',
      'stock_movement', p_produce_movement_id,
      CASE WHEN v_adj.item_type = 'raw_material' THEN true ELSE false END
    ) RETURNING id INTO v_adj_movement_id;

    IF v_adj.item_type = 'raw_material' THEN
      UPDATE raw_materials SET stock_quantity = stock_quantity - v_delta, updated_at = now()
        WHERE id = v_adj.item_id;
    ELSE
      UPDATE components SET stock_quantity = stock_quantity - v_delta, updated_at = now()
        WHERE id = v_adj.item_id;
    END IF;

    v_adjustments_made := v_adjustments_made || jsonb_build_object(
      'item_id', v_adj.item_id, 'item_type', v_adj.item_type,
      'delta', v_delta, 'new_actual', v_adj.new_actual,
      'adjustment_movement_id', v_adj_movement_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'adjustments', v_adjustments_made
  );
END;
$function$;
