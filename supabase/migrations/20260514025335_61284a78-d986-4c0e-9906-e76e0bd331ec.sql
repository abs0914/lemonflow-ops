DROP POLICY IF EXISTS "Store users can update own draft orders" ON public.sales_orders;

CREATE POLICY "Store users can update own draft orders"
ON public.sales_orders
FOR UPDATE
USING (
  created_by = auth.uid()
  AND status = 'draft'
)
WITH CHECK (
  created_by = auth.uid()
  AND status IN ('draft', 'submitted', 'pending_payment')
);