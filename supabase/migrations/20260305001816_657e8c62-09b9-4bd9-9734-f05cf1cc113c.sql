
-- Allow Finance users to insert stores
CREATE POLICY "Finance can create stores"
ON public.stores
FOR INSERT
TO authenticated
WITH CHECK (is_finance(auth.uid()));

-- Allow Finance users to update stores
CREATE POLICY "Finance can update stores"
ON public.stores
FOR UPDATE
TO authenticated
USING (is_finance(auth.uid()))
WITH CHECK (is_finance(auth.uid()));

-- Allow Finance users to delete stores
CREATE POLICY "Finance can delete stores"
ON public.stores
FOR DELETE
TO authenticated
USING (is_finance(auth.uid()));
