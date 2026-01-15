-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Admins, Warehouse, and CEO can view purchase orders" ON purchase_orders;

-- Create new SELECT policy including Finance
CREATE POLICY "Admins, Warehouse, CEO, and Finance can view purchase orders"
ON purchase_orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role IN ('Admin', 'Warehouse', 'CEO', 'Finance')
  )
);

-- Also add Finance to purchase_order_lines SELECT policy
DROP POLICY IF EXISTS "CEO can view PO lines" ON purchase_order_lines;

CREATE POLICY "CEO and Finance can view PO lines"
ON purchase_order_lines
FOR SELECT
USING (is_ceo(auth.uid()) OR is_finance(auth.uid()));