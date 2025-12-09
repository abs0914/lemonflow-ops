-- Drop the existing policy
DROP POLICY IF EXISTS "Store users can create orders" ON sales_orders;

-- Create updated policy that allows Admins OR Store users with assignments
CREATE POLICY "Store users can create orders" ON sales_orders
FOR INSERT
WITH CHECK (
  (
    -- Admins can create orders for any store
    is_admin(auth.uid())
    OR
    -- Store users can create for their assigned stores with permission
    (EXISTS ( SELECT 1
       FROM user_store_assignments
       WHERE user_store_assignments.user_id = auth.uid()
         AND user_store_assignments.store_id = sales_orders.store_id
         AND user_store_assignments.can_place_orders = true
    ))
  ) 
  AND created_by = auth.uid()
);