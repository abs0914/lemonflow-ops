ALTER TABLE public.stock_movements
DROP CONSTRAINT IF EXISTS valid_movement_type;

ALTER TABLE public.stock_movements
ADD CONSTRAINT valid_movement_type CHECK (
  movement_type = ANY (ARRAY[
    'receipt'::text,
    'issue'::text,
    'adjustment'::text,
    'assembly_consume'::text,
    'assembly_produce'::text,
    'assembly_adjust'::text,
    'shrinkage'::text,
    'sales_fulfillment'::text
  ])
);

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
BEGIN
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

  FOR v_line IN
    SELECT sol.item_code, sol.item_name, sol.quantity,
           c.id as component_id
    FROM sales_order_lines sol
    LEFT JOIN components c ON c.autocount_item_code = sol.item_code OR c.sku = sol.item_code
    WHERE sol.sales_order_id = p_sales_order_id
  LOOP
    IF v_line.component_id IS NOT NULL THEN
      UPDATE components
      SET stock_quantity = stock_quantity - v_line.quantity,
          reserved_quantity = GREATEST(0, reserved_quantity - v_line.quantity),
          updated_at = now()
      WHERE id = v_line.component_id;

      INSERT INTO stock_movements (
        item_id, item_type, movement_type, quantity, performed_by, notes,
        reference_type, reference_id, autocount_synced
      ) VALUES (
        v_line.component_id, 'component', 'sales_fulfillment', -v_line.quantity, v_user,
        'Sales order fulfillment: ' || v_line.item_code || ' x ' || v_line.quantity,
        'sales_order', p_sales_order_id, false
      );
    END IF;
  END LOOP;

  UPDATE sales_orders
  SET stock_reserved = false
  WHERE id = p_sales_order_id;
END;
$function$;

SELECT public.complete_sales_order_stock('34a9287a-35b4-40a1-9c8f-fa85f3e54817'::uuid);