-- Add policy for Warehouse users to manage bom_items
CREATE POLICY "Warehouse can manage bom items"
ON public.bom_items
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