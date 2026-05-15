CREATE OR REPLACE FUNCTION public.reserve_stock_for_sales_order(p_sales_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_line RECORD;
  v_required_qty NUMERIC;
  v_available_qty NUMERIC;
  v_insufficient_items JSONB := '[]'::JSONB;
  v_unmatched_items JSONB := '[]'::JSONB;
BEGIN
  FOR v_line IN
    SELECT sol.id, sol.item_code, sol.item_name, sol.quantity,
           c.id as component_id, c.stock_quantity, c.reserved_quantity
    FROM sales_order_lines sol
    LEFT JOIN components c ON c.autocount_item_code = sol.item_code OR c.sku = sol.item_code
    WHERE sol.sales_order_id = p_sales_order_id
  LOOP
    IF v_line.component_id IS NULL THEN
      v_unmatched_items := v_unmatched_items ||
        jsonb_build_object('item_code', v_line.item_code, 'item_name', v_line.item_name);
      CONTINUE;
    END IF;

    v_required_qty := v_line.quantity;
    v_available_qty := COALESCE(v_line.stock_quantity, 0) - COALESCE(v_line.reserved_quantity, 0);

    IF v_available_qty <= 0 OR v_available_qty < v_required_qty THEN
      v_insufficient_items := v_insufficient_items ||
        jsonb_build_object(
          'item_code', v_line.item_code,
          'item_name', v_line.item_name,
          'required', v_required_qty,
          'available', v_available_qty,
          'shortage', v_required_qty - v_available_qty
        );
    END IF;
  END LOOP;

  IF jsonb_array_length(v_unmatched_items) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'One or more items are not in inventory',
      'unmatched_items', v_unmatched_items
    );
  END IF;

  IF jsonb_array_length(v_insufficient_items) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Insufficient stock for some items',
      'insufficient_items', v_insufficient_items
    );
  END IF;

  FOR v_line IN
    SELECT sol.item_code, sol.quantity, c.id as component_id
    FROM sales_order_lines sol
    LEFT JOIN components c ON c.autocount_item_code = sol.item_code OR c.sku = sol.item_code
    WHERE sol.sales_order_id = p_sales_order_id
  LOOP
    IF v_line.component_id IS NOT NULL THEN
      UPDATE components
      SET reserved_quantity = reserved_quantity + v_line.quantity
      WHERE id = v_line.component_id;
    END IF;
  END LOOP;

  UPDATE sales_orders SET stock_reserved = true WHERE id = p_sales_order_id;

  RETURN jsonb_build_object('success', true, 'message', 'Stock reserved successfully');
END;
$function$;