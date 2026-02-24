
-- Create notifications table
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  entity_type text,
  entity_id text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

-- System can insert notifications (via triggers using security definer)
CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, is_read) WHERE is_read = false;

-- Function to create role-specific notifications
CREATE OR REPLACE FUNCTION public.notify_roles(
  p_roles text[],
  p_title text,
  p_message text,
  p_type text DEFAULT 'info',
  p_entity_type text DEFAULT NULL,
  p_entity_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, entity_type, entity_id)
  SELECT up.id, p_title, p_message, p_type, p_entity_type, p_entity_id
  FROM public.user_profiles up
  WHERE up.role = ANY(p_roles);
END;
$$;

-- Trigger: New sales order submitted
CREATE OR REPLACE FUNCTION public.on_sales_order_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_name text;
  v_user_name text;
BEGIN
  -- Get store name
  SELECT store_name INTO v_store_name FROM stores WHERE id = NEW.store_id;
  -- Get user name
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

  -- Order status changes
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

  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'fulfilled') THEN
    PERFORM notify_roles(
      ARRAY['Admin', 'Finance', 'Store'],
      'Order Fulfilled',
      'Order ' || NEW.order_number || ' has been fulfilled',
      'order',
      'sales_order',
      NEW.id::text
    );
  END IF;

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

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sales_order_notifications
AFTER UPDATE ON public.sales_orders
FOR EACH ROW
EXECUTE FUNCTION public.on_sales_order_change();

-- Trigger: New assembly order created
CREATE OR REPLACE FUNCTION public.on_assembly_order_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_name text;
  v_user_name text;
BEGIN
  SELECT name INTO v_product_name FROM products WHERE id = NEW.product_id;
  SELECT full_name INTO v_user_name FROM user_profiles WHERE id = NEW.created_by;

  IF TG_OP = 'INSERT' THEN
    PERFORM notify_roles(
      ARRAY['Admin', 'Production', 'Warehouse'],
      'New Assembly Order',
      'Assembly order for ' || COALESCE(v_product_name, 'Unknown') || ' (Qty: ' || NEW.quantity || ') created by ' || COALESCE(v_user_name, 'Unknown'),
      'production',
      'assembly_order',
      NEW.id::text
    );
  END IF;

  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed') THEN
    PERFORM notify_roles(
      ARRAY['Admin', 'Warehouse'],
      'Assembly Completed',
      'Assembly order for ' || COALESCE(v_product_name, 'Unknown') || ' (Qty: ' || NEW.quantity || ') has been completed',
      'production',
      'assembly_order',
      NEW.id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assembly_order_notifications
AFTER INSERT OR UPDATE ON public.assembly_orders
FOR EACH ROW
EXECUTE FUNCTION public.on_assembly_order_change();

-- Trigger: Low stock alert on component update
CREATE OR REPLACE FUNCTION public.on_component_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available numeric;
  v_threshold numeric;
BEGIN
  v_available := NEW.stock_quantity - NEW.reserved_quantity;
  v_threshold := COALESCE(NEW.low_stock_threshold, 10);

  -- Only fire when crossing threshold downward
  IF v_available < v_threshold AND (OLD.stock_quantity - OLD.reserved_quantity) >= v_threshold THEN
    PERFORM notify_roles(
      ARRAY['Admin', 'Warehouse'],
      'Low Stock Alert',
      NEW.name || ' (' || NEW.sku || ') is below threshold. Available: ' || v_available || ', Threshold: ' || v_threshold,
      'stock',
      'component',
      NEW.id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_component_low_stock
AFTER UPDATE ON public.components
FOR EACH ROW
EXECUTE FUNCTION public.on_component_low_stock();

-- Trigger: Low stock alert on raw material update
CREATE OR REPLACE FUNCTION public.on_raw_material_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available numeric;
  v_threshold numeric;
BEGIN
  v_available := NEW.stock_quantity - NEW.reserved_quantity;
  v_threshold := COALESCE(NEW.low_stock_threshold, 10);

  IF v_available < v_threshold AND (OLD.stock_quantity - OLD.reserved_quantity) >= v_threshold THEN
    PERFORM notify_roles(
      ARRAY['Admin', 'Warehouse'],
      'Low Stock Alert',
      NEW.name || ' (' || NEW.sku || ') is below threshold. Available: ' || v_available || ', Threshold: ' || v_threshold,
      'stock',
      'raw_material',
      NEW.id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_raw_material_low_stock
AFTER UPDATE ON public.raw_materials
FOR EACH ROW
EXECUTE FUNCTION public.on_raw_material_low_stock();
