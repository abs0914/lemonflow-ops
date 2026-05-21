-- Allow Finance to create sales orders
CREATE POLICY "Finance can create orders"
ON public.sales_orders
FOR INSERT
TO authenticated
WITH CHECK (is_finance(auth.uid()) AND (created_by = auth.uid()));

-- Allow Finance to manage lines on orders they're creating/editing in draft/submitted
CREATE POLICY "Finance can manage order lines"
ON public.sales_order_lines
FOR ALL
TO authenticated
USING (
  is_finance(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.sales_orders so
    WHERE so.id = sales_order_lines.sales_order_id
      AND so.status = ANY (ARRAY['draft','submitted','pending_payment','awaiting_proof','pending_accounting'])
  )
)
WITH CHECK (
  is_finance(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.sales_orders so
    WHERE so.id = sales_order_lines.sales_order_id
      AND so.status = ANY (ARRAY['draft','submitted','pending_payment','awaiting_proof','pending_accounting'])
  )
);

-- Allow Finance to update draft/submitted orders they create (so quick-entry submit flow works)
CREATE POLICY "Finance can update draft submitted orders"
ON public.sales_orders
FOR UPDATE
TO authenticated
USING (is_finance(auth.uid()) AND (status = ANY (ARRAY['draft','submitted'])))
WITH CHECK (is_finance(auth.uid()) AND (status = ANY (ARRAY['draft','submitted','pending_payment','awaiting_proof','pending_accounting'])));