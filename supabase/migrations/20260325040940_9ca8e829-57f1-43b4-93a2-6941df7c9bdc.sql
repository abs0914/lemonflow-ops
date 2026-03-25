CREATE POLICY "Admins and Production can update stock movements"
ON public.stock_movements
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('Admin', 'Production')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('Admin', 'Production')
  )
);