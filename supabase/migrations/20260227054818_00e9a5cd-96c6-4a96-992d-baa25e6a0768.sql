
-- Add RLS policies for Warehouse and Production to manage suppliers
CREATE POLICY "Warehouse can manage suppliers"
ON public.suppliers
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'Warehouse'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'Warehouse'
  )
);

CREATE POLICY "Production can manage suppliers"
ON public.suppliers
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'Production'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'Production'
  )
);
