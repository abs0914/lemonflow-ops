-- Fix the UPDATE policy for sales_orders
-- The issue: USING clause applies to both old and new rows
-- When changing status from 'draft' to 'submitted', the new row fails the status='draft' check

DROP POLICY IF EXISTS "Store users can update own draft orders" ON sales_orders;

-- Create policy with separate USING and WITH CHECK
-- USING: Can access rows where created_by matches AND status is draft
-- WITH CHECK: New row must still have created_by match (allows status change)
CREATE POLICY "Store users can update own draft orders" ON sales_orders
FOR UPDATE
USING ((created_by = auth.uid()) AND (status = 'draft'::text))
WITH CHECK (created_by = auth.uid());