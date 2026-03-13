CREATE POLICY "CEO can update submitted and approved POs"
ON public.purchase_orders
FOR UPDATE
TO authenticated
USING (is_ceo(auth.uid()) AND status IN ('submitted', 'approved'))
WITH CHECK (is_ceo(auth.uid()) AND status IN ('submitted', 'approved', 'cancelled'));