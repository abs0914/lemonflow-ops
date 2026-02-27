
-- Fix: Allow CEO to also update purchase orders when status is 'approved'
-- This is needed because after approval, the autocount sync update runs on the now-approved PO
DROP POLICY "Admins and Warehouse can update purchase orders" ON public.purchase_orders;

CREATE POLICY "Admins and Warehouse can update purchase orders"
ON public.purchase_orders FOR UPDATE
USING (
  (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = ANY (ARRAY['Admin', 'Warehouse'])
  ))
  OR (is_ceo(auth.uid()) AND status IN ('submitted', 'approved'))
);
