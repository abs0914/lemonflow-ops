-- Drop the existing delete policy
DROP POLICY IF EXISTS "Admins can delete purchase orders" ON purchase_orders;

-- Create new delete policy that allows Admins and CEO to delete draft/submitted POs
CREATE POLICY "Admins and CEO can delete draft/submitted purchase orders"
ON purchase_orders
FOR DELETE
USING (
  (
    -- Admins can delete any PO
    is_admin(auth.uid())
    OR
    -- CEO can delete draft or submitted POs
    (is_ceo(auth.uid()) AND status IN ('draft', 'submitted'))
  )
);