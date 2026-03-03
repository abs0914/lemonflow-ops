
-- Drop the existing insert policy for stock_movements
DROP POLICY IF EXISTS "Admins and Production can create stock movements" ON public.stock_movements;

-- Recreate with Accounting included
CREATE POLICY "Admins Production Warehouse Accounting can create stock movements"
ON public.stock_movements
FOR INSERT
TO authenticated
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = ANY (ARRAY['Admin'::text, 'Production'::text, 'Warehouse'::text, 'Accounting'::text])
  ))
  AND (performed_by = auth.uid())
);
