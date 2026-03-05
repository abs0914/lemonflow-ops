DROP POLICY "Accounting can update pending_accounting orders" ON public.sales_orders;

CREATE POLICY "Accounting can update pending_accounting orders"
ON public.sales_orders
FOR UPDATE
TO authenticated
USING (is_accounting(auth.uid()) AND status = 'pending_accounting')
WITH CHECK (is_accounting(auth.uid()) AND status IN ('pending_accounting', 'processing'));