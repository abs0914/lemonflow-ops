CREATE OR REPLACE FUNCTION public.complete_sales_order_stock(p_sales_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_line RECORD;
  v_user uuid := auth.uid();
  v_already_done boolean;
  v_order_stock_reserved boolean;
  v_unmatched_items jsonb := '[]'::jsonb;
  v_insufficient_items jsonb := '[]'::jsonb;
BEGIN
  SELECT stock_reserved
  INTO v_order_stock_reserved
  FROM sales_orders
  WHERE id = p_sales_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SALES_ORDER_NOT_FOUND: %', p_sales_order_id;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM stock_movements
    WHERE reference_type = 'sales_order'
      AND reference_id = p_sales_order_id
      AND movement_type = 'sales_fulfillment'
  ) INTO v_already_done;

  IF v_already_done THEN
    UPDATE sales_orders SET stock_reserved = false WHERE id = p_sales_order_id;
    RETURN;
  END IF;

  IF v_user IS NULL THEN
    SELECT COALESCE(fulfilled_by, created_by) INTO v_user
    FROM sales_orders WHERE id = p_sales_order_id;
  END IF;

  -- Lock matching component rows (no DISTINCT — incompatible with FOR UPDATE).
  FOR v_line IN
    SELECT c.id
    FROM components c
    WHERE c.id IN (
      SELECT c2.id
      FROM sales_order_lines sol
      JOIN components c2 ON c2.autocount_item_code = sol.item_code OR c2.sku = sol.item_code
      WHERE sol.sales_order_id = p_sales_order_id
    )
    ORDER BY c.id
    FOR UPDATE
  LOOP
    NULL;
  END LOOP;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'item_code', unmatched.item_code,
    'item_name', unmatched.item_name,
    'required', unmatched.quantity
  )), '[]'::jsonb)
  INTO v_unmatched_items
  FROM (
    SELECT sol.item_code, sol.item_name, SUM(sol.quantity) AS quantity
    FROM sales_order_lines sol
    LEFT JOIN components c ON c.autocount_item_code = sol.item_code OR c.sku = sol.item_code
    WHERE sol.sales_order_id = p_sales_order_id
      AND c.id IS NULL
    GROUP BY sol.item_code, sol.item_name
  ) unmatched;

  IF jsonb_array_length(v_unmatched_items) > 0 THEN
    RAISE EXCEPTION 'UNMATCHED_INVENTORY_ITEMS: %', v_unmatched_items::text;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'item_code', checked.item_code,
    'item_name', checked.item_name,
    'required', checked.required_quantity,
    'stock_quantity', checked.stock_quantity,
    'reserved_quantity', checked.reserved_quantity,
    'available', checked.available_quantity,
    'shortage', checked.required_quantity - checked.available_quantity
  )), '[]'::jsonb)
  INTO v_insufficient_items
  FROM (
    SELECT
      MIN(sol.item_code) AS item_code,
      MIN(sol.item_name) AS item_name,
      c.id AS component_id,
      SUM(sol.quantity) AS required_quantity,
      c.stock_quantity,
      c.reserved_quantity,
      CASE
        WHEN v_order_stock_reserved THEN c.stock_quantity
        ELSE c.stock_quantity - c.reserved_quantity
      END AS available_quantity
    FROM sales_order_lines sol
    JOIN components c ON c.autocount_item_code = sol.item_code OR c.sku = sol.item_code
    WHERE sol.sales_order_id = p_sales_order_id
    GROUP BY c.id, c.stock_quantity, c.reserved_quantity
  ) checked
  WHERE checked.available_quantity < checked.required_quantity;

  IF jsonb_array_length(v_insufficient_items) > 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK: %', v_insufficient_items::text;
  END IF;

  FOR v_line IN
    SELECT component_id, SUM(quantity) AS quantity
    FROM (
      SELECT c.id AS component_id, sol.quantity
      FROM sales_order_lines sol
      JOIN components c ON c.autocount_item_code = sol.item_code OR c.sku = sol.item_code
      WHERE sol.sales_order_id = p_sales_order_id
    ) matched_lines
    GROUP BY component_id
  LOOP
    IF v_order_stock_reserved THEN
      UPDATE components
      SET stock_quantity = stock_quantity - v_line.quantity,
          reserved_quantity = GREATEST(0, reserved_quantity - v_line.quantity),
          updated_at = now()
      WHERE id = v_line.component_id;
    ELSE
      UPDATE components
      SET stock_quantity = stock_quantity - v_line.quantity,
          updated_at = now()
      WHERE id = v_line.component_id;
    END IF;
  END LOOP;

  FOR v_line IN
    SELECT sol.item_code, sol.item_name, sol.quantity,
           c.id as component_id
    FROM sales_order_lines sol
    JOIN components c ON c.autocount_item_code = sol.item_code OR c.sku = sol.item_code
    WHERE sol.sales_order_id = p_sales_order_id
  LOOP
    INSERT INTO stock_movements (
      item_id, item_type, movement_type, quantity, performed_by, notes,
      reference_type, reference_id, autocount_synced
    ) VALUES (
      v_line.component_id, 'component', 'sales_fulfillment', -v_line.quantity, v_user,
      'Sales order fulfillment: ' || v_line.item_code || ' x ' || v_line.quantity,
      'sales_order', p_sales_order_id, false
    );
  END LOOP;

  UPDATE sales_orders
  SET stock_reserved = false
  WHERE id = p_sales_order_id;
END;
$function$;