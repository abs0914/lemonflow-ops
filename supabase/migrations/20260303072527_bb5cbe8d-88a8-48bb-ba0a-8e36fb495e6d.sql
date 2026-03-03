
CREATE POLICY "Fulfillment can create stores"
ON public.stores
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'Fulfillment'
  )
);
