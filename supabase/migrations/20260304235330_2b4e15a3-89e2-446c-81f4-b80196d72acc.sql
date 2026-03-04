
-- Drop and recreate stock_movements INSERT policy to include Fulfillment
DROP POLICY IF EXISTS "Admins Production Warehouse Accounting can create stock movemen" ON public.stock_movements;

CREATE POLICY "Admins Production Warehouse Accounting Fulfillment can create stock movements"
ON public.stock_movements
FOR INSERT
TO authenticated
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = ANY (ARRAY['Admin'::text, 'Production'::text, 'Warehouse'::text, 'Accounting'::text, 'Fulfillment'::text])
  ))
  AND (performed_by = auth.uid())
);

-- Also allow Fulfillment to manage components (for stock adjustments)
DROP POLICY IF EXISTS "Fulfillment can update components" ON public.components;

CREATE POLICY "Fulfillment can update components"
ON public.components
FOR UPDATE
TO authenticated
USING (is_fulfillment(auth.uid()));
