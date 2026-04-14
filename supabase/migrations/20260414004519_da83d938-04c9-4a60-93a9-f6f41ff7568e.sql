CREATE POLICY "Warehouse can insert raw materials"
ON public.raw_materials
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'Warehouse'
  )
);