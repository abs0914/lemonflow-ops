ALTER TABLE public.sales_orders DROP CONSTRAINT sales_orders_status_check;

ALTER TABLE public.sales_orders ADD CONSTRAINT sales_orders_status_check 
CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'pending_payment'::text, 'awaiting_proof'::text, 'pending_accounting'::text, 'processing'::text, 'fulfilled'::text, 'completed'::text, 'cancelled'::text, 'issues'::text]));