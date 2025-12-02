-- Add CEO role check function
CREATE OR REPLACE FUNCTION public.is_ceo(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = user_id
      AND role = 'CEO'
  )
$$;

-- Add approval tracking fields to purchase_orders
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;

-- Update RLS policy for approving POs - only CEO can approve
DROP POLICY IF EXISTS "Admins and Warehouse can update purchase orders" ON purchase_orders;

CREATE POLICY "Admins and Warehouse can update purchase orders" 
ON purchase_orders 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
      AND role IN ('Admin', 'Warehouse')
  )
  OR 
  (
    -- CEO can only update status to approved and approval fields
    is_ceo(auth.uid()) AND status = 'submitted'
  )
);

COMMENT ON FUNCTION is_ceo IS 'Security definer function to check if user has CEO role';