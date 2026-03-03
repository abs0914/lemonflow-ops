-- Drop the redundant policy that lacks WITH CHECK and blocks status changes
DROP POLICY IF EXISTS "Finance can update pending_payment orders" ON public.sales_orders;