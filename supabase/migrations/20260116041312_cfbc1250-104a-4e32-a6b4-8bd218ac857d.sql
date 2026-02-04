-- Add policy for Warehouse users to manage components (for stock adjustments)
CREATE POLICY "Warehouse can manage components"
ON public.components
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