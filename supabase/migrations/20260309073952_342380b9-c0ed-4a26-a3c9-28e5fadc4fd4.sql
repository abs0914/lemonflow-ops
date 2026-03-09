ALTER TABLE public.purchase_orders
DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

ALTER TABLE public.purchase_orders
ADD CONSTRAINT purchase_orders_status_check
CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'verified'::text, 'cancelled'::text]));