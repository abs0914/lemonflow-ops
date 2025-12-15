-- Drop existing status check constraint and add updated one with pending_payment
ALTER TABLE public.sales_orders DROP CONSTRAINT IF EXISTS sales_orders_status_check;

ALTER TABLE public.sales_orders 
ADD CONSTRAINT sales_orders_status_check 
CHECK (status IN ('draft', 'submitted', 'pending_payment', 'processing', 'completed', 'cancelled'));