
-- Allow Finance users to view all stores
CREATE POLICY "Finance can view stores"
ON public.stores
FOR SELECT
TO authenticated
USING (is_finance(auth.uid()));
