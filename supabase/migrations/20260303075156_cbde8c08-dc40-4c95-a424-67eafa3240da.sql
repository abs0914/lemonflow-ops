-- Allow Warehouse and Fulfillment users to delete sales orders in draft or submitted status
CREATE POLICY "Warehouse Fulfillment can delete draft submitted orders"
ON public.sales_orders
FOR DELETE
USING (
  (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('Warehouse', 'Fulfillment')
  ))
  AND status IN ('draft', 'submitted')
);
