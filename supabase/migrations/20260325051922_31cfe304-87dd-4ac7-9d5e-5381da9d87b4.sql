-- Allow Warehouse users to view all sales orders
CREATE POLICY "Warehouse can view all orders"
ON public.sales_orders
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'Warehouse'
  )
);

-- Allow Warehouse users to view all sales order lines
CREATE POLICY "Warehouse can view all order lines"
ON public.sales_order_lines
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'Warehouse'
  )
);