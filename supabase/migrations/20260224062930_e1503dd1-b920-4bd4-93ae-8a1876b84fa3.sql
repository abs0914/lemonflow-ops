
CREATE POLICY "Fulfillment can create orders"
ON public.sales_orders FOR INSERT
WITH CHECK (
  is_fulfillment(auth.uid()) AND created_by = auth.uid()
);
