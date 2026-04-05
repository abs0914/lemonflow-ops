-- 1. Create store-specific notification function
CREATE OR REPLACE FUNCTION public.notify_store_users(
  p_store_id uuid,
  p_title text,
  p_message text,
  p_type text DEFAULT 'info',
  p_entity_type text DEFAULT NULL,
  p_entity_id text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, title, message, type, entity_type, entity_id)
  SELECT usa.user_id, p_title, p_message, p_type, p_entity_type, p_entity_id
  FROM user_store_assignments usa
  WHERE usa.store_id = p_store_id;
END;
$$;

-- 2. Replace on_sales_order_change with store-filtered notifications
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
  SELECT store_name INTO v_store_name FROM stores WHERE id = NEW.store_id;
  SELECT full_name INTO v_user_name FROM user_profiles WHERE id = NEW.created_by;

  -- New order submitted
  IF (TG_OP = 'UPDATE' AND OLD.status = 'draft' AND NEW.status = 'submitted') THEN
    PERFORM notify_roles(
      ARRAY['Admin', 'Fulfillment', 'Warehouse'],
      'New Order Submitted',
      'Order ' || NEW.order_number || ' from ' || COALESCE(v_store_name, 'Unknown Store') || ' submitted by ' || COALESCE(v_user_name, 'Unknown'),
      'order', 'sales_order', NEW.id::text
    );
  END IF;

  -- Order pending payment (Finance + store users)
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'pending_payment') THEN
    PERFORM notify_roles(
      ARRAY['Finance'],
      'Payment Pending',
      'Order ' || NEW.order_number || ' is awaiting payment confirmation',
      'payment', 'sales_order', NEW.id::text
    );
    IF NEW.store_id IS NOT NULL THEN
      PERFORM notify_store_users(
        NEW.store_id,
        'Order Under Review',
        'Order ' || NEW.order_number || ' — Finance is reviewing your order',
        'order', 'sales_order', NEW.id::text
      );
    END IF;
  END IF;

  -- Order awaiting proof of payment (store users only)
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'awaiting_proof') THEN
    IF NEW.store_id IS NOT NULL THEN
      PERFORM notify_store_users(
        NEW.store_id,
        'Upload Proof of Payment',
        'Order ' || NEW.order_number || ' requires proof of payment upload',
        'payment', 'sales_order', NEW.id::text
      );
    END IF;
  END IF;

  -- Order pending accounting (Accounting + store users)
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'pending_accounting') THEN
    PERFORM notify_roles(
      ARRAY['Accounting'],
      'Accounting Review Required',
      'Order ' || NEW.order_number || ' payment confirmed, awaiting accounting review',
      'payment', 'sales_order', NEW.id::text
    );
    IF NEW.store_id IS NOT NULL THEN
      PERFORM notify_store_users(
        NEW.store_id,
        'Payment Received',
        'Order ' || NEW.order_number || ' — Awaiting final verification',
        'payment', 'sales_order', NEW.id::text
      );
    END IF;
  END IF;

  -- Order processing (operational roles + store users)
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'processing') THEN
    PERFORM notify_roles(
      ARRAY['Admin', 'Fulfillment', 'Warehouse', 'Production'],
      'Order Processing',
      'Order ' || NEW.order_number || ' is now being processed',
      'order', 'sales_order', NEW.id::text
    );
    IF NEW.store_id IS NOT NULL THEN
      PERFORM notify_store_users(
        NEW.store_id,
        'Order Approved',
        'Order ' || NEW.order_number || ' — Your order is now being processed',
        'order', 'sales_order', NEW.id::text
      );
    END IF;
  END IF;

  -- Order fulfilled (operational roles + store users)
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'fulfilled') THEN
    PERFORM notify_roles(
      ARRAY['Admin', 'Finance', 'Accounting'],
      'Order Fulfilled',
      'Order ' || NEW.order_number || ' has been fulfilled',
      'order', 'sales_order', NEW.id::text
    );
    IF NEW.store_id IS NOT NULL THEN
      PERFORM notify_store_users(
        NEW.store_id,
        'Order Fulfilled',
        'Order ' || NEW.order_number || ' has been fulfilled and is ready',
        'order', 'sales_order', NEW.id::text
      );
    END IF;
  END IF;

  -- Order cancelled (store users)
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled') THEN
    IF NEW.store_id IS NOT NULL THEN
      PERFORM notify_store_users(
        NEW.store_id,
        'Order Cancelled',
        'Order ' || NEW.order_number || ' has been cancelled',
        'order', 'sales_order', NEW.id::text
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;