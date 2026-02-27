
-- Update purchase_orders SELECT policy to include Accounting
DROP POLICY "Admins, Warehouse, CEO, and Finance can view purchase orders" ON public.purchase_orders;
CREATE POLICY "Admins, Warehouse, CEO, Finance, and Accounting can view purchase orders"
ON public.purchase_orders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = ANY (ARRAY['Admin', 'Warehouse', 'CEO', 'Finance', 'Accounting'])
  )
);

-- Add Accounting SELECT policy for purchase_order_lines
CREATE POLICY "Accounting can view PO lines"
ON public.purchase_order_lines FOR SELECT
USING (is_accounting(auth.uid()));
