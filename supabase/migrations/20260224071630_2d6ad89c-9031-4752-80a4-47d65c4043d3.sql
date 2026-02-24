-- Add is_accounting helper function
CREATE OR REPLACE FUNCTION public.is_accounting(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = user_id
      AND role = 'Accounting'
  )
$$;

-- Add RLS policies for Accounting role on sales_orders (same as Finance + pending_accounting)
CREATE POLICY "Accounting can view all orders"
ON public.sales_orders
FOR SELECT
USING (is_accounting(auth.uid()));

CREATE POLICY "Accounting can update pending_accounting orders"
ON public.sales_orders
FOR UPDATE
USING (is_accounting(auth.uid()) AND status = 'pending_accounting');

-- Add RLS policy for Accounting to view sales_order_lines
CREATE POLICY "Accounting can view all order lines"
ON public.sales_order_lines
FOR SELECT
USING (is_accounting(auth.uid()));

-- Update notification trigger to include Accounting in payment flow
CREATE OR REPLACE FUNCTION public.on_sales_order_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_store_name text;
  v_user_name text;
BEGIN
  SELECT store_name INTO v_store_name FROM stores WHERE id = NEW.store_id;
  SELECT full_name INTO v_user_name FROM user_profiles WHERE id = NEW.created_by;

  -- New order submitted
  IF (TG_OP = 'UPDATE' AND OLD.status = 'draft' AND NEW.status = 'submitted') THEN
    PERFORM notify_roles(
      ARRAY['Admin', 'Fulfillment', 'Warehouse'],
      'New Order Submitted',
      'Order ' || NEW.order_number || ' from ' || COALESCE(v_store_name, 'Unknown Store') || ' submitted by ' || COALESCE(v_user_name, 'Unknown'),
      'order',
      'sales_order',
      NEW.id::text
    );
  END IF;

  -- Order pending payment (Finance)
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'pending_payment') THEN
    PERFORM notify_roles(
      ARRAY['Finance'],
      'Payment Pending',
      'Order ' || NEW.order_number || ' is awaiting payment confirmation',
      'payment',
      'sales_order',
      NEW.id::text
    );
  END IF;

  -- Order pending accounting review
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'pending_accounting') THEN
    PERFORM notify_roles(
      ARRAY['Accounting'],
      'Accounting Review Required',
      'Order ' || NEW.order_number || ' payment confirmed, awaiting accounting review',
      'payment',
      'sales_order',
      NEW.id::text
    );
  END IF;

  -- Order processing
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'processing') THEN
    PERFORM notify_roles(
      ARRAY['Admin', 'Fulfillment', 'Warehouse', 'Production'],
      'Order Processing',
      'Order ' || NEW.order_number || ' is now being processed',
      'order',
      'sales_order',
      NEW.id::text
    );
  END IF;

  -- Order fulfilled
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'fulfilled') THEN
    PERFORM notify_roles(
      ARRAY['Admin', 'Finance', 'Accounting', 'Store'],
      'Order Fulfilled',
      'Order ' || NEW.order_number || ' has been fulfilled',
      'order',
      'sales_order',
      NEW.id::text
    );
  END IF;

  RETURN NEW;
END;
$function$;