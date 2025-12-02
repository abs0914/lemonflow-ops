-- Update purchase_orders SELECT policy to include CEO role
DROP POLICY IF EXISTS "Admins and Warehouse can view purchase orders" ON purchase_orders;

CREATE POLICY "Admins, Warehouse, and CEO can view purchase orders" 
ON purchase_orders 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
      AND role IN ('Admin', 'Warehouse', 'CEO')
  )
);

-- Add CEO SELECT policy for purchase_order_lines
CREATE POLICY "CEO can view PO lines" 
ON purchase_order_lines 
FOR SELECT 
USING (
  is_ceo(auth.uid())
);