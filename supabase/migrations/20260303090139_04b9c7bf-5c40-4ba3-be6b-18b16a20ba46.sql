-- Update store user proof upload policy to NOT allow status change to pending_accounting
DROP POLICY "Store users can upload proof for awaiting_proof orders" ON public.sales_orders;

CREATE POLICY "Store users can upload proof for awaiting_proof orders"
ON public.sales_orders
FOR UPDATE
USING (
  (status = 'awaiting_proof') AND 
  (EXISTS (
    SELECT 1 FROM user_store_assignments
    WHERE user_store_assignments.user_id = auth.uid()
    AND user_store_assignments.store_id = sales_orders.store_id
  ))
)
WITH CHECK (
  (status = 'awaiting_proof') AND 
  (EXISTS (
    SELECT 1 FROM user_store_assignments
    WHERE user_store_assignments.user_id = auth.uid()
    AND user_store_assignments.store_id = sales_orders.store_id
  ))
);

-- Update Finance policy to also allow updating awaiting_proof orders
DROP POLICY "Finance can confirm payment" ON public.sales_orders;

CREATE POLICY "Finance can confirm payment"
ON public.sales_orders
FOR UPDATE
USING (
  (status IN ('pending_payment', 'awaiting_proof')) AND is_finance(auth.uid())
)
WITH CHECK (
  (status IN ('pending_payment', 'awaiting_proof', 'pending_accounting')) AND is_finance(auth.uid())
);