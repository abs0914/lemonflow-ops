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

  IF (TG_OP = 'UPDATE' AND OLD.status = 'draft' AND NEW.status = 'submitted') THEN
    PERFORM notify_roles(
      ARRAY['Admin', 'Fulfillment', 'Warehouse'],
      'New Order Submitted',
      'Order ' || NEW.order_number || ' from ' || COALESCE(v_store_name, 'Unknown Store') || ' submitted by ' || COALESCE(v_user_name, 'Unknown'),
      'order', 'sales_order', NEW.id::text
    );
  END IF;

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

  -- NEW: Notify Finance when proof is uploaded on an awaiting_proof order
  IF (TG_OP = 'UPDATE'
      AND NEW.status = 'awaiting_proof'
      AND NEW.proof_of_payment_url IS NOT NULL
      AND (OLD.proof_of_payment_url IS NULL OR OLD.proof_of_payment_url IS DISTINCT FROM NEW.proof_of_payment_url)) THEN
    PERFORM notify_roles(
      ARRAY['Finance'],
      'Proof of Payment Uploaded',
      'Order ' || NEW.order_number || ' from ' || COALESCE(v_store_name, 'Unknown Store') || ' — proof uploaded, ready for validation & delivery date',
      'payment', 'sales_order', NEW.id::text
    );
  END IF;

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
$function$;

-- Backfill notification for SO-20260615-0006 (already-uploaded proof) so Finance can act now
DO $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT id, order_number, store_id INTO v_order
  FROM sales_orders
  WHERE order_number = 'SO-20260615-0006' AND status = 'awaiting_proof' AND proof_of_payment_url IS NOT NULL;

  IF FOUND THEN
    PERFORM notify_roles(
      ARRAY['Finance'],
      'Proof of Payment Uploaded',
      'Order ' || v_order.order_number || ' — proof uploaded, ready for validation & delivery date',
      'payment', 'sales_order', v_order.id::text
    );
  END IF;
END $$;