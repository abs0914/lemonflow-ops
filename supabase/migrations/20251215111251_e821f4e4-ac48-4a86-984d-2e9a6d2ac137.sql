-- Add payment tracking columns to sales_orders
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS payment_amount NUMERIC DEFAULT 0;
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS payment_confirmed_by UUID;
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS stock_reserved BOOLEAN DEFAULT false;

-- Create is_finance helper function
CREATE OR REPLACE FUNCTION public.is_finance(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = user_id
      AND role = 'Finance'
  )
$$;

-- Function to reserve stock for a sales order (franchisee only)
CREATE OR REPLACE FUNCTION public.reserve_stock_for_sales_order(p_sales_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_line RECORD;
  v_required_qty NUMERIC;
  v_available_qty NUMERIC;
  v_insufficient_items JSONB := '[]'::JSONB;
BEGIN
  -- Check each line item for availability
  FOR v_line IN
    SELECT sol.id, sol.item_code, sol.item_name, sol.quantity,
           c.id as component_id, c.stock_quantity, c.reserved_quantity
    FROM sales_order_lines sol
    LEFT JOIN components c ON c.autocount_item_code = sol.item_code OR c.sku = sol.item_code
    WHERE sol.sales_order_id = p_sales_order_id
  LOOP
    IF v_line.component_id IS NOT NULL THEN
      v_required_qty := v_line.quantity;
      v_available_qty := v_line.stock_quantity - v_line.reserved_quantity;
      
      IF v_available_qty < v_required_qty THEN
        v_insufficient_items := v_insufficient_items || 
          jsonb_build_object(
            'item_code', v_line.item_code,
            'item_name', v_line.item_name,
            'required', v_required_qty,
            'available', v_available_qty,
            'shortage', v_required_qty - v_available_qty
          );
      END IF;
    END IF;
  END LOOP;

  -- If any items have insufficient stock, return error
  IF jsonb_array_length(v_insufficient_items) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Insufficient stock for some items',
      'insufficient_items', v_insufficient_items
    );
  END IF;

  -- Reserve stock for each line item
  FOR v_line IN
    SELECT sol.item_code, sol.quantity,
           c.id as component_id
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

  -- Mark order as stock reserved
  UPDATE sales_orders
  SET stock_reserved = true
  WHERE id = p_sales_order_id;

  RETURN jsonb_build_object('success', true, 'message', 'Stock reserved successfully');
END;
$$;

-- Function to release reserved stock (on cancellation)
CREATE OR REPLACE FUNCTION public.release_sales_order_stock(p_sales_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_line RECORD;
  v_is_reserved BOOLEAN;
BEGIN
  -- Check if stock was reserved
  SELECT stock_reserved INTO v_is_reserved
  FROM sales_orders
  WHERE id = p_sales_order_id;

  IF NOT v_is_reserved THEN
    RETURN;
  END IF;

  -- Release reserved stock for each line item
  FOR v_line IN
    SELECT sol.item_code, sol.quantity,
           c.id as component_id
    FROM sales_order_lines sol
    LEFT JOIN components c ON c.autocount_item_code = sol.item_code OR c.sku = sol.item_code
    WHERE sol.sales_order_id = p_sales_order_id
  LOOP
    IF v_line.component_id IS NOT NULL THEN
      UPDATE components
      SET reserved_quantity = GREATEST(0, reserved_quantity - v_line.quantity)
      WHERE id = v_line.component_id;
    END IF;
  END LOOP;

  -- Mark order as stock not reserved
  UPDATE sales_orders
  SET stock_reserved = false
  WHERE id = p_sales_order_id;
END;
$$;

-- Function to complete stock (deduct actual stock, release reservation)
CREATE OR REPLACE FUNCTION public.complete_sales_order_stock(p_sales_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_line RECORD;
BEGIN
  -- Deduct stock and release reservation for each line item
  FOR v_line IN
    SELECT sol.item_code, sol.quantity,
           c.id as component_id
    FROM sales_order_lines sol
    LEFT JOIN components c ON c.autocount_item_code = sol.item_code OR c.sku = sol.item_code
    WHERE sol.sales_order_id = p_sales_order_id
  LOOP
    IF v_line.component_id IS NOT NULL THEN
      UPDATE components
      SET stock_quantity = GREATEST(0, stock_quantity - v_line.quantity),
          reserved_quantity = GREATEST(0, reserved_quantity - v_line.quantity)
      WHERE id = v_line.component_id;
    END IF;
  END LOOP;

  -- Mark order as stock not reserved (since it's been deducted)
  UPDATE sales_orders
  SET stock_reserved = false
  WHERE id = p_sales_order_id;
END;
$$;

-- RLS Policies for Finance role
CREATE POLICY "Finance can view all orders"
ON public.sales_orders FOR SELECT
USING (is_finance(auth.uid()));

CREATE POLICY "Finance can update pending_payment orders"
ON public.sales_orders FOR UPDATE
USING (is_finance(auth.uid()) AND status = 'pending_payment');

CREATE POLICY "Finance can view all order lines"
ON public.sales_order_lines FOR SELECT
USING (is_finance(auth.uid()));