
-- Add proof_of_payment_url column to sales_orders
ALTER TABLE public.sales_orders ADD COLUMN proof_of_payment_url TEXT DEFAULT NULL;

-- Create payment-proofs storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false);

-- Store users can upload payment proofs for their orders
CREATE POLICY "Store users can upload payment proofs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND EXISTS (
    SELECT 1 FROM user_store_assignments usa
    JOIN sales_orders so ON so.store_id = usa.store_id
    WHERE usa.user_id = auth.uid()
      AND so.id::text = (storage.foldername(name))[1]
      AND so.status = 'awaiting_proof'
  )
);

-- Store users can view their own uploaded proofs
CREATE POLICY "Store users can view own payment proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-proofs'
  AND EXISTS (
    SELECT 1 FROM user_store_assignments usa
    JOIN sales_orders so ON so.store_id = usa.store_id
    WHERE usa.user_id = auth.uid()
      AND so.id::text = (storage.foldername(name))[1]
  )
);

-- Finance, Accounting, Admin can view all payment proofs
CREATE POLICY "Staff can view payment proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-proofs'
  AND (
    is_admin(auth.uid()) OR is_finance(auth.uid()) OR is_accounting(auth.uid()) OR is_fulfillment(auth.uid())
  )
);

-- RLS: Store users can update orders in awaiting_proof status (to upload proof)
CREATE POLICY "Store users can upload proof for awaiting_proof orders"
ON public.sales_orders FOR UPDATE
USING (
  status = 'awaiting_proof'
  AND EXISTS (
    SELECT 1 FROM user_store_assignments
    WHERE user_store_assignments.user_id = auth.uid()
      AND user_store_assignments.store_id = sales_orders.store_id
  )
)
WITH CHECK (
  status IN ('awaiting_proof', 'pending_accounting')
  AND EXISTS (
    SELECT 1 FROM user_store_assignments
    WHERE user_store_assignments.user_id = auth.uid()
      AND user_store_assignments.store_id = sales_orders.store_id
  )
);

-- Update Finance WITH CHECK to allow transitioning to awaiting_proof
DROP POLICY IF EXISTS "Finance can confirm payment" ON public.sales_orders;
CREATE POLICY "Finance can confirm payment"
ON public.sales_orders FOR UPDATE
USING (
  status = 'pending_payment' AND is_finance(auth.uid())
)
WITH CHECK (
  status IN ('processing', 'pending_payment', 'pending_accounting', 'awaiting_proof') AND is_finance(auth.uid())
);

-- Update notification trigger to handle awaiting_proof status
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

  -- Order awaiting proof of payment (Store/Franchisee)
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'awaiting_proof') THEN
    PERFORM notify_roles(
      ARRAY['Store'],
      'Upload Proof of Payment',
      'Order ' || NEW.order_number || ' requires proof of payment upload',
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
