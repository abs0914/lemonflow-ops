
-- Update Finance RLS policy to allow transitioning to 'cancelled' status (for reject payment)
DROP POLICY IF EXISTS "Finance can confirm payment" ON public.sales_orders;

CREATE POLICY "Finance can confirm payment"
ON public.sales_orders
FOR UPDATE
TO authenticated
USING (is_finance(auth.uid()) AND status IN ('pending_payment', 'awaiting_proof'))
WITH CHECK (is_finance(auth.uid()) AND status IN ('pending_payment', 'awaiting_proof', 'pending_accounting', 'cancelled'));
