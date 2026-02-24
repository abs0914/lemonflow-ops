-- Update check constraint to include pending_accounting and fulfilled statuses
ALTER TABLE public.sales_orders DROP CONSTRAINT IF EXISTS sales_orders_status_check;

ALTER TABLE public.sales_orders ADD CONSTRAINT sales_orders_status_check 
CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'pending_payment'::text, 'pending_accounting'::text, 'processing'::text, 'fulfilled'::text, 'completed'::text, 'cancelled'::text]));

-- Now fix the order data
UPDATE public.sales_orders 
SET status = 'pending_accounting', 
    delivery_fee = 500, 
    shipping_fee = 20 
WHERE order_number = 'SO-20260224-0005';