
-- Drop existing delete policy
DROP POLICY IF EXISTS "Admins and CEO can delete draft/submitted purchase orders" ON public.purchase_orders;

-- Recreate with Warehouse and Production included
CREATE POLICY "Admins CEO Warehouse Production can delete draft/submitted POs"
ON public.purchase_orders
FOR DELETE
TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = ANY (ARRAY['Admin', 'Warehouse', 'Production'])
  ) AND status = ANY (ARRAY['draft', 'submitted']))
  OR
  (is_ceo(auth.uid()) AND status = ANY (ARRAY['draft', 'submitted']))
);

-- Also allow Warehouse and Production to delete PO lines
DROP POLICY IF EXISTS "Admins and Warehouse can manage PO lines" ON public.purchase_order_lines;

CREATE POLICY "Admins Warehouse Production can manage PO lines"
ON public.purchase_order_lines
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = ANY (ARRAY['Admin', 'Warehouse', 'Production'])
  )
);
