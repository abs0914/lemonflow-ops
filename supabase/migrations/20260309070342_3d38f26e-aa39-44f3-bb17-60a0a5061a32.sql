
-- Fix: Change purchase_orders UPDATE policies from RESTRICTIVE to PERMISSIVE
-- so that each role only needs to satisfy its own policy (OR logic, not AND).

-- Drop existing restrictive UPDATE policies
DROP POLICY IF EXISTS "Accounting can update approved POs to verified" ON public.purchase_orders;
DROP POLICY IF EXISTS "Admins and Warehouse can update purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Production can update approved POs for proof upload" ON public.purchase_orders;

-- Recreate as PERMISSIVE (default) UPDATE policies
CREATE POLICY "Accounting can update approved POs to verified"
  ON public.purchase_orders FOR UPDATE TO authenticated
  USING (is_accounting(auth.uid()) AND status = ANY(ARRAY['approved','verified']))
  WITH CHECK (is_accounting(auth.uid()) AND status = ANY(ARRAY['approved','verified']));

CREATE POLICY "Admins and Warehouse can update purchase orders"
  ON public.purchase_orders FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = ANY(ARRAY['Admin','Warehouse'])
  ));

CREATE POLICY "Production can update approved POs for proof upload"
  ON public.purchase_orders FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'Production')
    AND status = 'approved'
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'Production')
    AND status = 'approved'
  );
